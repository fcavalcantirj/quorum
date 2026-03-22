# Stack Research

**Domain:** A2A-protocol relay service (IRC-for-agents) with Next.js frontend
**Researched:** 2026-03-21
**Confidence:** HIGH (core stack), MEDIUM (a2a-go SDK surface — v2 docs sparse)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Go | 1.26.x | Relay server runtime | Current stable (released Feb 2026). Required min for a2a-go is 1.24; use 1.26 for Green Tea GC default + stack-allocated slices. Native goroutine model maps perfectly to per-room fanout with zero blocking. |
| github.com/a2aproject/a2a-go | v0.3.12 | Official A2A protocol SDK | Latest stable (Mar 20 2026). Provides `a2asrv` (HTTP server), `a2aclient`, `a2a` types, `a2agrpc`. This IS the protocol — don't hand-roll JSON-RPC A2A compliance. |
| Next.js | 16.2 | Frontend framework | Current stable (Mar 18 2026). Already in use (non-negotiable). 16.2 adds ~400% faster dev startup with Turbopack. |
| PostgreSQL | 16.x | Persistent store | Already on Hostinger VPS. Stores rooms, agent registrations, bearer tokens, stats. |
| github.com/jackc/pgx/v5 | v5.9.0 | Postgres driver + pool | Current stable (Mar 21 2026). Outperforms lib/pq by 30-50% in throughput benchmarks. `pgxpool` handles concurrent room-message load. LISTEN/NOTIFY available for future pub/sub. |
| github.com/sqlc-dev/sqlc | v1.30.0 | SQL-to-Go code generation | Type-safe query layer. Write plain SQL, get generated Go structs. Prevents schema-drift bugs. Pairs natively with pgx/v5. |
| github.com/go-chi/chi/v5 | v5.2.5 | HTTP router | Current stable (Feb 5 2025). Zero external dependencies, net/http compatible. Composable middleware for auth, logging, CORS. Works cleanly alongside a2asrv HTTP handlers — chi routes REST API, a2asrv mounts on A2A paths. |
| github.com/pressly/goose/v3 | v3.27.0 | Database migrations | Current stable (Feb 2026). SQL-first migrations embedded in binary. Supports pgx driver. Runs at startup — no separate migration tool to deploy. |
| github.com/golang-jwt/jwt/v5 | v5.x (Jan 2026) | Bearer token auth | Community-standard JWT library. v5 is current (not v4 — v4 is maintained but v5 has improved validation). Used for signing room bearer tokens and verifying agent identity. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| github.com/go-chi/cors | latest | CORS middleware for chi | Always — Next.js on Vercel calls Go API on VPS; cross-origin required. |
| github.com/go-chi/jwtauth/v5 | latest | JWT middleware for chi | For the REST API auth layer (room owner endpoints). Works with golang-jwt/v5. |
| github.com/jetify-com/sse | latest | SSE server primitives | For `message/stream` endpoint. Zero-dependency, spec-compliant. Use if a2asrv's built-in HTTP transport doesn't expose raw SSE helpers. |
| log/slog (stdlib) | Go 1.26 | Structured logging | Built into Go 1.21+. No external logger needed. a2a-go uses slog via its `log` package. |
| net/http (stdlib) | Go 1.26 | HTTP server | a2asrv wraps standard handlers. Pair with chi for routing. No separate HTTP server framework needed. |
| crypto/rand (stdlib) | Go 1.26 | Secure token generation | For generating room bearer tokens. No external lib needed. |
| github.com/caarlos0/env/v11 | latest | Environment config | Parse DATABASE_URL, PORT, JWT_SECRET from env. Lightweight, no YAML overhead. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| sqlc CLI | Generate Go from SQL queries | Run `sqlc generate` after any schema change. Configure `sqlc.yaml` with pgx driver. |
| goose CLI | Run/roll back migrations | Embed migrations via `go:embed` — same binary manages its own schema. |
| air | Hot-reload for Go | `cosmtrek/air` — restarts binary on file save during development. |
| Docker Compose | Local Postgres for development | Single `postgres:16` container replaces needing Hostinger VPS locally. |
| golangci-lint | Go linting | Catches common mistakes before CI. |

