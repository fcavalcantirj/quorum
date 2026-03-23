// Package migrations provides the embedded SQL migration files for goose.
// Import this package to access the embedded FS — the migrations are embedded
// at compile time and shipped with the binary.
package migrations

import "embed"

// FS contains all goose migration SQL files embedded at compile time.
//
//go:embed *.sql
var FS embed.FS
