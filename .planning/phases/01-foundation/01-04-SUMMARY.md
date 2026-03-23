---
phase: 01-foundation
plan: 04
subsystem: auth
tags: [go, oauth2, google, github, jwt, jwtauth, httprate, chi, cookies, rate-limiting]

requires:
  - phase: 01-foundation plan 01
    provides: Go relay module with golang-jwt/v5, go-chi/jwtauth/v5 in go.mod, caarlos0/env Config struct with OAuth env fields and JWTSecret
  - phase: 01-foundation plan 02
    provides: sqlc-generated db.Queries with UpsertUser, CreateRefreshToken, GetRefreshToken, RevokeRefreshToken, ClaimAnonymousRooms, DeleteRoom, UpdateRoom, ListRoomsByOwner
  - phase: 01-foundation plan 03
    provides: chi router with CORS/SIGTERM/BearerGuard, RoomService and RoomHandler scaffold, AnonSession middleware with GetAnonSessionID

provides:
  - Google and GitHub OAuth login flows with CSRF state cookie (SameSiteLax) and /dashboard redirect
  - JWT HS256 access tokens (30-day) issued as httpOnly cookies on OAuth callback
  - Refresh tokens (90-day, rotate-on-use) stored as SHA-256 hash in DB, path-restricted to /auth/refresh
  - Anonymous room claiming on OAuth login (D-08) — rooms created anonymously transfer to user account
  - AuthService: UpsertOAuthUser, CreateSession, CreateRefreshToken, RefreshSession, ClaimAnonymousRooms, Logout, GetUserByID
  - JWTAuth middleware wrapping go-chi/jwtauth/v5 (NewJWTAuth, UserIDFromContext)
  - AuthHandler: GoogleLogin, GoogleCallback, GitHubLogin, GitHubCallback, Logout, RefreshToken, Me
  - RoomService additions: CreatePrivateRoom (is_private=true, no expiry), DeleteRoom, UpdateRoom (owner check), ListRoomsByOwner, GetRoomByID
  - RoomHandler additions: CreatePrivateRoom (201), DeleteRoom (204), UpdateRoom (PATCH), ListMyRooms
  - Two-tier rate limiting: 2/hour anon, 5/hour authed — JSON 429 with error/message/retry_after/limit/window fields
  - Complete chi router with jwtauth.Verifier+Authenticator protecting /rooms/private, /rooms/{slug} DELETE+PATCH, /auth/me, /me/rooms

affects:
  - 02-a2a-core (A2A message routing: will use same chi router, same JWT context extraction pattern)
  - 03-streaming-deploy (SSE auth: same JWT cookie pattern applies to SSE connections)
  - 04-frontend-integration (Frontend consumes OAuth endpoints, reads jwt cookie, calls /auth/me)

tech-stack:
  added:
    - github.com/golang-jwt/jwt/v5 v5.3.1 (JWT signing with HS256)
    - github.com/go-chi/jwtauth/v5 v5.4.0 (JWT verification middleware for chi)
    - github.com/go-chi/httprate v0.15.0 (per-IP rate limiting)
    - golang.org/x/oauth2 v0.36.0 (OAuth2 client for Google and GitHub)
    - golang.org/x/oauth2/google (Google OAuth endpoint)
    - golang.org/x/oauth2/github (GitHub OAuth endpoint)
    - cloud.google.com/go/compute/metadata v0.3.0 (transitive dep of oauth2/google)
  patterns:
    - "AuthService pattern: wraps db.Queries, signs JWTs with golang-jwt/v5, hashes refresh tokens with token.HashToken"
    - "OAuth callback pattern: validate state cookie -> exchange code -> fetch userinfo -> UpsertUser -> ClaimAnonymousRooms -> set jwt + refresh_token cookies -> redirect to frontend"
    - "Owner check pattern: GetRoomByID -> compare OwnerID.Bytes == userID.Bytes -> ErrNotRoomOwner -> 403"
    - "Rate limiter pattern: httprate.Limit with WithLimitHandler returning JSON 429 including retry_after, limit, window fields"
    - "JWT context extraction: mw.UserIDFromContext(ctx) -> pgtype.UUID.Scan(str) -> service call"

key-files:
  created:
    - relay/internal/service/auth.go
    - relay/internal/middleware/jwtauth.go
    - relay/internal/handler/auth.go
  modified:
    - relay/internal/service/room.go
    - relay/internal/handler/room.go
    - relay/cmd/server/main.go
    - relay/go.mod
    - relay/go.sum

