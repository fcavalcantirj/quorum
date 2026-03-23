---
phase: 03-streaming-deploy
plan: 01
subsystem: sse-streaming
tags: [sse, streaming, heartbeat, goroutine-leak, connection-limits, traefik, goleak, a2a]
dependency_graph:
  requires:
    - relay/internal/hub (RoomHub, HubManager — Phase 02-01)
    - relay/internal/relay (MountA2ARoutes — Phase 02-02)
    - relay/internal/config (Config — Phase 01)
    - github.com/a2aproject/a2a-go v0.3.12 (WithKeepAlive option on NewJSONRPCHandler)
  provides:
    - SSE keep-alive heartbeat every 20s (A2A-03 compliant, via SDK WithKeepAlive)
    - X-Accel-Buffering: no middleware for Traefik SSE passthrough
    - Per-room SSE connection limits with ErrRoomAtCapacity sentinel
    - goleak-verified zero goroutine leaks after subscriber disconnect
  affects:
    - relay/internal/relay/handler.go (WithKeepAlive + SSENoBuffering applied)
    - relay/internal/hub/hub.go (sseCount atomic counter, limit enforcement)
    - relay/internal/hub/manager.go (maxSSEPerRoom propagated to new hubs)
    - relay/cmd/server/main.go (cfg.MaxSSEPerRoom passed to NewHubManager)
tech_stack:
  added:
    - go.uber.org/goleak v1.3.0 (goroutine leak detection in hub tests)
  patterns:
    - SDK-native SSE with a2asrv.WithKeepAlive on NewJSONRPCHandler
    - Chi middleware for cross-cutting SSE header (SSENoBuffering)
    - Atomic counter (atomic.Int32) for lock-free SSE connection tracking
    - TDD flow: RED (failing tests) -> GREEN (implementation) for Task 2
    - goleak.VerifyTestMain in TestMain for package-wide leak detection
key_files:
  created:
    - relay/internal/middleware/ssebuffering.go
  modified:
    - relay/internal/relay/handler.go (WithKeepAlive + SSENoBuffering)
    - relay/internal/config/config.go (MaxSSEPerRoom, MaxSSETotal fields)
    - relay/internal/hub/hub.go (ErrRoomAtCapacity, sseCount, limit enforcement)
    - relay/internal/hub/manager.go (maxSSEPerRoom field + constructor param)
    - relay/internal/hub/hub_test.go (goleak TestMain + 4 new SSE tests)
    - relay/internal/relay/executor_test.go (NewRoomHub call updated)
    - relay/internal/handler/discovery_test.go (6 NewHubManager calls updated)
    - relay/cmd/server/main.go (pass cfg.MaxSSEPerRoom to NewHubManager)
    - relay/go.mod (added go.uber.org/goleak v1.3.0)
decisions:
  - "SDK uses a2asrv.WithKeepAlive (on NewJSONRPCHandler) not WithTransportKeepAlive — plan's option name was wrong, auto-fixed"
  - "SSENoBuffering applied to /r/{slug}/a2a route group — unconditional header is safe on non-SSE responses per Traefik docs"
  - "maxSSECount=0 disables the limit (for testing flexibility); production default is 100 per room via MAX_SSE_PER_ROOM"
  - "atomic.Int32 for sseCount — reads are lock-free, writes happen inside hub goroutine for subscribe/unsubscribe"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-23"
  tasks_completed: 2
  files_created: 1
  files_modified: 8
---

# Phase 03 Plan 01: SSE Streaming Keep-Alive, Proxy Header, and Connection Limits Summary

SSE streaming backbone enabled: SDK-native 20s heartbeat via WithKeepAlive, X-Accel-Buffering: no middleware for Traefik passthrough, per-room atomic SSE connection limit with ErrRoomAtCapacity, goleak-verified zero goroutine leaks on disconnect (15 hub tests all pass with -race).

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 (RED) | Failing tests for SSE limits + goleak | 8633acf | hub_test.go |
| 1 (GREEN) | WithKeepAlive + SSENoBuffering middleware | f7045b5 | handler.go, ssebuffering.go |
| 2 (GREEN) | SSE limits, goleak tests, config fields | 2392c31 | hub.go, manager.go, config.go, hub_test.go |

Note: Task 1 was fully auto (middleware + keepalive). Task 2 used TDD — RED commit before GREEN.

## What Was Built

### Task 1: SSE Keep-Alive + X-Accel-Buffering Middleware

**relay/internal/relay/handler.go** — Updated `NewJSONRPCHandler` call to include `a2asrv.WithKeepAlive(20*time.Second)`. The SDK's internal SSE transport writes `": keep-alive\n\n"` SSE comment events at the configured 20-second interval. Also applied `middleware.SSENoBuffering` to the `/r/{slug}/a2a` route group.

**relay/internal/middleware/ssebuffering.go** — New chi middleware that unconditionally sets `X-Accel-Buffering: no` on all responses served by the wrapped handler group. Traefik only acts on this header when `Content-Type: text/event-stream`, so non-SSE responses are unaffected. This prevents Traefik from batching SSE frames.

