# Phase 1: Foundation - Research

**Researched:** 2026-03-22
**Domain:** Go monorepo scaffold, Postgres schema + migrations, OAuth2 (Google/GitHub), bearer token auth, JWT session cookies, rate limiting, room CRUD REST API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Room URLs use the `/r/` prefix — e.g., `quorum.dev/r/my-cool-room`. IRC-like, short, clean.
- **D-02:** Users pick a room name (display name); slug is auto-generated from it (lowercase, hyphens). Slug format: 3-40 characters, `[a-z0-9-]`, no leading/trailing hyphens.
- **D-03:** Slug conflicts show an error — "This name is taken" — user picks another name. No auto-suffixing.
- **D-04:** A2A endpoint lives at `/r/{slug}/a2a`
- **D-05:** Public rooms created anonymously expire after **3 days of inactivity** (no messages, no agent connections). Activity resets the timer. Rooms owned by logged-in users do not expire.
- **D-06:** OAuth only for v1 — Google and GitHub. **Email/password dropped entirely from v1** (AUTH-02, AUTH-03 removed from scope).
- **D-07:** After OAuth login, user lands on a **single-page dashboard** that packs everything: My Rooms + Create button, public rooms directory, quick-start/API docs link, activity stats. Even the footer is instructive.
- **D-08:** Anonymous users can create public rooms but cannot manage them (no delete, no edit). If the anonymous user later logs in via OAuth **in the same browser session**, their rooms auto-link to the new account (browser session-based claiming).
- **D-09:** JWT session duration: 30 days with secure httpOnly cookies. Refresh token pattern for silent re-auth.
- **D-10:** Room creation: **strict for anonymous** (2 rooms/hour per IP), **moderate for logged-in** (5 rooms/hour per IP). Limits must be easily configurable (env vars or config struct).
- **D-11:** A2A message rate limits: Claude's discretion based on research — must be generous enough for real multi-agent conversation but prevent runaway loops.
- **D-12:** Rate limit response format: Claude's discretion based on what's most intuitive for AI agents to handle programmatically.
- **D-13:** Claude's discretion — bearer token format, storage, lifecycle. Must be secure and easy to use.

### Claude's Discretion

- Bearer token format, storage, and lifecycle (D-13)
- A2A message rate limit thresholds (D-11)
- Rate limit response format for AI agents (D-12)
- JWT refresh token implementation details (D-09)
- Dashboard page layout specifics
- Password hashing N/A — OAuth only

### Deferred Ideas (OUT OF SCOPE)

- Email/password authentication — explicitly dropped from v1 (was AUTH-02, AUTH-03)
- Token rotation without disconnecting agents — v2 (TOKR-01)
- Room capacity limits based on VPS resources — validate during Phase 3 deployment
- Horizontal scaling / Redis pub-sub — v2, single VPS for v1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Monorepo structure with Next.js frontend (`/web`) and Go relay server (`/relay`) | Monorepo layout section covers directory tree, root Makefile, Docker Compose for local dev |
| INFRA-02 | Postgres database schema with migrations (rooms, agents, tokens, users) | Schema design, goose embedded migrations, pgx/v5 pool + `stdlib.OpenDBFromPool` pattern |
| INFRA-05 | Rate limiting middleware on all public endpoints | go-chi/httprate v0.15.0 — LimitByIP, per-route limiter, configurable thresholds |
| AUTH-01 | Agent authenticates to a room via bearer token in Authorization header | Opaque token design, SHA-256 hashed storage, header-only enforcement, query-string 400 |
| AUTH-02 | ~~Email/password~~ — DROPPED per D-06 | N/A |
| AUTH-03 | ~~Email confirmation~~ — DROPPED per D-06 | N/A |
| AUTH-04 | User can log in via Google OAuth | golang.org/x/oauth2 + go-pkgz/auth v2 pattern; state cookie CSRF protection |
| AUTH-05 | User can log in via GitHub OAuth | Same stack as AUTH-04; provider string "github" |
| AUTH-06 | User can log in and receive a session token (JWT) | golang-jwt/v5 + go-chi/jwtauth/v5; 30-day access JWT in httpOnly cookie + refresh token |
| AUTH-07 | Private room creation requires authenticated user session | chi middleware gate: Verifier → Authenticator → handler; 401 on missing/invalid JWT |
| ROOM-01 | User can create a public room without an account (anonymous creation) | Anonymous session cookie + rate limit 2/hour/IP; no auth gate on POST /rooms |
| ROOM-02 | User can create a private room (requires account) | AUTH-07 middleware gate; `is_private = true` field in rooms table |
| ROOM-03 | Room creation returns a stable URL and bearer token | Opaque token generated with crypto/rand (32 bytes), stored as SHA-256 hash |
| ROOM-04 | Room owner can delete their room | Session user_id matches rooms.owner_id; 403 for non-owner; 404 for not found |
| ROOM-05 | Room owner can add tags/metadata (domain, description) | PATCH /rooms/{slug} with JSON body; JSONB or text[] tags column |
| ROOM-06 | Room URL is permanent and never changes once created | Slug immutable after creation; no PATCH on slug field |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire secure foundation that every subsequent phase builds on. The monorepo layout is straightforward: `/web` (existing Next.js import, no code changes), `/relay` (new Go module), root-level Makefile and Docker Compose for local Postgres. The Go server uses chi v5 as the HTTP router, goose for startup migrations (embedded via `go:embed`), and pgx/v5 with sqlc for type-safe database access.

