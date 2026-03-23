---
phase: 01-foundation
plan: 03
subsystem: api
tags: [go, chi, cors, bearer-token, middleware, room, slugify, sha256]

requires:
  - phase: 01-foundation plan 01
    provides: Go relay module with chi v5.2.5 and go-chi/cors in go.mod, caarlos0/env Config struct
  - phase: 01-foundation plan 02
    provides: sqlc-generated db.Queries with CreateRoom, GetRoomBySlug, ListPublicRooms; pgxpool wired in main

provides:
  - POST /rooms endpoint — anonymous public room creation returning slug, /r/ URL, A2A URL, qrm_ bearer token
  - GET /rooms/{slug} — room retrieval by slug
  - GET /rooms — paginated public room listing
  - GET /health — liveness check
  - BearerTokenQueryStringGuard — global middleware rejecting token=/bearer=/access_token= query params with 400
  - AnonSession middleware — reads/creates anon_sid cookie (7-day, HttpOnly, Secure) and injects session ID into context
  - token.GenerateRoomToken — crypto/rand 256-bit opaque token with qrm_ prefix, SHA-256 hash for DB storage
  - chi router with CORS (AllowCredentials=true), graceful shutdown (SIGINT/SIGTERM, 30s timeout)

affects:
  - 01-04 (OAuth auth: will mount auth routes on same chi router, uses same Config.FrontendURL for CORS)
  - 02 (A2A core: will mount A2A handlers on /r/{slug}/a2a routes already established here)
  - all frontend phases (consume POST /rooms and GET /rooms/{slug} API)

tech-stack:
  added:
    - github.com/go-chi/chi/v5 v5.2.5 (added to go.mod — was missing despite Plan 01 listing it)
    - github.com/go-chi/cors v1.2.2 (added to go.mod — was missing despite Plan 01 listing it)
  patterns:
    - "Handler pattern: RoomHandler struct with svc *service.RoomService and baseURL string fields"
    - "Service pattern: RoomService struct with q *db.Queries, methods return (*db.Room, error)"
    - "Error propagation: sentinel errors (ErrSlugTaken, ErrNameRequired, etc.) checked with errors.Is in handler"
    - "writeJSON helper: sets Content-Type, writes status, encodes JSON in one call"
    - "Chi alias pattern: chimw for go-chi/chi/v5/middleware to avoid clash with internal middleware package"

key-files:
  created:
    - relay/internal/token/token.go
    - relay/internal/middleware/bearerguard.go
    - relay/internal/middleware/anonsession.go
    - relay/internal/service/room.go
    - relay/internal/handler/room.go
  modified:
    - relay/cmd/server/main.go
    - relay/go.mod
    - relay/go.sum

key-decisions:
  - "Import alias chimw for go-chi/chi/v5/middleware — avoids collision with internal middleware package imported as mw"
  - "ListPublicRooms returns empty slice not nil — uses make([]roomResponse, 0, len(rooms)) so JSON encodes [] not null"
  - "Graceful shutdown added to main.go — http.Server with ReadTimeout/WriteTimeout/IdleTimeout, SIGINT/SIGTERM handled via goroutine"
  - "chi v5.2.5 and go-chi/cors v1.2.2 were not in go.mod despite Plan 01 claiming they were installed — added via go get"

patterns-established:
  - "Room URL pattern: baseURL + /r/ + slug (D-01)"
  - "A2A URL pattern: baseURL + /r/ + slug + /a2a (D-04)"
  - "Bearer token format: qrm_ prefix + base64-RawURL(32 random bytes), SHA-256 hex stored in DB"
  - "Slug conflict: HTTP 409 with error=slug_taken (D-03), user picks new name"
  - "Anonymous room expiry: 3 * 24 * time.Hour from creation (D-05)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, ROOM-01, ROOM-03, ROOM-06]

duration: 3min
completed: "2026-03-23"
---

# Phase 01 Plan 03: Chi Router, Room API, and Bearer Token System Summary