key-decisions:
  - "github.com/golang-jwt/jwt/v5 used for JWT signing in AuthService; go-chi/jwtauth/v5 used for verification middleware — both handle standard HS256 JWTs, same wire format, compatible"
  - "pgtype.UUID.Scan(string) used to parse UUID strings from JWT sub claims — cleaner than manual byte parsing"
  - "GitHub /user/emails fallback added — GitHub may return null email from /user endpoint; email fetched from /user/emails, falling back to <login>@users.noreply.github.com synthetic address"
  - "Anonymous room claiming is non-fatal — ClaimAnonymousRooms errors are logged but do not abort the OAuth callback"
  - "pgUUIDFromStr helper added to room service for cleaner UUID parsing in authenticated handlers"
  - "golang.org/x/oauth2/google requires cloud.google.com/go/compute/metadata — added via go get (transitive dep)"

patterns-established:
  - "SameSiteLax (not Strict) for OAuth state cookie — Strict blocks the OAuth redirect-back from provider (Pitfall 4)"
  - "Refresh token path restriction: Path=/auth/refresh — cookie not sent to other endpoints, reducing exposure"
  - "JWT middleware group: jwtauth.Verifier(tokenAuth) + jwtauth.Authenticator(tokenAuth) applied to chi sub-group"
  - "Rate limit JSON format: {error, message, retry_after (int), limit (int), window (string)}"

requirements-completed: [AUTH-04, AUTH-05, AUTH-06, AUTH-07, INFRA-05, ROOM-02, ROOM-04, ROOM-05]

duration: 7min
completed: "2026-03-23"
---

# Phase 01 Plan 04: OAuth Auth, JWT Sessions, Rate Limiting, and Authenticated Room Operations Summary

**Google and GitHub OAuth with 30-day HS256 JWT access tokens, 90-day rotate-on-use refresh tokens, httpOnly SameSiteLax cookies, anonymous room claiming, two-tier rate limiting (2/h anon, 5/h authed), and complete Phase 1 chi router**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-23T00:51:50Z
- **Completed:** 2026-03-23T00:58:59Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Complete OAuth login for Google and GitHub: CSRF state cookie (SameSiteLax), code exchange, userinfo fetch, UpsertUser, anonymous room claiming (D-08), JWT + refresh token cookies, /dashboard redirect
- JWT session management: 30-day HS256 tokens signed with golang-jwt/v5, verified by go-chi/jwtauth/v5 middleware; 90-day refresh tokens with rotate-on-use via SHA-256 hash in DB; /auth/refresh endpoint swaps old refresh for new pair
- Two-tier rate limiting: 2/hour for anonymous POST /rooms, 5/hour for authenticated POST /rooms/private — both return JSON 429 with error/message/retry_after/limit/window fields
- Authenticated room operations: CreatePrivateRoom (is_private=true, no expiry), DeleteRoom (owner check -> 403 or 204), UpdateRoom (PATCH, slug immutable per ROOM-06), ListMyRooms (/me/rooms)
- Complete Phase 1 chi router with all route groups wired: public OAuth routes, AnonSession+rate-limited POST /rooms, jwtauth-protected group for /rooms/private, /rooms/{slug} DELETE+PATCH, /auth/me, /me/rooms

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth service, JWT middleware, OAuth handlers** - `2d2f7db` (feat)
2. **Task 2: Authenticated room ops, rate limiting, complete router** - `a7b4d65` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `relay/internal/service/auth.go` - AuthService: UpsertOAuthUser, CreateSession (30-day JWT), CreateRefreshToken (90-day), RefreshSession (rotate-on-use), ClaimAnonymousRooms, Logout, GetUserByID
- `relay/internal/middleware/jwtauth.go` - NewJWTAuth (HS256 jwtauth.JWTAuth), UserIDFromContext (extracts sub claim)
- `relay/internal/handler/auth.go` - AuthHandler: GoogleLogin/Callback, GitHubLogin/Callback (CSRF state, email fallback), Logout, RefreshToken, Me
- `relay/internal/service/room.go` - Added CreatePrivateRoom, DeleteRoom, UpdateRoom (owner check), ListRoomsByOwner, GetRoomByID; pgUUIDFromStr helper
- `relay/internal/handler/room.go` - Added CreatePrivateRoom, DeleteRoom, UpdateRoom, ListMyRooms; parseUserUUID helper
- `relay/cmd/server/main.go` - Complete router: OAuth routes, AnonSession+rate-limited group, jwtauth-protected group, all authenticated endpoints
- `relay/go.mod` / `relay/go.sum` - Added golang-jwt/v5, jwtauth/v5, httprate, oauth2, oauth2/google, oauth2/github, cloud.google.com/go/compute/metadata

## Decisions Made