Authentication has two distinct surfaces. The OAuth surface (Google + GitHub) uses `golang.org/x/oauth2` with the state-cookie CSRF pattern, landing the user in a 30-day JWT session stored in an httpOnly secure cookie. A thin refresh token (also in a cookie) enables silent re-authentication. The agent authentication surface is completely separate: an opaque bearer token scoped to one room, generated with `crypto/rand`, stored as its SHA-256 hash in Postgres, and validated via a custom chi middleware that rejects query-string tokens with HTTP 400.

Rate limiting uses `go-chi/httprate` with two independent per-IP limiters on the room creation endpoint (anonymous: 2/hour, authenticated: 5/hour), both thresholds read from environment variables. The `rooms` table carries a `last_active_at` column for the 3-day anonymous expiry TTL; a background goroutine or Postgres cron handles cleanup. Anonymous room ownership is tracked via a short-lived anonymous session ID in a cookie; on OAuth login, rooms with that session ID are reassigned to the new user account if the browser session cookie is still present.

**Primary recommendation:** Build all three plans in sequence (01-01 monorepo, 01-02 database, 01-03 server skeleton). Do not start 01-03 until migrations run successfully via `goose.Up` at startup — the schema is the contract that sqlc generates against.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Go | 1.26.x | Relay server runtime | Current stable Feb 2026; Green Tea GC; goroutine model |
| github.com/go-chi/chi/v5 | v5.2.5 | HTTP router | Zero deps, net/http compatible; required for a2asrv integration in Phase 2 |
| github.com/pressly/goose/v3 | v3.27.0 | DB migrations | SQL-first, embeddable, pgx/v5 compatible via `stdlib.OpenDBFromPool` |
| github.com/jackc/pgx/v5 | v5.9.0 | Postgres driver + pool | Current stable Mar 2026; pgxpool for concurrent load |
| github.com/sqlc-dev/sqlc | v1.30.0 | SQL-to-Go codegen | Type-safe queries; compile-time schema mismatch detection |
| github.com/golang-jwt/jwt/v5 | v5.x (Jan 2026) | JWT signing/verification | Community standard; v5 required (not v4); improved validation |
| github.com/go-chi/jwtauth/v5 | latest | JWT chi middleware | Token extraction from header/cookie; Verifier + Authenticator pattern |
| golang.org/x/oauth2 | latest | OAuth2 client | Standard Go OAuth2 library; handles state, code exchange, token refresh |
| github.com/go-chi/httprate | v0.15.0 | Rate limiting | Sliding window, per-IP, per-route configurability; chi-native |
| github.com/caarlos0/env/v11 | latest | Env config parsing | Lightweight struct tag config; no YAML overhead |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| github.com/go-chi/cors | latest | CORS middleware | Always — Next.js on Vercel → Go on VPS is cross-origin |
| log/slog (stdlib) | Go 1.26 | Structured logging | Built-in; zero deps; a2a-go also uses slog |
| crypto/rand (stdlib) | Go 1.26 | Opaque token generation | For room bearer tokens; 32 bytes = 256 bits entropy |
| crypto/sha256 (stdlib) | Go 1.26 | Token hashing | SHA-256 of raw token bytes; stored in DB; fast lookup |
| encoding/base64 (stdlib) | Go 1.26 | Token encoding | `base64.RawURLEncoding` for URL-safe opaque token strings |
| net/http (stdlib) | Go 1.26 | HTTP server + cookies | httpOnly cookie management for JWT session |
| embed (stdlib) | Go 1.26 | Embed migrations | `//go:embed migrations/*` for single-binary deploy |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| opaque SHA-256 token | JWT bearer token | JWT allows stateless validation but cannot be revoked without a blocklist; opaque tokens are revocable by deleting the DB row — correct for room auth |
| opaque SHA-256 token | Argon2id hashed token | Argon2id offers stronger brute-force resistance but has 50-100ms latency per verification; SHA-256 is sufficient when tokens are 256-bit random (not guessable by brute force); use SHA-256 for performance |
| golang.org/x/oauth2 (manual) | go-pkgz/auth v2 | go-pkgz/auth abstracts multi-provider OAuth but adds a dependency; since only Google + GitHub are needed and the OAuth flow is well-documented, using x/oauth2 directly keeps the code transparent |
| go-chi/httprate | sethvargo/go-limiter | go-limiter is more flexible for distributed scenarios; httprate is simpler and chi-native for single-VPS v1 |

**Installation:**

