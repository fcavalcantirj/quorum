package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/fcavalcanti/quorum/relay/internal/config"
	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/migrations"
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
	_ = queries // used by handlers registered in Plan 03

	slog.Info("quorum relay ready", "port", cfg.Port)
	fmt.Printf("Server ready on port %d (HTTP server wiring in next plan)\n", cfg.Port)
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
