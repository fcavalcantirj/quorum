package main

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/fcavalcanti/quorum/relay/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}
	slog.Info("quorum relay starting", "port", cfg.Port)
	fmt.Printf("Quorum relay server configured on port %d\n", cfg.Port)
}