```bash
cd relay
go mod init github.com/yourusername/quorum/relay
go get github.com/go-chi/chi/v5
go get github.com/go-chi/chi/v5/middleware
go get github.com/go-chi/cors
go get github.com/go-chi/jwtauth/v5
go get github.com/go-chi/httprate
go get github.com/pressly/goose/v3
go get github.com/jackc/pgx/v5
go get github.com/jackc/pgx/v5/pgxpool
go get github.com/jackc/pgx/v5/stdlib
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/oauth2
go get golang.org/x/oauth2/google
go get golang.org/x/oauth2/github
go get github.com/caarlos0/env/v11

# Dev tools (not in go.mod)
go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0
go install github.com/pressly/goose/v3/cmd/goose@v3.27.0
go install github.com/air-verse/air@latest
```

---

## Architecture Patterns

### Recommended Project Structure

```
quorum/                          # Monorepo root
├── web/                         # Existing Next.js 16 frontend (imported as-is)
│   ├── app/
│   ├── components/
│   └── package.json
├── relay/                       # Go relay server
│   ├── cmd/
│   │   └── server/
│   │       └── main.go          # Entry point
│   ├── internal/
│   │   ├── config/              # caarlos0/env config struct
│   │   ├── db/                  # sqlc-generated code (db.go, models.go, query.sql.go)
│   │   ├── handler/             # chi handler functions (rooms, auth, oauth)
│   │   ├── middleware/          # bearerauth.go, ratelimit.go, cors.go
│   │   ├── migrations/          # goose SQL files (embedded via go:embed)
│   │   │   ├── 00001_init.sql
│   │   │   └── 00002_rooms.sql
│   │   ├── service/             # business logic (roomsvc, authsvc)
│   │   └── token/               # opaque token generation/verification
│   ├── sqlc.yaml
│   ├── query.sql
│   ├── schema.sql
│   └── go.mod
├── docker-compose.yml           # Local Postgres:16
├── Makefile                     # dev, build, migrate, generate targets
└── .env.example                 # DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, etc.
```

### Pattern 1: Startup Sequence

**What:** The server applies goose migrations via the embedded FS before serving any requests.
**When to use:** Every startup, in main.go before binding the port.

```go
// Source: pressly/goose Provider docs + pgx/v5/stdlib
//go:embed internal/migrations/*
var embeddedMigrations embed.FS

func runMigrations(pool *pgxpool.Pool) error {
    fsys, err := fs.Sub(embeddedMigrations, "internal/migrations")
    if err != nil {
        return err
    }
    db := stdlib.OpenDBFromPool(pool)  // pgx/v5/stdlib — wraps pool as *sql.DB
    provider, err := goose.NewProvider(goose.DialectPostgres, db, fsys)
    if err != nil {
        return err
    }
    results, err := provider.Up(context.Background())
    for _, r := range results {
        slog.Info("migration", "version", r.Source.Version, "duration", r.Duration)
    }
    return err
}
```

### Pattern 2: Chi Router Wiring

**What:** Separate route groups for public REST, authenticated REST, and (Phase 2) A2A endpoints.
**When to use:** Always — this is the backbone of the server.

```go
// Source: go-chi/chi README + go-chi/jwtauth README
r := chi.NewRouter()

// Global middleware
r.Use(middleware.RequestID)
r.Use(middleware.RealIP)
r.Use(middleware.Logger)
r.Use(middleware.Recoverer)
r.Use(cors.Handler(cors.Options{
    AllowedOrigins:   []string{cfg.FrontendURL},
    AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
    AllowedHeaders:   []string{"Authorization", "Content-Type"},
    AllowCredentials: true,
}))

// Public routes (rate-limited)
r.Group(func(r chi.Router) {
    r.Use(anonRateLimiter)   // 2 rooms/hour per IP for anon
    r.Post("/rooms", handlers.CreateRoom)
})

// Authenticated routes
r.Group(func(r chi.Router) {
    r.Use(jwtauth.Verifier(tokenAuth))    // extract JWT from header/cookie
    r.Use(jwtauth.Authenticator(tokenAuth)) // reject invalid JWT with 401
    r.Use(authedRateLimiter)              // 5 rooms/hour per IP for authed
    r.Post("/rooms/private", handlers.CreatePrivateRoom)
    r.Delete("/rooms/{slug}", handlers.DeleteRoom)
    r.Patch("/rooms/{slug}", handlers.UpdateRoom)
})

// OAuth routes
r.Get("/auth/google/login", handlers.GoogleLogin)
r.Get("/auth/google/callback", handlers.GoogleCallback)
r.Get("/auth/github/login", handlers.GitHubLogin)
r.Get("/auth/github/callback", handlers.GitHubCallback)
r.Post("/auth/logout", handlers.Logout)
r.Post("/auth/refresh", handlers.RefreshToken)
```

### Pattern 3: Bearer Token Middleware (Query-String Rejection)

**What:** Custom chi middleware that rejects any request with a bearer token in the URL query string with HTTP 400. Tokens are ONLY accepted in the `Authorization: Bearer <token>` header.
**When to use:** Mount this on ALL endpoints, including public ones — must be enforced from day one.