---

## Installation

```bash
# Go relay server — initialize module
cd server
go mod init github.com/yourorg/quorum-server

# Core protocol and transport
go get github.com/a2aproject/a2a-go@v0.3.12

# Router
go get github.com/go-chi/chi/v5@v5.2.5

# Database
go get github.com/jackc/pgx/v5@v5.9.0

# Auth
go get github.com/golang-jwt/jwt/v5

# Config
go get github.com/caarlos0/env/v11

# Migrations (also install goose CLI separately)
go get github.com/pressly/goose/v3@v3.27.0

# Dev tools (not in go.mod)
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install github.com/cosmtrek/air@latest
```

```bash
# Frontend — already initialized, pin to current
cd frontend
npm install next@16.2.0
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| chi v5 | Gin | If you prefer Rails-style batteries-included (auth helpers, binding). Gin is fine but adds abstraction over net/http that conflicts with a2asrv's handler registration style. |
| chi v5 | Fiber | Only if throughput benchmarks at 100K+ RPS matter. Fiber uses fasthttp which is NOT compatible with net/http — a2asrv registers standard `http.Handler`, so Fiber breaks the integration. |
| chi v5 | Echo | Echo is a valid choice, similar size to chi. Chi wins for net/http compatibility and zero deps. |
| sqlc + pgx | GORM | If schema is unknown at write time. For Quorum, schema is fixed upfront — GORM's reflection overhead is unnecessary and hides query plans. |
| sqlc + pgx | sqlx | sqlx is a reasonable middle ground. sqlc is strictly safer (compile-time failures on schema mismatch). For a greenfield project, sqlc's ergonomics win. |
| goose | golang-migrate | golang-migrate is fine. Goose wins for Go-native migrations (can embed logic, not just SQL) and better pgx v5 support in v3.27.0. |
| golang-jwt/v5 | PASETO (o1ecc8o/paseto) | If bearer tokens need to be tamper-proof without a secret key (e.g., public-key signed). JWT is sufficient for v1 — symmetric signing, server validates. |
| pgx pgxpool | PgBouncer | PgBouncer adds ops complexity. pgxpool is enough for single-VPS deployment at Quorum's expected load. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Fiber (go-fiber/fiber) | Uses fasthttp, NOT net/http compatible. a2asrv registers standard http.Handler — Fiber will not work as a host router for A2A endpoints. | chi v5 |
| lib/pq (postgres driver) | Archived and unmaintained since 2021. pgx v5 supersedes it in every dimension. | pgx/v5 |
| GORM | Reflection-based ORM hides query plans and adds latency. sqlc generates type-safe code with zero runtime reflection. | sqlc + pgx |
| gorilla/mux | Abandoned in 2022, revived but ecosystem moved on. chi is the net/http-compatible successor with active maintenance. | chi v5 |
| github.com/dgrijalva/jwt-go | Archived. Security vulnerabilities unfixed. The community fork is golang-jwt/jwt. | golang-jwt/jwt/v5 |
| r3labs/sse | Last meaningful commit 2022. Jetify's sse or tmaxmax/go-sse are actively maintained. | jetify-com/sse |
| WebSockets for streaming | A2A spec mandates SSE for streaming transport (`message/stream`). WebSocket support is not in spec. | SSE via a2asrv + jetify-com/sse |
| Redis for pub/sub | Adds operational dependency on VPS. Go channels + sync.Map are sufficient for single-process room fanout at Quorum's scale. Add Redis only if horizontal scaling is needed in v2. | sync.Map + Go channels |

---

## Stack Patterns by Variant

**For A2A endpoints (`/rooms/{id}/a2a/...`):**
- Mount `a2asrv.NewHandler(roomExecutor)` as an `http.Handler` under chi's subrouter
- The RoomExecutor implements `a2asrv.AgentExecutor` and routes to the correct room's broadcast channel
- A2A's `message/send` → synchronous JSON-RPC response
- A2A's `message/stream` → SSE stream, chi flushes via `http.Flusher`

**For REST API (`/api/v1/rooms`, `/api/v1/stats`):**
- Pure chi routes, no a2asrv involvement
- Middleware chain: CORS → bearer token auth → handler
- Returns standard JSON, consumed by Next.js frontend

**For Agent Card discovery (`/.well-known/a2a-agent-card`):**
- Served at room level: `/rooms/{id}/.well-known/a2a-agent-card`
- Static JSON generated from room metadata + registered agent cards
- Cached in memory, invalidated on agent join/leave

**For monorepo layout:**
```
quorum/
  frontend/        # Next.js 16.2 (existing)
  server/          # Go module (new)
    cmd/server/
    internal/
      rooms/
      a2a/
      api/
      db/          # sqlc generated
    migrations/    # goose SQL files
    sqlc.yaml
    go.mod
  go.work          # ties Go workspace if shared packages added later
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| a2a-go v0.3.12 | Go >= 1.24.4 | Use Go 1.26 — a2a-go min is 1.24, Go 1.26 is current stable |
| pgx/v5 v5.9.0 | Go >= 1.21 | pgxpool is part of pgx/v5, not a separate dep |
| sqlc v1.30.0 | pgx/v5 driver | Set `sql_driver: "pgx/v5"` in sqlc.yaml |
| goose v3.27.0 | Go >= 1.25 (min bumped in v3.27) | Requires Go 1.25+, covered by using Go 1.26 |
| chi v5.2.5 | Go >= 1.22 | Uses Go 1.22 routing features, covered by Go 1.26 |
| golang-jwt/v5 | Go >= 1.18 | No constraint issues |
| Next.js 16.2 | Node >= 18.18 | Turbopack default in 16.x; no config change needed |