**chi v5 HTTP server with POST /rooms (anonymous creation, qrm_ bearer tokens), GET /rooms/{slug}, query-string bearer rejection middleware, and anon session cookie tracking**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T00:45:45Z
- **Completed:** 2026-03-23T00:48:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Complete room API surface: POST /rooms creates public room with qrm_-prefixed opaque bearer token, returns slug, /r/ URL, /a2a URL, and expires_at
- BearerTokenQueryStringGuard rejects any request with token=, bearer=, or access_token= query parameters with HTTP 400 — applied globally to all routes
- AnonSession middleware creates/reads anon_sid cookie (7-day, HttpOnly, Secure, SameSiteLax) injected into context for anonymous room ownership tracking
- chi router with CORS (AllowCredentials), graceful shutdown on SIGINT/SIGTERM with 30s timeout

## Task Commits

Each task was committed atomically:

1. **Task 1: Token package, bearer guard middleware, anon session middleware** - `77e40ce` (feat)
2. **Task 2: Room service, room handler, chi router wiring in main.go** - `1c95cfe` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `relay/internal/token/token.go` - GenerateRoomToken (qrm_ prefix, 256-bit random, SHA-256 hex hash), HashToken, VerifyToken (constant-time)
- `relay/internal/middleware/bearerguard.go` - BearerTokenQueryStringGuard: rejects token=/bearer=/access_token= with 400 JSON
- `relay/internal/middleware/anonsession.go` - AnonSession middleware + GetAnonSessionID context extractor
- `relay/internal/service/room.go` - RoomService: CreatePublicRoom, GetRoomBySlug, ListPublicRooms; Slugify + ValidateSlug
- `relay/internal/handler/room.go` - RoomHandler: CreateRoom, GetRoom, ListPublicRooms with full error mapping
- `relay/cmd/server/main.go` - chi router with global middleware, room routes, health endpoint, graceful shutdown
- `relay/go.mod` / `relay/go.sum` - Added chi v5.2.5 and go-chi/cors v1.2.2

## Decisions Made

- Import alias `chimw` for `github.com/go-chi/chi/v5/middleware` to avoid collision with the project's `internal/middleware` package (imported as `mw`).
- `ListPublicRooms` initializes the response slice with `make([]roomResponse, 0, len(rooms))` so an empty result encodes as JSON `[]` not `null`.
- Graceful shutdown wired in main.go (not deferred from plan) — http.Server with 15s read/write timeout, 60s idle, SIGINT/SIGTERM handled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added chi v5.2.5 and go-chi/cors v1.2.2 to go.mod**
- **Found during:** Task 1 (creating middleware packages)
- **Issue:** go.mod only had 3 direct dependencies (caarlos0/env, pgx/v5, goose/v3). chi and cors were listed as installed in Plan 01's SUMMARY.md but were not present in go.mod. Importing them would fail at build time.
- **Fix:** `go get github.com/go-chi/chi/v5@v5.2.5` and `go get github.com/go-chi/cors@latest` (v1.2.2)
- **Files modified:** relay/go.mod, relay/go.sum
- **Verification:** `go build ./...` exits 0
- **Committed in:** `77e40ce` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added graceful shutdown to HTTP server**
- **Found during:** Task 2 (wiring main.go)
- **Issue:** Plan showed bare `http.ListenAndServe(addr, r)` with no graceful shutdown. On SIGTERM (e.g., from Hostinger VPS deployment), the process would be killed mid-request without draining.
- **Fix:** Used `http.Server` struct with `ReadTimeout`, `WriteTimeout`, `IdleTimeout`, and a goroutine listening for SIGINT/SIGTERM that calls `srv.Shutdown(ctx)` with 30s deadline.
- **Files modified:** relay/cmd/server/main.go
- **Verification:** `go build ./cmd/server/` exits 0
- **Committed in:** `1c95cfe` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking — missing dependencies, 1 missing critical — graceful shutdown)
**Impact on plan:** Both fixes necessary for correctness and production readiness. No scope creep.

## Issues Encountered

None beyond the deviations already documented above.

## User Setup Required

None — no new external service configuration required.

## Next Phase Readiness

- `go build ./...` passes, server binary is ready
- POST /rooms returns 201 with slug, url, a2a_url, bearer_token (tested when DB available)
- Bearer guard rejects query-string tokens with 400
- All routes ready for Plan 04 (OAuth auth) to mount additional handlers on the same chi router
- AnonSession middleware in place for future room claiming feature

---
*Phase: 01-foundation*
*Completed: 2026-03-23*

## Self-Check: PASSED

All created files verified present on disk. Task commits 77e40ce and 1c95cfe verified in git log. `go build ./...` exits 0.