```go
// Source: STATE.md decision + jwtauth.go source pattern
func BearerTokenQueryStringGuard(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Reject any request that has a token in query string
        if r.URL.Query().Get("token") != "" ||
            r.URL.Query().Get("bearer") != "" ||
            r.URL.Query().Get("access_token") != "" {
            http.Error(w, `{"error":"bearer tokens must be sent in Authorization header, not query string"}`,
                http.StatusBadRequest)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

### Pattern 4: Opaque Room Bearer Token

**What:** A room bearer token is a cryptographically random 32-byte value, base64url-encoded, with a `qrm_` prefix. Its SHA-256 hash is stored in the database. Verification is O(1) by re-hashing and comparing.
**When to use:** On room creation (ROOM-03); on every A2A request (AUTH-01).

```go
// Source: crypto/rand stdlib + oneuptime API key authentication guide
func GenerateRoomToken() (plaintext string, hashHex string, err error) {
    b := make([]byte, 32)
    if _, err = rand.Read(b); err != nil {
        return
    }
    plaintext = "qrm_" + base64.RawURLEncoding.EncodeToString(b)
    sum := sha256.Sum256([]byte(plaintext))
    hashHex = hex.EncodeToString(sum[:])
    return
}

func VerifyRoomToken(plaintext, storedHash string) bool {
    sum := sha256.Sum256([]byte(plaintext))
    computed := hex.EncodeToString(sum[:])
    return subtle.ConstantTimeCompare([]byte(computed), []byte(storedHash)) == 1
}
```

### Pattern 5: OAuth2 Flow (Google + GitHub)

**What:** Standard authorization code flow with state-cookie CSRF protection.
**When to use:** AUTH-04, AUTH-05 implementation.

```go
// Source: golang.org/x/oauth2 docs + sohamkamani.com/golang/oauth/
var googleOAuthConfig = &oauth2.Config{
    ClientID:     cfg.GoogleClientID,
    ClientSecret: cfg.GoogleClientSecret,
    RedirectURL:  cfg.BaseURL + "/auth/google/callback",
    Scopes:       []string{"openid", "email", "profile"},
    Endpoint:     google.Endpoint,
}

func GoogleLogin(w http.ResponseWriter, r *http.Request) {
    state := generateOAuthState() // crypto/rand, stored in short-lived httpOnly cookie
    http.SetCookie(w, &http.Cookie{
        Name:     "oauth_state",
        Value:    state,
        MaxAge:   300, // 5 minutes
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
        Path:     "/",
    })
    http.Redirect(w, r, googleOAuthConfig.AuthCodeURL(state), http.StatusTemporaryRedirect)
}

func GoogleCallback(w http.ResponseWriter, r *http.Request) {
    // 1. Verify state cookie matches query param
    // 2. Exchange code for token: googleOAuthConfig.Exchange(ctx, code)
    // 3. Fetch user profile from Google userinfo endpoint
    // 4. Upsert user in DB; claim anonymous rooms if session_id cookie present
    // 5. Issue JWT access token (30 days) + refresh token (90 days) as httpOnly cookies
}
```

### Pattern 6: JWT Session Cookies

**What:** Access JWT (30-day expiry) in httpOnly cookie. Refresh token (opaque, 90-day expiry, stored in DB) in a second httpOnly cookie. Silent re-auth via POST /auth/refresh.
**When to use:** After every successful OAuth callback.

```go
// Source: go-chi/jwtauth docs + alexedwards.net cookies guide
func setSessionCookies(w http.ResponseWriter, accessToken, refreshToken string) {
    http.SetCookie(w, &http.Cookie{
        Name:     "jwt",
        Value:    accessToken,
        MaxAge:   30 * 24 * 3600, // 30 days
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
        Path:     "/",
    })
    http.SetCookie(w, &http.Cookie{
        Name:     "refresh_token",
        Value:    refreshToken,
        MaxAge:   90 * 24 * 3600, // 90 days
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
        Path:     "/auth/refresh", // scoped — only sent to refresh endpoint
    })
}
```

### Pattern 7: Rate Limiting (Two-Tier)

**What:** Two separate httprate limiters on the room creation endpoint based on authentication state. Thresholds configurable via environment variables.
**When to use:** D-10 — anonymous 2/hour, authenticated 5/hour.

```go
// Source: go-chi/httprate v0.15.0 docs
func NewRoomRateLimiters(cfg *Config) (anonLimiter, authedLimiter func(http.Handler) http.Handler) {
    anonLimiter = httprate.Limit(
        cfg.AnonRoomLimitPerHour,   // default: 2
        time.Hour,
        httprate.WithKeyFuncs(httprate.KeyByIP),
        httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Type", "application/json")
            w.Header().Set("Retry-After", "3600")
            http.Error(w, `{"error":"rate_limit_exceeded","message":"Too many rooms created. Try again in an hour.","retry_after":3600}`, 429)
        }),
    )
    authedLimiter = httprate.Limit(
        cfg.AuthedRoomLimitPerHour, // default: 5
        time.Hour,
        httprate.WithKeyFuncs(httprate.KeyByIP),
        httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Type", "application/json")
            w.Header().Set("Retry-After", "3600")
            http.Error(w, `{"error":"rate_limit_exceeded","message":"Room creation rate limit reached.","retry_after":3600}`, 429)
        }),
    )
    return
}
```

### Pattern 8: Anonymous Session + Room Claiming

**What:** On first visit, the server issues an anonymous session ID (random 16 bytes, hex-encoded) as a short-lived httpOnly cookie. On room creation without auth, the room's `anonymous_session_id` column is set. On OAuth login in the same browser session, rooms with that session ID are reassigned to `owner_id = newUser.ID`.
**When to use:** D-08 — the anonymous claiming flow.

```go
// Source: SuperTokens anonymous session docs pattern
func getOrCreateAnonSessionID(r *http.Request) string {
    if c, err := r.Cookie("anon_sid"); err == nil {
        return c.Value
    }
    b := make([]byte, 16)
    rand.Read(b)
    return hex.EncodeToString(b)
}

