---
phase: 02-a2a-core
plan: 02
subsystem: relay-handler
tags: [a2a, executor, discovery, presence, reaper, bearer-auth, json-rpc, agent-card]
dependency_graph:
  requires:
    - relay/internal/hub (RoomHub, PresenceRegistry, HubManager, RoomEvent, RoomID — Phase 02-01)
    - relay/internal/db (queries, models — Phase 01 + 02-01)
    - relay/internal/token (VerifyToken — Phase 01)
    - relay/internal/middleware (BearerTokenQueryStringGuard — Phase 01)
    - github.com/a2aproject/a2a-go v0.3.12 (AgentExecutor, RequestContext, eventqueue.Queue)
  provides:
    - relay/internal/relay (RoomExecutor, MountA2ARoutes, BuildRoomRelayCard)
    - relay/internal/middleware.A2AVersionGuard
    - relay/internal/handler.DiscoveryHandler (JoinRoom, ListAgents, GetAgentCard, RoomInfo, Heartbeat)
    - relay/internal/handler.AgentHandler (GlobalDirectory)
    - relay/internal/presence.StartReaper
  affects:
    - relay/cmd/server/main.go (wired: registry, hubMgr, discoveryH, agentH, reaper, A2A routes)
    - Phase 03 SSE streaming (will use hub.Events() channel exposed by RoomHub)
tech_stack:
  added: []
  patterns:
    - Dynamic per-request A2A handler: single chi route resolves room from {slug} URL param per request
    - TDD flow: RED (failing tests) -> GREEN (implement) for both tasks
    - Root context cancellation propagated to hub goroutines and reaper on graceful shutdown
    - Compile-time interface satisfaction: var _ a2asrv.AgentExecutor = (*RoomExecutor)(nil)
    - StatusUpdateEvent.Final = true: signals SDK to stop task processing
key_files:
  created:
    - relay/internal/middleware/a2aversion.go
    - relay/internal/relay/executor.go
    - relay/internal/relay/handler.go
    - relay/internal/relay/executor_test.go
    - relay/internal/handler/discovery.go
    - relay/internal/handler/agent.go
    - relay/internal/handler/discovery_test.go
    - relay/internal/presence/reaper.go
  modified:
    - relay/cmd/server/main.go (hub, discovery, reaper wiring; root context cancellation)
decisions:
  - "Single dynamic A2A handler per-request instead of per-room registration avoids dynamic route manipulation"
  - "StatusUpdateEvent.Final=true required to signal SDK task completion — without it SDK waits forever"
  - "a2a.TextPart{Text: ...} struct literal (not NewTextPart function — that doesn't exist in SDK v0.3.12)"
  - "Root context created in main() with cancelCtx() — cancelled on SIGINT/SIGTERM before HTTP shutdown"
  - "Discovery handler tests use in-memory registry directly without DB to avoid test infrastructure dependency"
  - "Presence reaper runReaperCycle extracted from StartReaper goroutine for testability"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-23"
  tasks_completed: 2
  files_created: 8
  files_modified: 1
---

# Phase 02 Plan 02: A2A Handler, Discovery Endpoints, and Presence Reaper Summary

RoomExecutor implementing a2asrv.AgentExecutor for message fanout via hub broadcast; A2AVersionGuard middleware rejecting non-1.0 requests with JSON-RPC -32001; dynamic single-handler A2A routing; 5 discovery REST endpoints with bearer auth enforcement; global agent directory with card_json deserialization; background presence reaper with DB-driven TTL eviction.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | RoomExecutor, A2AVersionGuard, MountA2ARoutes, executor_test | 2595d3d | executor.go, handler.go, a2aversion.go, executor_test.go |
| 2 | Discovery endpoints, AgentHandler, StartReaper, main.go wiring, discovery_test | 5267988 | discovery.go, agent.go, reaper.go, discovery_test.go, main.go |

## What Was Built

### Task 1: A2A Protocol Layer (`relay/internal/relay/`, `relay/internal/middleware/`)

**a2aversion.go** — `A2AVersionGuard` middleware checks the `A2A-Version` header on every request to `/r/{slug}/a2a`. Missing or non-"1.0" values return a JSON-RPC 2.0 error with code `-32001` (VersionNotSupportedError) and HTTP 400.

