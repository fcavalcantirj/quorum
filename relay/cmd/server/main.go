package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/fcavalcanti/quorum/relay/internal/config"
	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/handler"
	mw "github.com/fcavalcanti/quorum/relay/internal/middleware"
	"github.com/fcavalcanti/quorum/relay/internal/migrations"
	"github.com/fcavalcanti/quorum/relay/internal/service"
)

func main() {
	ctx := context.Background()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}
	slog.Info("quorum relay starting", "port", cfg.Port)

	// Build pgxpool config with sensible defaults for a single-VPS deployment.
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to parse database URL", "error", err)
		os.Exit(1)
	}
	poolConfig.MaxConns = 20
	poolConfig.MinConns = 2
	poolConfig.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		slog.Error("failed to create connection pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("database connected")

	// Run embedded goose migrations at startup.
	// IMPORTANT: Do NOT call sqlDB.Close() — it would close the underlying pgxpool.
	if err := runMigrations(ctx, pool); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Create the sqlc Queries instance backed by the pool.
	// db.New accepts any DBTX — *pgxpool.Pool satisfies the interface.
	queries := db.New(pool)

	// Wire service and handler layers.
	roomService := service.NewRoomService(queries)
	roomHandler := handler.NewRoomHandler(roomService, cfg.BaseURL)

	// Build chi router.
	r := chi.NewRouter()

	// Global middleware — applied to all routes.
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(mw.BearerTokenQueryStringGuard) // reject query-string tokens globally

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.FrontendURL},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	// Health check — no auth required.
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Public room creation — includes AnonSession middleware to track anonymous users.
	r.Group(func(r chi.Router) {
		r.Use(mw.AnonSession)
		r.Post("/rooms", roomHandler.CreateRoom)
	})

	// Public read routes — no session tracking needed.
	r.Get("/rooms", roomHandler.ListPublicRooms)
	r.Get("/rooms/{slug}", roomHandler.GetRoom)

	// Start HTTP server with graceful shutdown.
	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Listen for OS signals in background, then shutdown gracefully.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		slog.Info("quorum relay shutting down")
		shutCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutCtx); err != nil {
			slog.Error("graceful shutdown failed", "error", err)
		}
	}()

	slog.Info("quorum relay ready", "addr", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
	slog.Info("quorum relay stopped")
}

// runMigrations runs all pending goose migrations from the embedded FS.
// The *sql.DB returned by stdlib.OpenDBFromPool shares the underlying pgxpool —
// do NOT close it; pool.Close() is called by the deferred close in main.
func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	sqlDB := stdlib.OpenDBFromPool(pool)
	// Deliberately NOT deferred: closing sqlDB closes the pool (Pitfall 3).

	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrations.FS)
	if err != nil {
		return fmt.Errorf("goose provider: %w", err)
	}

	results, err := provider.Up(ctx)
	if err != nil {
		return fmt.Errorf("goose up: %w", err)
	}

	for _, r := range results {
		if r.Error != nil {
			slog.Error("migration failed",
				"version", r.Source.Version,
				"type", r.Source.Type,
				"error", r.Error,
			)
		} else {
			slog.Info("migration applied",
				"version", r.Source.Version,
				"duration", r.Duration,
			)
		}
	}

	return nil
}