// In OAuth callback, after creating/finding user:
func claimAnonymousRooms(ctx context.Context, q *db.Queries, userID uuid.UUID, anonSID string) error {
    if anonSID == "" {
        return nil
    }
    return q.ClaimAnonymousRooms(ctx, db.ClaimAnonymousRoomsParams{
        OwnerID:           pgtype.UUID{Bytes: userID, Valid: true},
        AnonymousSessionID: anonSID,
    })
}
```

### Anti-Patterns to Avoid

- **Bearer token in query string:** The STATE.md explicitly states this must be rejected with 400 from day one. No recovery path after launch. Use the BearerTokenQueryStringGuard middleware globally.
- **lib/pq for Postgres:** Archived since 2021. Always pgx/v5.
- **GORM:** Hides query plans. Use sqlc + pgx.
- **JWT for room bearer tokens:** JWTs cannot be revoked without a blocklist. Use opaque tokens (SHA-256 hashed) for room auth — revocation is a single DB row delete.
- **Gorilla/sessions for anonymous sessions:** Gorilla packages are revived-but-stale. Use plain `http.Cookie` directly.
- **Fiber HTTP router:** Uses fasthttp, incompatible with `http.Handler` — would break Phase 2 a2asrv mounting. Use chi.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-IP sliding window rate limiting | Custom token bucket in sync.Map | go-chi/httprate | httprate handles concurrent updates, window reset, X-RateLimit headers, and 429 responses correctly; home-rolled solutions have thundering herd issues at reset boundaries |
| Chi JWT middleware | Custom JWT extraction logic | go-chi/jwtauth/v5 | Handles header + cookie extraction, token verification, and context injection correctly; easy to misconfigure extraction order |
| OAuth state CSRF protection | Manual state string in URL | State in short-lived httpOnly cookie | URL state is logged in access logs and browser history; cookie state is not |
| SQL query type safety | Manual `Scan()` with `database/sql` | sqlc + pgx/v5 | Schema-drift bugs from manual scanning cause silent data corruption; sqlc fails at generate time |
| DB migration tracking | Manual version table | goose | Migration ordering, rollback, and idempotency are surprisingly complex; goose handles all edge cases |
| Opaque token generation | UUID v4 or timestamp-based tokens | crypto/rand 32-byte base64url | UUIDs are only 122 bits of entropy and their format is known; crypto/rand produces full 256-bit opaque strings |

**Key insight:** Every item in this table has caused production incidents at other services. Using the standard library or ecosystem tools is not "taking shortcuts" — it is the correct engineering choice.

---

## Database Schema Design

This schema is what 01-02 must implement. All migrations go in `/relay/internal/migrations/`.

### Core Tables

```sql
-- 00001_init.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,
    provider        TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    provider_id     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_id)
);

CREATE TABLE rooms (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                 TEXT UNIQUE NOT NULL
                             CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
    display_name         TEXT NOT NULL,
    description          TEXT,
    tags                 TEXT[] NOT NULL DEFAULT '{}',
    is_private           BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    anonymous_session_id TEXT,                        -- set for anon-created rooms
    token_hash           TEXT NOT NULL,               -- SHA-256 of bearer token
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- for 3-day expiry
    expires_at           TIMESTAMPTZ                  -- NULL for owned rooms
);

CREATE INDEX idx_rooms_slug ON rooms (slug);
CREATE INDEX idx_rooms_owner_id ON rooms (owner_id);
CREATE INDEX idx_rooms_anonymous_session_id ON rooms (anonymous_session_id)
    WHERE anonymous_session_id IS NOT NULL;
CREATE INDEX idx_rooms_expires_at ON rooms (expires_at)
    WHERE expires_at IS NOT NULL;

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,  -- SHA-256 of opaque refresh token
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
```

### Expiry Cleanup

Anonymous rooms with `expires_at < NOW()` can be cleaned up by a background goroutine polling every 15 minutes, or via a Postgres cron job (`pg_cron` if available). Phase 1 only needs the query; the scheduler can be a simple `time.NewTicker` in the Go server.

```sql
-- query: DeleteExpiredRooms
-- name: DeleteExpiredRooms :exec
DELETE FROM rooms WHERE expires_at IS NOT NULL AND expires_at < NOW();
```

### sqlc.yaml

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "query.sql"
    schema: "schema.sql"
    gen:
      go:
        package: "db"
        out: "internal/db"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: true
        emit_exact_table_names: false
```