**executor.go** — `RoomExecutor` implements `a2asrv.AgentExecutor`:
- `Execute`: extracts the A2A message from `RequestContext`, broadcasts a `hub.RoomEvent{Type: EventMessage}` to all room subscribers via `Hub.Broadcast`, then writes a `TaskStateCompleted` status event to the queue with `Final=true`.
- `Cancel`: writes a `TaskStateCanceled` status event with `Final=true`.
- Compile-time assertion: `var _ a2asrv.AgentExecutor = (*RoomExecutor)(nil)`.

**handler.go** — `MountA2ARoutes` registers two routes on a chi router:
- `POST /r/{slug}/a2a/*` — A2AVersionGuard middleware + dynamic per-request room resolution (slug → DB → RoomHub → RoomExecutor → `a2asrv.NewHandler` → `a2asrv.NewJSONRPCHandler`).
- `GET /r/{slug}/.well-known/agent-card.json` — returns the room's relay AgentCard per DISC-05 (public, no auth). `BuildRoomRelayCard` is exported for testability.

**executor_test.go** — 7 tests:
- A2AVersionGuard: missing header → 400 + -32001; wrong version → 400 + -32001; correct version → passes to next.
- RoomExecutor: Execute broadcasts EventMessage and returns nil; Cancel returns nil without error.
- Route structure: A2AVersionGuard fires before nil-queries handler; `.well-known/agent-card.json` route matched by chi.

### Task 2: Discovery REST Endpoints, Global Directory, Presence Reaper

**discovery.go** — `DiscoveryHandler` with 5 methods:
- `JoinRoom` (POST `/r/{slug}/join`): validates bearer token (AUTH-01), decodes Agent Card JSON, validates card.Name, calls `hub.Subscribe` + DB `UpsertAgentPresence`, updates `last_active_at`. Returns `{"status":"joined","agent_name":"...","room_slug":"..."}`.
- `ListAgents` (GET `/r/{slug}/agents`): returns public cards from in-memory registry. Supports `?skill=` (filters on `AgentSkill.ID`) and `?tag=` (filters on `AgentSkill.Tags`). Always returns array, never null.
- `GetAgentCard` (GET `/r/{slug}/agents/{name}`): returns public card without bearer; full extended card with valid bearer (DISC-06/07 two-tier card).
- `RoomInfo` (GET `/r/{slug}/info`): returns slug, display_name, description, tags, is_private, created_at, agent_count, agents array.
- `Heartbeat` (POST `/r/{slug}/heartbeat`): requires `agent_name` in body, refreshes in-memory `LastSeen` + DB `last_seen`, updates room `last_active_at`. Returns 204.

**agent.go** — `AgentHandler.GlobalDirectory` (GET `/agents`): calls `ListAllPublicAgentPresence` (SQL JOIN excludes `is_private=TRUE` rooms), deserializes `card_json` bytes to `AgentCard` structs, applies `?skill=` (AgentSkill.ID) or `?tag=` (case-insensitive) filters. Skips agents with malformed JSON with a warning log.

**reaper.go** — `StartReaper` launches a background goroutine running every 60 seconds:
1. `queries.DeleteExpiredAgentPresence(ctx)` atomically removes rows where `last_seen < NOW() - ttl_seconds`.
2. For each evicted row: `registry.Remove(roomID, agentName)` then `hub.Unsubscribe(agentName)` (emits `agent_left` event to remaining subscribers).
3. Exits when ctx is canceled (on graceful shutdown).

**main.go** changes:
- `ctx, cancelCtx := context.WithCancel(context.Background())` — root context used by hub goroutines and reaper.
- `cancelCtx()` called on SIGINT/SIGTERM before `srv.Shutdown`.
- Creates `PresenceRegistry`, `HubManager`.
- Creates `DiscoveryHandler` and `AgentHandler`.
- Calls `presence.StartReaper` before server starts.
- Calls `relay.MountA2ARoutes` for A2A + relay card routes.
- Registers all discovery routes.

