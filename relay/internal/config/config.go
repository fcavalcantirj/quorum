package config

import (
	"fmt"

	"github.com/caarlos0/env/v11"
)

// Config holds all runtime configuration for the Quorum relay server.
// Values are parsed from environment variables at startup.
type Config struct {
	Port                   int    `env:"PORT" envDefault:"8080"`
	DatabaseURL            string `env:"DATABASE_URL,required"`
	JWTSecret              string `env:"JWT_SECRET,required"`
	GoogleClientID         string `env:"GOOGLE_CLIENT_ID" envDefault:""`
	GoogleClientSecret     string `env:"GOOGLE_CLIENT_SECRET" envDefault:""`
	GitHubClientID         string `env:"GITHUB_CLIENT_ID" envDefault:""`
	GitHubClientSecret     string `env:"GITHUB_CLIENT_SECRET" envDefault:""`
	FrontendURL            string `env:"FRONTEND_URL" envDefault:"http://localhost:3000"`
	BaseURL                string `env:"BASE_URL" envDefault:"http://localhost:8080"`
	AnonRoomLimitPerHour   int `env:"ANON_ROOM_LIMIT_PER_HOUR" envDefault:"10"`
	AuthedRoomLimitPerHour int `env:"AUTHED_ROOM_LIMIT_PER_HOUR" envDefault:"20"`
	// SSE connection limits — protect VPS from resource exhaustion.
	MaxSSEPerRoom int `env:"MAX_SSE_PER_ROOM" envDefault:"100"`
	MaxSSETotal   int `env:"MAX_SSE_TOTAL" envDefault:"1000"`
}

// Load parses configuration from environment variables and returns a Config.
// Returns an error if any required environment variables are missing.
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	return cfg, nil
}