---

## Common Pitfalls

### Pitfall 1: Slug Validation Race Condition

**What goes wrong:** Two concurrent requests for the same slug both pass the `SELECT ... WHERE slug = $1` uniqueness check and then both try to INSERT, causing a Postgres unique constraint violation that surfaces as an internal server error instead of a clean "name taken" response.
**Why it happens:** Read-then-write is not atomic. The check and insert are separate statements.
**How to avoid:** Use `INSERT INTO rooms ... ON CONFLICT (slug) DO NOTHING RETURNING id` and check whether a row was returned. If no row returned, the slug was taken — return 409 with the "This name is taken" message (D-03).
**Warning signs:** Intermittent 500s under load on room creation.

### Pitfall 2: JWT in httpOnly Cookie + CORS Interaction

**What goes wrong:** The frontend (Vercel) calling the Go API (VPS) is a cross-origin request. `credentials: 'include'` is required on the fetch call, and the CORS config must specify `AllowCredentials: true` AND an exact allowed origin (not `*`). Wildcard `*` with credentials is rejected by browsers.
**Why it happens:** CORS spec forbids `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`.
**How to avoid:** Set `AllowedOrigins: []string{cfg.FrontendURL}` (exact origin, from env var). Never use `*` in production CORS config.
**Warning signs:** `CORS error` in browser console; cookies not sent.

### Pitfall 3: Goose + pgx Pool Initialization Order

**What goes wrong:** Calling `stdlib.OpenDBFromPool(pool)` returns a `*sql.DB` that shares the pool's connections. If you close this `*sql.DB` (e.g., `defer db.Close()`), you also close the underlying pool, breaking all subsequent queries.
**Why it happens:** `OpenDBFromPool` wraps without copying; the `*sql.DB.Close()` propagates.
**How to avoid:** Do NOT call `db.Close()` on the `*sql.DB` returned by `stdlib.OpenDBFromPool`. Only close the `pgxpool.Pool` itself (and only on server shutdown).
**Warning signs:** "closed pool" errors on queries after the first request.

### Pitfall 4: OAuth State Cookie SameSite Misconfiguration

**What goes wrong:** OAuth callback returns the state in a query param. The browser must send the state cookie back in that same request. With `SameSite=Strict`, the cookie is NOT sent on the OAuth provider redirect (a cross-site navigation), so state verification fails.
**Why it happens:** `SameSite=Strict` blocks cookies on cross-site navigations including OAuth redirects.
**How to avoid:** Use `SameSite=Lax` for the state cookie. This allows the cookie to be sent on top-level cross-site navigations (like the OAuth callback redirect) but blocks CSRF via sub-resource requests.
**Warning signs:** OAuth login always fails with "invalid state" error.

### Pitfall 5: Anonymous Session Cookie Missing on OAuth Claim

**What goes wrong:** The anonymous room claiming (D-08) fails silently if the `anon_sid` cookie has expired or was never set. The user logs in via OAuth and their rooms don't transfer.
**Why it happens:** The cookie may have been cleared, or the user opened a new browser session after creating rooms.
**How to avoid:** Set the `anon_sid` cookie with `MaxAge: 7 * 24 * 3600` (7 days) instead of session-only. Log when claiming finds no rooms (not an error, just info). The D-08 spec says "same browser session" — make this robust by using a longer-lived cookie.
**Warning signs:** Users complain rooms disappeared after signing up.

### Pitfall 6: Rate Limiter Not Distinguishing Anonymous vs Authenticated

**What goes wrong:** Applying a single shared rate limiter to the room creation endpoint applies the anonymous limit (2/hour) to logged-in users too, or vice versa.
**Why it happens:** Single middleware with one limit applied to all requests.
**How to avoid:** Two separate chi middleware functions. The authenticated group gets the authed limiter (5/hour); the anonymous group gets the strict limiter (2/hour). Both are applied at the route group level, not globally.
**Warning signs:** Logged-in users hit the 2/hour cap; anonymous users can create 5/hour.

### Pitfall 7: Slug Validation — Leading/Trailing Hyphen Edge Cases

**What goes wrong:** The slug regex `^[a-z0-9-]+$` allows `--my-room--` or `-room` which is ugly and breaks the IRC-like URL feel.
**Why it happens:** Simple regex allows leading/trailing hyphens.
**How to avoid:** Use the exact constraint from D-02: slug must match `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$` (minimum 3 chars, no leading/trailing hyphens). Validate in the service layer AND enforce as a Postgres CHECK constraint.
**Warning signs:** Ugly room URLs in production.

---

## Code Examples

### Goose Embedded Migration Startup