### Task 2: SSE Connection Limits + goleak Goroutine Leak Tests (TDD)

**relay/internal/config/config.go** — Two new config fields:
- `MaxSSEPerRoom int` (`MAX_SSE_PER_ROOM`, default 100) — per-room SSE subscriber limit
- `MaxSSETotal int` (`MAX_SSE_TOTAL`, default 1000) — server-wide limit (tracked for future enforcement)

**relay/internal/hub/hub.go** — `ErrRoomAtCapacity` sentinel error. `RoomHub` struct gains `sseCount atomic.Int32` and `maxSSECount int32`. Subscribe case in `Run` now checks `sseCount.Load() >= maxSSECount` before accepting; increments on success. Unsubscribe case decrements `sseCount.Add(-1)`. ctx.Done cleanup resets `sseCount.Store(0)`. `NewRoomHub` signature updated to accept `maxSSEPerRoom int`.

**relay/internal/hub/manager.go** — `HubManager` struct gains `maxSSEPerRoom int`. `NewHubManager` signature updated to accept it. `GetOrCreate` passes `maxSSEPerRoom` to `NewRoomHub`.

**relay/internal/hub/hub_test.go** — Added `TestMain` with `goleak.VerifyTestMain(m)` for package-wide leak detection. Added 4 tests:
- `TestSSEConnectionLimit`: fill room to capacity (maxSSE=3), verify (maxSSE+1)th returns `ErrRoomAtCapacity`
- `TestSSEConnectionLimitAfterUnsubscribe`: fill, unsubscribe one, new subscribe succeeds
- `TestSSEDisconnectNoLeak`: subscribe + unsubscribe single agent, cancel hub ctx, goleak.VerifyNone passes
- `TestMultipleSSEDisconnectNoLeak`: 5 agents subscribe + unsubscribe, cancel hub ctx, goleak.VerifyNone passes

Updated all existing `NewRoomHub` / `NewHubManager` calls in tests (executor_test.go: 1, discovery_test.go: 6, hub_test.go: existing 5) to pass the new required parameter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SDK option is WithKeepAlive, not WithTransportKeepAlive**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `a2asrv.WithTransportKeepAlive(20 * time.Second)` but the actual SDK v0.3.12 exports `a2asrv.WithKeepAlive(interval time.Duration)` as a `JSONRPCHandlerOption` on `NewJSONRPCHandler`. The function `WithTransportKeepAlive` does not exist in this SDK version.
- **Fix:** Used `a2asrv.WithKeepAlive(20*time.Second)` on `NewJSONRPCHandler`. Verified in `/Users/fcavalcanti/go/pkg/mod/github.com/a2aproject/a2a-go@v0.3.12/a2asrv/jsonrpc.go` and confirmed by `TestJSONRPC_StreamingKeepAlive` in the SDK's own test suite.
- **Files modified:** `relay/internal/relay/handler.go`
- **Commit:** f7045b5

**2. [Rule 3 - Blocking] NewRoomHub and NewHubManager signature change required updating all callers**
- **Found during:** Task 2 GREEN phase
- **Issue:** Adding `maxSSEPerRoom` as a required parameter to `NewRoomHub` and `NewHubManager` broke 8 existing call sites in tests and `main.go`.
- **Fix:** Updated all callers — 5 in `hub_test.go` (existing tests), 1 in `executor_test.go`, 6 in `discovery_test.go`, 1 in `main.go`. All updated to pass appropriate values (100 for tests, `cfg.MaxSSEPerRoom` for production).
- **Files modified:** hub_test.go, executor_test.go, discovery_test.go, main.go
- **Commit:** 2392c31

## Known Stubs

None. All code is fully implemented:
- SSE heartbeat is wired via `WithKeepAlive(20*time.Second)` — SDK handles the timer internally
- `X-Accel-Buffering: no` is set on every response in the A2A route group
- Connection limits are enforced atomically in the hub goroutine with `ErrRoomAtCapacity`
- goleak tests confirm no goroutine leaks — these are live proofs, not assertions

`MaxSSETotal` (server-wide limit) is tracked in config but not yet enforced globally — enforcement requires a server-level atomic counter not in scope for this plan. Noted for a future plan.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| relay/internal/middleware/ssebuffering.go | FOUND |
| relay/internal/relay/handler.go (WithKeepAlive) | FOUND |
| relay/internal/config/config.go (MaxSSEPerRoom) | FOUND |
| relay/internal/hub/hub.go (sseCount, ErrRoomAtCapacity) | FOUND |
| relay/internal/hub/hub_test.go (TestSSEDisconnectNoLeak) | FOUND |
| Commit f7045b5 (Task 1 GREEN) | FOUND |
| Commit 8633acf (Task 2 RED) | FOUND |
| Commit 2392c31 (Task 2 GREEN) | FOUND |
| go build ./... | PASSED |
| go test -race -count=1 ./... | PASSED (15 hub tests, all packages) |
| go vet ./... | PASSED |
