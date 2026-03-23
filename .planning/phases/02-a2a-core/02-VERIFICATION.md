---
phase: 02-a2a-core
verified: 2026-03-23T01:35:48Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 02: A2A Core Verification Report

**Phase Goal:** Agents can join a room with their bearer token, publish their Agent Card, discover other agents in the room by skill or tag, and exchange synchronous messages via the A2A message/send JSON-RPC method.
**Verified:** 2026-03-23T01:35:48Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Type-safe RoomID prevents passing raw UUIDs across room boundaries | VERIFIED | `relay/internal/hub/roomid.go`: `type RoomID uuid.UUID` — named type forces explicit conversion |
| 2 | A per-room goroutine hub serializes all subscriber writes without mutexes on the subscriber map | VERIFIED | `hub.go`: `subscribers` map owned exclusively inside `Run()` goroutine; command channels serialize all mutations |
| 3 | PresenceRegistry stores agent cards per room with RWMutex for concurrent reads | VERIFIED | `registry.go`: `sync.RWMutex` with full Add/Remove/Get/List/Filter/ExtendedCard API |
| 4 | HubManager creates and retrieves RoomHub instances by RoomID | VERIFIED | `manager.go`: double-checked locking in `GetOrCreate`; `Get` for read-only access |
| 5 | RoomEvent struct models agent_joined/agent_left/message events for Phase 3 SSE consumption | VERIFIED | `event.go`: `RoomEvent` with `EventAgentJoined`, `EventAgentLeft`, `EventMessage`; `hub.Events()` read-only accessor |
| 6 | agent_presence table persists join records with heartbeat timestamps for TTL tracking | VERIFIED | `00002_agent_presence.sql`: table with `last_seen`, `ttl_seconds`; 7 sqlc queries generated |
| 7 | Two isolated room hubs do not leak messages to each other | VERIFIED | `TestTwoRoomIsolation` passes with `-race` flag |
| 8 | An agent can POST a JSON-RPC message/send to /r/{slug}/a2a and receive a spec-compliant JSON-RPC 2.0 response | VERIFIED | `executor.go`: `RoomExecutor` implements `a2asrv.AgentExecutor`; `handler.go`: `MountA2ARoutes` registers `/r/{slug}/a2a/*`; executor tests pass |
| 9 | A request without A2A-Version: 1.0 header returns JSON-RPC VersionNotSupportedError with code -32001 | VERIFIED | `a2aversion.go`: returns `{"code":-32001,"message":"version not supported"}` HTTP 400; `A2AVersionGuard` applied as middleware on `/r/{slug}/a2a` |
| 10 | An agent can POST to /r/{slug}/join with its Agent Card to register presence in the room | VERIFIED | `discovery.go` `JoinRoom`: validates bearer, decodes AgentCard, calls `hub.Subscribe` + `UpsertAgentPresence` |
| 11 | GET /r/{slug}/agents returns public cards, supports ?skill= and ?tag= filters | VERIFIED | `ListAgents`: calls `FilterBySkillID`, `FilterByTag`, or `ListPublicCards`; 3 tests pass |
| 12 | GET /r/{slug}/agents/{name} returns public card without bearer; extended card with valid bearer | VERIFIED | `GetAgentCard`: bearer path calls `ExtendedCard`; no-bearer path calls `ListPublicCards` then name-match |
| 13 | GET /agents returns global directory of agents in public rooms only | VERIFIED | `agent.go` `GlobalDirectory`: calls `ListAllPublicAgentPresence` (SQL JOIN with `is_private = FALSE`); test `TestGlobalDirectory_HidesPrivateRoomAgents` passes |
| 14 | Background reaper removes agents whose last_seen exceeds their TTL | VERIFIED | `reaper.go` `StartReaper`: `DeleteExpiredAgentPresence` + `registry.Remove` + `hub.Unsubscribe`; `TestReaper_EvictsExpiredAgents` passes |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `relay/internal/hub/roomid.go` | Type-safe RoomID wrapping uuid.UUID | VERIFIED | `type RoomID uuid.UUID`; NewRoomID, ParseRoomID, String(), UUID() all present |
| `relay/internal/hub/hub.go` | Per-room goroutine hub with channel-based command pattern | VERIFIED | `func (h *RoomHub) Run`; Subscribe/Unsubscribe/Broadcast/Events/Done; 296 lines of substantive logic |
| `relay/internal/hub/registry.go` | In-memory agent card store with RWMutex | VERIFIED | `type PresenceRegistry struct`; 11 methods including FilterBySkillID, FilterByTag, ListPublicCards |
| `relay/internal/hub/manager.go` | Hub lifecycle manager (create, get, remove) | VERIFIED | `type HubManager struct`; double-checked locking in GetOrCreate |
| `relay/internal/hub/event.go` | RoomEvent model for join/leave notifications | VERIFIED | `type RoomEvent struct` with EventAgentJoined, EventAgentLeft, EventMessage |
| `relay/internal/hub/hub_test.go` | Two-room isolation test and subscribe/broadcast test | VERIFIED | `TestTwoRoomIsolation` at line 164; 11 total tests; all pass with `-race` |
| `relay/internal/migrations/00002_agent_presence.sql` | Agent presence table for TTL persistence | VERIFIED | `CREATE TABLE agent_presence` with room_id FK, last_seen, ttl_seconds, indexes |
| `relay/internal/db/models.go` | sqlc-generated AgentPresence Go struct | VERIFIED | `type AgentPresence struct` at line 11 |
| `relay/internal/relay/executor.go` | RoomExecutor implementing a2asrv.AgentExecutor | VERIFIED | `func (e *RoomExecutor) Execute`; compile-time interface assertion present |
| `relay/internal/relay/handler.go` | Dynamic A2A handler mounting on chi | VERIFIED | `func MountA2ARoutes`; single dynamic handler resolves room per request |
| `relay/internal/middleware/a2aversion.go` | A2A-Version header guard middleware | VERIFIED | `A2AVersionGuard`; returns -32001 on missing/wrong version |
| `relay/internal/handler/discovery.go` | REST endpoints: join, agents list, room info, heartbeat | VERIFIED | `func (h *DiscoveryHandler) JoinRoom`; 5 methods implemented |
| `relay/internal/handler/agent.go` | Global agent directory and per-agent card endpoints | VERIFIED | `func (h *AgentHandler) GlobalDirectory`; card_json deserialization with error handling |
| `relay/internal/presence/reaper.go` | Background goroutine that evicts stale agents | VERIFIED | `func StartReaper`; 60s ticker; runReaperCycle extracted for testability |
| `relay/cmd/server/main.go` | Updated main.go with A2A routes, discovery routes, reaper startup | VERIFIED | `MountA2ARoutes` at line 241; `presence.StartReaper` at line 103; all discovery routes registered |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `relay/internal/relay/executor.go` | `relay/internal/hub/hub.go` | Executor broadcasts messages to room hub | WIRED | `e.Hub.Broadcast(evt)` at line 50 |
| `relay/internal/relay/handler.go` | `relay/internal/hub/manager.go` | Handler resolves room hub from HubManager | WIRED | `hubMgr.GetOrCreate(r.Context(), roomID)` at line 43 |
| `relay/internal/handler/discovery.go` | `relay/internal/hub/registry.go` | Discovery endpoints query PresenceRegistry | WIRED | `h.Registry.FilterBySkillID`, `FilterByTag`, `ListPublicCards`, `ExtendedCard`, `UpdateLastSeen` — all called |
| `relay/internal/handler/discovery.go` | `relay/internal/db/query.sql.go` | Join persists to agent_presence; heartbeat updates last_seen | WIRED | `h.Queries.UpsertAgentPresence` (line 96) and `h.Queries.UpdateAgentHeartbeat` (line 248) |
| `relay/internal/handler/discovery.go` | `relay/internal/token/token.go` | JoinRoom verifies bearer token against room's TokenHash | WIRED | `token.VerifyToken(bearerToken, room.TokenHash)` at lines 52, 167 |
| `relay/internal/presence/reaper.go` | `relay/internal/db/query.sql.go` | Reaper calls DeleteExpiredAgentPresence | WIRED | `queries.DeleteExpiredAgentPresence(ctx)` at line 56 |
| `relay/internal/presence/reaper.go` | `relay/internal/hub/registry.go` | Reaper removes evicted agents from in-memory registry | WIRED | `registry.Remove(roomID, row.AgentName)` at line 71 |
| `relay/cmd/server/main.go` | `relay/internal/relay/handler.go` | main.go calls MountA2ARoutes | WIRED | `relay.MountA2ARoutes(r, hubMgr, registry, queries, cfg.BaseURL, logger)` at line 241 |
| `relay/internal/middleware/a2aversion.go` | `relay/internal/relay/handler.go` | A2AVersionGuard applied as chi middleware on /r/{slug}/a2a routes | WIRED | `r.Use(middleware.A2AVersionGuard)` at line 30 of handler.go |
| `relay/internal/hub/hub.go` | `relay/internal/hub/registry.go` | Hub calls registry.Add/Remove on subscribe/unsubscribe | WIRED | `registry.Add(h.ID, ...)` in subscribe branch; `registry.Remove(h.ID, ...)` in unsubscribe branch |
| `relay/internal/hub/manager.go` | `relay/internal/hub/hub.go` | Manager creates and stores RoomHub instances | WIRED | `NewRoomHub(id, m.registry, m.logger)` called in GetOrCreate |
| `relay/internal/hub/hub.go` | `relay/internal/hub/event.go` | Hub emits RoomEvent on subscribe/unsubscribe to events channel | WIRED | `h.emitToEvents(evt)` called after both subscribe and unsubscribe branches |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| A2A-01 | 02-02 | Relay handles message/send (synchronous JSON-RPC 2.0) between agents | SATISFIED | RoomExecutor.Execute broadcasts message and returns TaskStateCompleted; executor_test.go passes |
| A2A-04 | 02-02 | Relay returns proper A2A JSON-RPC error codes on failure | SATISFIED | A2AVersionGuard returns -32001; handler.go writeJSONRPCError returns -32603 on room not found |
| A2A-05 | 02-02 | All A2A endpoints require A2A-Version: 1.0 header | SATISFIED | A2AVersionGuard middleware applied on all /r/{slug}/a2a routes; tests for missing and wrong version pass |
| DISC-01 | 02-01 | Agent publishes its Agent Card when joining a room | SATISFIED | JoinRoom decodes AgentCard from body, calls hub.Subscribe (adds to registry) and UpsertAgentPresence (persists to DB) |
| DISC-02 | 02-02 | Agent can list all agents currently in a room (returns Agent Cards) | SATISFIED | GET /r/{slug}/agents calls ListPublicCards; TestListAgents_ReturnsPublicCards passes |
| DISC-03 | 02-02 | Agent can filter room members by skill, tag, or capability | SATISFIED | ?skill= maps to FilterBySkillID; ?tag= maps to FilterByTag; both filter tests pass |
| DISC-04 | 02-01 | Agent Card is removed from room registry on disconnect or TTL expiry | SATISFIED | StartReaper calls DeleteExpiredAgentPresence + registry.Remove + hub.Unsubscribe; TestReaper_EvictsExpiredAgents passes |
| DISC-05 | 02-02 | Room-level Agent Card endpoint serves the room's relay card | SATISFIED | GET /r/{slug}/.well-known/agent-card.json mounted in MountA2ARoutes; BuildRoomRelayCard returns full relay AgentCard |
| DISC-06 | 02-02 | Public Agent Card (basic info: name, description, skills) visible without auth | SATISFIED | GetAgentCard no-bearer path calls ListPublicCards (strips URL/SecuritySchemes); TestGetAgentCard_NoBearerReturnsPublicCard passes |
| DISC-07 | 02-02 | Extended Agent Card (full capabilities, endpoints) requires bearer token | SATISFIED | GetAgentCard with valid bearer calls ExtendedCard (returns full card); TestGetAgentCard_ValidBearerReturnsExtendedCard passes |

