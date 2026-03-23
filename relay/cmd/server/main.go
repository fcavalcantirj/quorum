package main

import (
	"context"
	"encoding/json"
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
	"github.com/go-chi/httprate"
	"github.com/go-chi/jwtauth/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"

	"github.com/fcavalcanti/quorum/relay/internal/config"
	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/handler"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
	mw "github.com/fcavalcanti/quorum/relay/internal/middleware"
	"github.com/fcavalcanti/quorum/relay/internal/migrations"
	"github.com/fcavalcanti/quorum/relay/internal/presence"
	"github.com/fcavalcanti/quorum/relay/internal/relay"
	"github.com/fcavalcanti/quorum/relay/internal/service"
)

func main() {
	// Root context is cancelled on SIGINT/SIGTERM — propagated to hub goroutines and reaper.
	ctx, cancelCtx := context.WithCancel(context.Background())
	defer cancelCtx()

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
	queries := db.New(pool)

	// --- Hub infrastructure (A2A phase) ---
	logger := slog.Default()
	registry := hub.NewPresenceRegistry()
	hubMgr := hub.NewHubManager(registry, logger, cfg.MaxSSEPerRoom)

	// DiscoveryHandler: REST endpoints for agent join, list, info, heartbeat.
	discoveryH := &handler.DiscoveryHandler{
		Queries:  queries,
		HubMgr:   hubMgr,
		Registry: registry,
		Logger:   logger,
	}

	// AgentHandler: global agent directory across public rooms.
	agentH := &handler.AgentHandler{
		Queries:  queries,
		Registry: registry,
		Logger:   logger,
	}

	// Start background presence reaper (evicts TTL-expired agents every 60s).
	presence.StartReaper(ctx, queries, registry, hubMgr, logger)

	// --- Services ---
	roomService := service.NewRoomService(queries)
	authService := service.NewAuthService(queries, cfg.JWTSecret)

	// --- OAuth configs ---
	googleOAuthConfig := &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  cfg.BaseURL + "/auth/google/callback",
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}

	githubOAuthConfig := &oauth2.Config{
		ClientID:     cfg.GitHubClientID,
		ClientSecret: cfg.GitHubClientSecret,
		RedirectURL:  cfg.BaseURL + "/auth/github/callback",
		Scopes:       []string{"user:email", "read:user"},
		Endpoint:     github.Endpoint,
	}

	// --- Handlers ---
	roomHandler := handler.NewRoomHandler(roomService, cfg.BaseURL)
	authHandler := handler.NewAuthHandler(authService, googleOAuthConfig, githubOAuthConfig, cfg.FrontendURL)

	// --- JWT auth ---
	tokenAuth := mw.NewJWTAuth(cfg.JWTSecret)

	// --- Rate limiters (D-10, D-12) ---

	// Anonymous room creation: 2/hour per IP
	anonRateLimiter := httprate.Limit(
		cfg.AnonRoomLimitPerHour,
		time.Hour,
		httprate.WithKeyFuncs(httprate.KeyByIP),
		httprate.WithLimitHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "3600")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]any{
				"error":       "rate_limit_exceeded",
				"message":     "Too many rooms created. Try again in an hour.",
				"retry_after": 3600,
				"limit":       cfg.AnonRoomLimitPerHour,
				"window":      "1h",
			})
		})),
	)

	// Authenticated room creation: 5/hour per IP
	authedRateLimiter := httprate.Limit(
		cfg.AuthedRoomLimitPerHour,
		time.Hour,
		httprate.WithKeyFuncs(httprate.KeyByIP),
		httprate.WithLimitHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "3600")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]any{
				"error":       "rate_limit_exceeded",
				"message":     "Room creation rate limit reached.",
				"retry_after": 3600,
				"limit":       cfg.AuthedRoomLimitPerHour,
				"window":      "1h",
			})
		})),
	)

	// --- Build chi router ---
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

	// Docker HEALTHCHECK endpoint — no auth required, matches Dockerfile HEALTHCHECK path.
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// OAuth routes — public, no JWT required.
	r.Get("/auth/google/login", authHandler.GoogleLogin)
	r.Get("/auth/google/callback", authHandler.GoogleCallback)
	r.Get("/auth/github/login", authHandler.GitHubLogin)
	r.Get("/auth/github/callback", authHandler.GitHubCallback)
	r.Post("/auth/logout", authHandler.Logout)
	r.Post("/auth/refresh", authHandler.RefreshToken)

	// Anonymous room creation — rate-limited per IP, anon session tracked.
	r.Group(func(r chi.Router) {
		r.Use(mw.AnonSession)
		r.Use(anonRateLimiter)
		r.Post("/rooms", roomHandler.CreateRoom)
	})

	// Public read routes — no session or auth required.
	r.Get("/rooms", roomHandler.ListPublicRooms)
	r.Get("/rooms/{slug}", roomHandler.GetRoom)

	// Authenticated routes — JWT required for all routes in this group.
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator(tokenAuth))

		// Current user info
		r.Get("/auth/me", authHandler.Me)

		// My rooms list
		r.Get("/me/rooms", roomHandler.ListMyRooms)

		// Private room creation — additionally rate-limited per IP.
		r.Group(func(r chi.Router) {
			r.Use(authedRateLimiter)
			r.Post("/rooms/private", roomHandler.CreatePrivateRoom)
		})

		// Room management — owner-only enforcement in handler/service layer.
		r.Delete("/rooms/{slug}", roomHandler.DeleteRoom)
		r.Patch("/rooms/{slug}", roomHandler.UpdateRoom)
	})

	// --- A2A protocol routes (phase 02) ---

	// Mount A2A JSON-RPC handler and relay agent card (DISC-05).
	// Registers: POST /r/{slug}/a2a (A2A JSON-RPC), GET /r/{slug}/.well-known/agent-card.json
	relay.MountA2ARoutes(r, hubMgr, registry, queries, cfg.BaseURL, logger)

	// Discovery REST endpoints — bearer auth handled in handler for join/heartbeat.
	r.Post("/r/{slug}/join", discoveryH.JoinRoom)
	r.Get("/r/{slug}/agents", discoveryH.ListAgents)
	r.Get("/r/{slug}/agents/{name}", discoveryH.GetAgentCard)
	r.Get("/r/{slug}/info", discoveryH.RoomInfo)
	r.Post("/r/{slug}/heartbeat", discoveryH.Heartbeat)

	// Global agent directory — public, returns agents from public rooms only.
	r.Get("/agents", agentH.GlobalDirectory)

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
		// Cancel root context — stops hub goroutines and reaper.
		cancelCtx()
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