- **Two JWT libraries coexist**: golang-jwt/v5 signs tokens in AuthService (idiomatic Go JWT signing); go-chi/jwtauth/v5 (backed by lestrrat-go/jwx/v3) verifies them in middleware. Both operate on standard HS256 JWT wire format — compatible by design.
- **pgtype.UUID.Scan**: Used to parse UUID strings from JWT sub claims throughout handlers — cleaner than manual byte parsing, leverages pgtype's built-in UUID validation.
- **GitHub email fallback chain**: /user -> /user/emails (primary+verified) -> any verified -> synthetic `<login>@users.noreply.github.com`. Ensures UpsertUser always has a non-empty email.
- **ClaimAnonymousRooms non-fatal**: Errors during room claiming are swallowed in the OAuth callback — the login succeeds regardless. Room claiming failure is an edge case (concurrent login, race with expiry) that should not abort user login.
- **golang.org/x/oauth2/google transitive dep**: `cloud.google.com/go/compute/metadata` pulled in automatically — added to go.sum via `go get golang.org/x/oauth2/google@v0.36.0`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing OAuth and JWT packages to go.mod**
- **Found during:** Task 1 (creating auth service)
- **Issue:** go.mod was missing golang-jwt/v5, go-chi/jwtauth/v5, go-chi/httprate, and golang.org/x/oauth2 despite Plan 01 claiming they were installed.
- **Fix:** `go get` each package individually: golang-jwt/v5, jwtauth/v5, httprate, oauth2, then `go get golang.org/x/oauth2/google@v0.36.0` for the transitive cloud.google.com dep.
- **Files modified:** relay/go.mod, relay/go.sum
- **Verification:** `go build ./...` exits 0 after each addition
- **Committed in:** `2d2f7db` and `a7b4d65` (split across tasks)

**2. [Rule 2 - Missing Critical] Added GetUserByID to AuthService**
- **Found during:** Task 1 (implementing /auth/me handler)
- **Issue:** Plan specified the /auth/me handler should call `queries.GetUserByID` but the handler would need to import the `db` package directly, coupling the handler to the DB layer. Good separation requires the service to own all DB access.
- **Fix:** Added `GetUserByID(ctx, pgtype.UUID) (*db.User, error)` method to AuthService, called from AuthHandler.Me via `h.svc.GetUserByID`.
- **Files modified:** relay/internal/service/auth.go (new method), relay/internal/handler/auth.go (calls svc.GetUserByID)
- **Verification:** `go build ./internal/service/ && go build ./internal/handler/` exits 0
- **Committed in:** `2d2f7db` (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added GetRoomByID to RoomService for delete/update operations**
- **Found during:** Task 2 (implementing DeleteRoom and UpdateRoom)
- **Issue:** Delete and Update handlers need to resolve slug to room ID and verify ownership. GetRoomBySlug returns the full room; we need GetRoomByID for the service layer's owner check. Added both to service to avoid DB-layer leakage into handlers.
- **Fix:** Added `GetRoomByID(ctx, pgtype.UUID) (*db.Room, error)` to RoomService. Handlers resolve slug via GetRoomBySlug, then pass room.ID to service for delete/update.
- **Files modified:** relay/internal/service/room.go (new method)
- **Verification:** `go build ./internal/service/` exits 0
- **Committed in:** `a7b4d65` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking — missing packages, 2 missing critical — service layer completeness)
**Impact on plan:** All fixes necessary for correctness and clean separation. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

**External OAuth services require manual configuration before the OAuth login flows work.** Environment variables needed:

| Variable | Source |
|----------|--------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Same location |
| `GITHUB_CLIENT_ID` | GitHub Settings -> Developer settings -> OAuth Apps |
| `GITHUB_CLIENT_SECRET` | Same location |

Dashboard configuration:
- Google: Add authorized redirect URI: `{BASE_URL}/auth/google/callback`
- GitHub: Set Authorization callback URL: `{BASE_URL}/auth/github/callback`

These env vars have `envDefault:""` — server starts without them, but OAuth routes will fail at runtime (exchange step returns error). JWT_SECRET remains required at startup.

## Next Phase Readiness

- `go build ./...` passes — complete Phase 1 API is compilable
- All Phase 1 endpoints implemented and wired: POST /rooms, GET /rooms, GET /rooms/{slug}, POST /rooms/private, DELETE /rooms/{slug}, PATCH /rooms/{slug}, GET /auth/me, GET /me/rooms, GET /auth/google/login, GET /auth/github/login, POST /auth/logout, POST /auth/refresh
- Phase 2 (A2A core) can mount A2A handlers on /r/{slug}/a2a on the same chi router
- JWT context extraction pattern (mw.UserIDFromContext) is established for A2A auth in Phase 2
- AnonSession middleware remains available for future public A2A endpoints

---
*Phase: 01-foundation*
*Completed: 2026-03-23*

## Self-Check: PASSED

All created files verified present on disk. Task commits 2d2f7db and a7b4d65 verified in git log. `go build ./...` exits 0.