```go
// Source: pressly/goose Provider docs (pressly.github.io/goose/documentation/provider/)
import (
    "embed"
    "io/fs"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/jackc/pgx/v5/stdlib"
    "github.com/pressly/goose/v3"
)

//go:embed internal/migrations/*.sql
var embeddedMigrations embed.FS

func runMigrations(pool *pgxpool.Pool) error {
    fsys, err := fs.Sub(embeddedMigrations, "internal/migrations")
    if err != nil {
        return fmt.Errorf("migrations sub: %w", err)
    }
    // Do NOT defer sqlDB.Close() — it would close the underlying pool
    sqlDB := stdlib.OpenDBFromPool(pool)
    provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, fsys)
    if err != nil {
        return fmt.Errorf("goose provider: %w", err)
    }
    results, err := provider.Up(context.Background())
    if err != nil {
        return fmt.Errorf("goose up: %w", err)
    }
    for _, r := range results {
        slog.Info("migration applied", "version", r.Source.Version, "duration", r.Duration)
    }
    return nil
}
```

### pgxpool Initialization

```go
// Source: pgx/v5 docs (pkg.go.dev/github.com/jackc/pgx/v5/pgxpool)
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
    config, err := pgxpool.ParseConfig(databaseURL)
    if err != nil {
        return nil, fmt.Errorf("parse pool config: %w", err)
    }
    config.MaxConns = 20
    config.MinConns = 2
    config.HealthCheckPeriod = 30 * time.Second
    pool, err := pgxpool.NewWithConfig(ctx, config)
    if err != nil {
        return nil, fmt.Errorf("create pool: %w", err)
    }
    if err := pool.Ping(ctx); err != nil {
        return nil, fmt.Errorf("pool ping: %w", err)
    }
    return pool, nil
}
```

### Config Struct (caarlos0/env)

```go
// Source: caarlos0/env/v11 docs
type Config struct {
    Port                 int    `env:"PORT" envDefault:"8080"`
    DatabaseURL          string `env:"DATABASE_URL,required"`
    JWTSecret            string `env:"JWT_SECRET,required"`
    GoogleClientID       string `env:"GOOGLE_CLIENT_ID,required"`
    GoogleClientSecret   string `env:"GOOGLE_CLIENT_SECRET,required"`
    GitHubClientID       string `env:"GITHUB_CLIENT_ID,required"`
    GitHubClientSecret   string `env:"GITHUB_CLIENT_SECRET,required"`
    FrontendURL          string `env:"FRONTEND_URL" envDefault:"http://localhost:3000"`
    BaseURL              string `env:"BASE_URL" envDefault:"http://localhost:8080"`
    AnonRoomLimitPerHour int    `env:"ANON_ROOM_LIMIT_PER_HOUR" envDefault:"2"`
    AuthedRoomLimitPerHour int  `env:"AUTHED_ROOM_LIMIT_PER_HOUR" envDefault:"5"`
}
```

### Room Creation (Service Layer)

```go
// Source: synthesis of patterns above
func (s *RoomService) CreatePublicRoom(ctx context.Context, displayName, anonSID string) (*Room, string, error) {
    slug := slugify(displayName)

    plainToken, tokenHash, err := token.GenerateRoomToken()
    if err != nil {
        return nil, "", err
    }

    expiresAt := pgtype.Timestamptz{
        Time:  time.Now().Add(3 * 24 * time.Hour),
        Valid: true,
    }

    row, err := s.q.CreateRoom(ctx, db.CreateRoomParams{
        Slug:               slug,
        DisplayName:        displayName,
        TokenHash:          tokenHash,
        AnonymousSessionID: pgtype.Text{String: anonSID, Valid: anonSID != ""},
        ExpiresAt:          expiresAt,
    })
    if err != nil {
        var pgErr *pgconn.PgError
        if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
            return nil, "", ErrSlugTaken
        }
        return nil, "", err
    }

    return toRoom(row), plainToken, nil
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| lib/pq Postgres driver | pgx/v5 pgxpool | lib/pq archived 2021 | 30-50% throughput improvement; pgxpool replaces manual connection management |
| gorilla/mux router | chi v5 | gorilla/mux abandoned 2022 | chi has zero deps, active maintenance, identical API surface |
| golang-jwt v3/v4 | golang-jwt/v5 | v5 released 2023 | Improved claim validation, cleaner API, no breaking changes from v4 |
| goose global state API | goose Provider API | goose v3.20+ | Avoids global state; supports multiple providers per process; embedded FS native |
| Manual JSON-RPC | a2a-go SDK | Phase 2 concern | Phase 1 doesn't touch A2A yet; important for Phase 2 planning |

**Deprecated/outdated:**
- `gorilla/sessions`: Revived but ecosystem moved on. Do not use for new code; manage cookies directly.
- `dgrijalva/jwt-go`: Archived with unpatched CVEs. Only `golang-jwt/jwt/v5` is safe.
- `goose.SetBaseFS() + goose.Up()`: Old global-state API. Use `goose.NewProvider()` instead.

---

## Recommendations for Claude's Discretion Items

### D-13: Bearer Token Format and Lifecycle

**Recommendation:** Opaque token, `qrm_` prefix, 32 bytes of `crypto/rand` base64url-encoded.
- Format: `qrm_<43 base64url chars>` (total ~47 chars)
- Storage: SHA-256 hash of the full string (not just the random part)
- Verification: re-hash on each request, constant-time compare with stored hash
- Lifecycle: One token per room. No automatic rotation (TOKR-01 is v2). Revocation by deleting the room or explicitly rotating (DELETE room, re-create).
- Why SHA-256 and not Argon2id: Tokens are 256-bit random — not guessable by brute force. Argon2id's 50-100ms latency would add unacceptable overhead on every A2A message. SHA-256 is appropriate here.

### D-11: A2A Message Rate Limits

**Recommendation:** 120 messages/minute per token per room (2/second sustained). This is generous for real multi-agent conversation (most agents send 1-5 messages/second at most) while preventing runaway loops. Implement as httprate limiter keyed on `Authorization` header value + room slug.

### D-12: Rate Limit Response Format for AI Agents

**Recommendation:** JSON body with machine-readable fields, `Retry-After` header in seconds.
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Slow down.",
  "retry_after": 60,
  "limit": 120,
  "window": "1m"
}
```
HTTP 429 with `Retry-After: 60` header. AI agents (including SDKs like a2a-go client) check `Retry-After` for backoff. The JSON body lets agents surface the error clearly in their logs.

