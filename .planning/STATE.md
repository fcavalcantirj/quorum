---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 02-a2a-core 02-01-PLAN.md — hub package, presence registry, agent_presence migration
last_updated: "2026-03-23T01:19:31.555Z"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 12
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Agents can join a room and talk to each other via A2A protocol with zero friction — one URL, one token, done.
**Current focus:** Phase 02 — a2a-core

## Current Position

Phase: 02 (a2a-core) — EXECUTING
Plan: 2 of 2

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P01 | 3 | 2 tasks | 10 files |
| Phase 01-foundation P02 | 7 | 2 tasks | 12 files |
| Phase 01-foundation P03 | 3 | 2 tasks | 7 files |
| Phase 01-foundation P04 | 7 | 2 tasks | 8 files |
| Phase 02-a2a-core P01 | 8 | 2 tasks | 13 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Go for relay server: performance, goroutine model maps to per-room fan-out, official a2a-go SDK
- Never accept bearer tokens in URL query strings — reject with 400 from day one (no recovery path after launch)
- MessageBus abstraction must be defined in Phase 1 even though only in-memory implementation ships in v1
- Use type-safe RoomID (type RoomID uuid.UUID) from Phase 2 to prevent cross-room contamination bugs
- [Phase 01-foundation]: Module path github.com/fcavalcanti/quorum/relay — user GitHub handle, not generic quorum
- [Phase 01-foundation]: OAuth env vars not required at startup — validated at route registration time
- [Phase 01-foundation]: Embed migrations via internal/migrations package (go:embed cannot use .. paths from cmd/server/)
- [Phase 01-foundation]: sqlc-generated files tracked in git — they are the compile-time schema contract
- [Phase 01-foundation]: stdlib.OpenDBFromPool result NOT closed — closing it closes the underlying pgxpool
- [Phase 01-foundation]: Import alias chimw for go-chi/chi/v5/middleware to avoid collision with internal middleware package
- [Phase 01-foundation]: chi v5.2.5 and go-chi/cors v1.2.2 were not in go.mod despite Plan 01 claiming — added via go get
- [Phase 01-foundation]: Graceful shutdown added to main.go with http.Server struct, SIGINT/SIGTERM handling, 30s shutdown timeout
- [Phase 01-foundation]: golang-jwt/v5 for signing and go-chi/jwtauth/v5 for verification coexist — compatible HS256 JWT wire format
- [Phase 01-foundation]: SameSiteLax (not Strict) for OAuth state cookie — Strict blocks OAuth redirect-back from provider
- [Phase 01-foundation]: Refresh token path-restricted to /auth/refresh — cookie not sent to other endpoints
- [Phase 02-a2a-core]: RoomHub owns subscriber map exclusively in goroutine (no external locks on that map); PresenceRegistry has its own RWMutex for concurrent reads
- [Phase 02-a2a-core]: Public card strips URL, Capabilities, SecuritySchemes to prevent leaking private agent endpoints to unauthenticated callers
- [Phase 02-a2a-core]: sqlc generate skipped due to Xcode license environment issue; generated code written manually matching sqlc v1.27.0 pgx/v5 output patterns

### Pending Todos

None yet.

### Blockers/Concerns

- a2a-go v0.3.12 AgentExecutor API surface is sparsely documented — plan a spike day during Phase 2 planning
- Hostinger VPS nginx SSE config (proxy_read_timeout, proxy_buffering off) needs validation in actual environment during Phase 3
- Room capacity limit (max SSE connections per room) should be validated against actual Hostinger VPS RAM/file descriptor limits before setting

## Session Continuity

Last session: 2026-03-23T01:19:31.552Z
Stopped at: Completed 02-a2a-core 02-01-PLAN.md — hub package, presence registry, agent_presence migration
Resume file: None