**Orphaned requirements check:** REQUIREMENTS.md maps exactly A2A-01, A2A-04, A2A-05, DISC-01 through DISC-07 to Phase 2 — all 10 are claimed by the two plans. No orphaned requirements.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `relay/internal/hub/registry.go` | 97, 115, 144, 165 | `return []*..{}` | INFO | Early-exit guards for "room not found" — not stubs; correct behavior when room has no agents |

No TODO/FIXME/PLACEHOLDER comments in any phase 02 files. No empty handler implementations. No hardcoded data flowing to user-visible output.

---

### Human Verification Required

None for core correctness. The following behaviors are functionally wired but cannot be confirmed without a running Postgres instance:

#### 1. End-to-end agent join and message relay

**Test:** Start the relay with a real Postgres DB, create a room, POST to `/r/{slug}/join` with a valid bearer token and Agent Card, then POST to `/r/{slug}/a2a` with a JSON-RPC `message/send` payload and `A2A-Version: 1.0` header.
**Expected:** The join returns `{"status":"joined","agent_name":"..."}`. The message/send returns a JSON-RPC 2.0 result with a task status of `completed` and the text `"message relayed"`.
**Why human:** Requires a live Postgres instance and real bearer token to exercise the full request path.

#### 2. TTL reaper eviction cycle

**Test:** Join an agent, wait 5 minutes (or reduce TTL), trigger the reaper, verify the agent disappears from `GET /r/{slug}/agents`.
**Expected:** Agent is absent from the agent list after TTL expiry.
**Why human:** The 60-second reaper interval and 300-second default TTL make automated unit test timing impractical; the unit test (TestReaper_EvictsExpiredAgents) mocks the query layer.

---

### Gaps Summary

No gaps. All 14 observable truths verified against the actual codebase. All artifacts exist and are substantive. All 12 key links wired. All 10 Phase 2 requirements covered by plans and implemented in code. The entire test suite (`internal/hub`, `internal/relay`, `internal/handler`) passes with the `-race` flag. `go build ./...` and `go vet ./...` both clean.

---

_Verified: 2026-03-23T01:35:48Z_
_Verifier: Claude (gsd-verifier)_