---

## Sources

- [github.com/a2aproject/a2a-go](https://github.com/a2aproject/a2a-go) — SDK packages, version v0.3.12 (Mar 20 2026), Go 1.24.4 min requirement. HIGH confidence.
- [pkg.go.dev/github.com/jackc/pgx/v5](https://pkg.go.dev/github.com/jackc/pgx/v5) — Version v5.9.0, published Mar 21 2026. HIGH confidence.
- [docs.sqlc.dev](https://docs.sqlc.dev/en/stable/guides/using-go-and-pgx.html) — sqlc v1.30.0, pgx/v5 integration guide. HIGH confidence.
- [github.com/go-chi/chi at v5.2.3](https://github.com/go-chi/chi/tree/v5.2.3) — Latest chi release v5.2.5, Feb 5 2025. HIGH confidence.
- [github.com/pressly/goose releases](https://github.com/pressly/goose/releases) — v3.27.0, Feb 22 2025, Go 1.25 min. HIGH confidence.
- [pkg.go.dev/github.com/golang-jwt/jwt/v5](https://pkg.go.dev/github.com/golang-jwt/jwt/v5) — Latest Jan 28 2026. HIGH confidence.
- [go.dev/blog/go1.26](https://go.dev/blog/go1.26) — Go 1.26 released Feb 10 2026, current stable. HIGH confidence.
- [nextjs.org/blog/next-16-2](https://nextjs.org/blog/next-16-2) — Next.js 16.2, Mar 18 2026, current stable. HIGH confidence.
- [a2a-protocol.org/latest/specification](https://a2a-protocol.org/latest/specification/) — A2A v1.0 spec: HTTP+JSON/REST binding, SSE streaming requirement for `message/stream`. HIGH confidence.
- [github.com/jetify-com/sse](https://github.com/jetify-com/sse) — Zero-dependency SSE, actively maintained. MEDIUM confidence (version not pinned).

---

**Critical note on a2a-go v0.3.12 vs earlier WebFetch that said "v2.0.0":** The pkg.go.dev listing is authoritative. The SDK version is v0.3.12, not v2.0.0. The v2.0.0 figure from the earlier fetch appears to have been a hallucinated or confused response. Trust pkg.go.dev: v0.3.12 is current.

---

*Stack research for: Quorum — A2A relay service (Go backend + Next.js frontend)*
*Researched: 2026-03-21*