**discovery_test.go** — 12 tests covering: AUTH-01 (no header → 401, wrong token → 401), agents list all + skill filter + tag filter, agent card public vs extended, room info agent count, heartbeat last_seen update, global directory card_json deserialization and skill filter, reaper remove-from-registry, card_json round-trip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TextPart struct literal, not NewTextPart function**
- **Found during:** Task 1 implementation
- **Issue:** Plan code used `a2a.NewTextPart("message relayed")` but SDK v0.3.12 exports `TextPart{Text: "..."}` struct literal — there is no `NewTextPart` constructor in this version.
- **Fix:** Used `a2a.TextPart{Text: "message relayed"}` in `executor.go`.
- **Files modified:** `relay/internal/relay/executor.go`
- **Commit:** 2595d3d

**2. [Rule 1 - Bug] StatusUpdateEvent.Final=true required for task completion**
- **Found during:** Task 1 implementation
- **Issue:** Without `Final=true`, the SDK's `handleSendMessage` loop waits for more events forever. The plan didn't explicitly set `Final`.
- **Fix:** Set `statusEvt.Final = true` on both Execute and Cancel status events.
- **Files modified:** `relay/internal/relay/executor.go`
- **Commit:** 2595d3d

**3. [Rule 1 - Bug] eventqueue.NewInMemory() does not exist in SDK**
- **Found during:** Task 1 test writing (RED phase)
- **Issue:** Test used `eventqueue.NewInMemory()` but SDK only exports `eventqueue.NewInMemoryManager()` which returns a `Manager`, not a `Queue`. A `Queue` must be obtained via `mgr.GetOrCreate(ctx, taskID)`.
- **Fix:** Added `newTestQueue` helper in executor_test.go using `eventqueue.NewInMemoryManager()` + `GetOrCreate`.
- **Files modified:** `relay/internal/relay/executor_test.go`
- **Commit:** 2595d3d

**4. [Rule 1 - Bug] nil logger panic in RoomHub goroutine**
- **Found during:** Task 1 test execution (GREEN phase)
- **Issue:** `NewRoomHub` with `nil` logger panics in `Run()` when it calls `h.logger.Debug(...)`.
- **Fix:** Passed `slog.Default()` to `NewRoomHub` in tests.
- **Files modified:** `relay/internal/relay/executor_test.go`
- **Commit:** 2595d3d

**5. [Rule 1 - Bug] hub.Broadcast is async — test needed timeout**
- **Found during:** Task 1 test execution
- **Issue:** `TestRoomExecutor_Execute_BroadcastsMessage` used `default:` in select which always fired before the hub goroutine processed the broadcast.
- **Fix:** Changed to `case <-time.After(500ms)` to wait for hub goroutine.
- **Files modified:** `relay/internal/relay/executor_test.go`
- **Commit:** 2595d3d

**6. [Rule 2 - Missing Critical Functionality] root context cancelled on shutdown**
- **Found during:** Task 2 main.go wiring
- **Issue:** Plan showed wiring hub + reaper but original `ctx := context.Background()` was not cancellable. Hub goroutines and reaper would leak on server shutdown.
- **Fix:** Changed to `ctx, cancelCtx := context.WithCancel(context.Background())` with `cancelCtx()` called in shutdown goroutine before `srv.Shutdown`.
- **Files modified:** `relay/cmd/server/main.go`
- **Commit:** 5267988

## Known Stubs

None. All code is fully implemented. Hub subscription in JoinRoom is wired to a real hub goroutine. Discovery endpoints call real DB queries. Reaper calls real DB `DeleteExpiredAgentPresence`. No mock data flows to any endpoint.

The DB queries in JoinRoom, Heartbeat, and GlobalDirectory will only work with a running Postgres instance (expected for production deployment — Phase 01 wired the migrations).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| relay/internal/middleware/a2aversion.go | FOUND |
| relay/internal/relay/executor.go | FOUND |
| relay/internal/relay/handler.go | FOUND |
| relay/internal/relay/executor_test.go | FOUND |
| relay/internal/handler/discovery.go | FOUND |
| relay/internal/handler/agent.go | FOUND |
| relay/internal/handler/discovery_test.go | FOUND |
| relay/internal/presence/reaper.go | FOUND |
| relay/cmd/server/main.go (modified) | FOUND |
| Commit 2595d3d (Task 1) | FOUND |
| Commit 5267988 (Task 2) | FOUND |
| go build ./... | PASSED |
| go test -race ./... | PASSED |
| go vet ./... | PASSED |