---

## Open Questions

1. **Room slug generation from display names with non-ASCII characters**
   - What we know: D-02 specifies `[a-z0-9-]`, lowercase with hyphens.
   - What's unclear: What happens when a user types "Café Room" or "AI协作室"? Transliteration (using `golang.org/x/text/unicode/norm`) vs. error ("only ASCII characters allowed in room names")?
   - Recommendation: Simplest correct approach for v1 — strip non-ASCII, transliterate Latin diacritics, replace spaces with hyphens. If the result is empty or under 3 chars, return a validation error asking for a name with at least 3 ASCII characters.

2. **Anonymous session ID entropy vs. collision probability**
   - What we know: Using 16 random bytes (32 hex chars) for `anon_sid`.
   - What's unclear: Is this sufficient at scale? At 1M anon sessions, collision probability is ~2^-96, which is negligible.
   - Recommendation: 16 bytes is fine for v1 single-VPS scale.

3. **Refresh token rotation strategy**
   - What we know: D-09 specifies refresh token pattern for silent re-auth.
   - What's unclear: Rotate-on-use (each use issues a new refresh token, invalidating the old) vs. stationary (same token for 90 days). Rotate-on-use is more secure but has a race condition window.
   - Recommendation: Rotate on use for v1. Store `revoked_at` in the `refresh_tokens` table. On `/auth/refresh`, verify token is not revoked, issue new access JWT + new refresh token, mark old refresh token as revoked.

---

## Sources

### Primary (HIGH confidence)

- go-chi/httprate — v0.15.0 pkg.go.dev docs — LimitByIP, per-route limiter, 429 response customization, sliding window pattern
- pressly/goose Provider docs (pressly.github.io/goose/documentation/provider/) — embedded FS, pgx/v5 via stdlib.OpenDBFromPool, Provider API
- docs.sqlc.dev/en/stable/guides/using-go-and-pgx.html — sqlc.yaml pgx/v5 config, directory layout, generated code pattern
- golang.org/x/oauth2 pkg.go.dev — AuthCodeURL, Exchange, state parameter, offline access
- go-chi/jwtauth v5 pkg.go.dev — TokenFromHeader, TokenFromCookie, Verifier, Authenticator pattern
- golang-jwt/jwt/v5 pkg.go.dev — current version Jan 2026
- caarlos0/env/v11 — struct tag env parsing

### Secondary (MEDIUM confidence)

- oneuptime.com API key authentication guide (Jan 2026) — crypto/rand 32-byte token, SHA-256 hashed storage, constant-time comparison, verification flow
- go-pkgz/auth v2 GitHub — actively maintained OAuth2 multi-provider library (considered but not recommended for v1)
- SuperTokens anonymous session docs — session claiming pattern on OAuth login
- alexedwards.net/blog/working-with-cookies-in-go — httpOnly cookie secure attribute pattern for Go

### Tertiary (LOW confidence — needs validation)

- A2A message rate limit threshold (120/min) — derived from observed agent behavior patterns; should be tuned based on real usage data in Phase 3

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against pkg.go.dev and official docs as of 2026-03-22
- Architecture: HIGH — patterns verified against official library docs
- Database schema: HIGH — standard Postgres patterns; sqlc compatibility verified
- OAuth flow: HIGH — golang.org/x/oauth2 is canonical; state-cookie CSRF pattern is well-documented
- Pitfalls: HIGH — verified against known library behaviors and official documentation
- Rate limit thresholds: LOW — reasonable estimate, must be validated against real load

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days — libraries are stable, Go OAuth2 and chi APIs are mature)
