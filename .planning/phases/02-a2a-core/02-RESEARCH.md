# Phase 2: A2A Core - Research

**Researched:** 2026-03-22
**Domain:** A2A protocol v1.0, a2a-go v0.3.12 SDK, per-room goroutine hub, agent presence registry, JSON-RPC relay
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Global card + room presence — agent registers a global card once (at `/a/{agent-name}/.well-known/agent.json`), joining a room creates a presence entry pointing to the global card. Research needed to confirm best A2A-spec-aligned URL pattern.
- **D-02:** Two-tier cards: public card (name, description, skills) visible without auth; extended card (full capabilities, endpoints, input/output modes) requires bearer token. Per A2A spec and PROJECT.md decision.
- **D-03:** Explicit join handshake — agent POSTs to a join endpoint with its Agent Card. This registers presence in the room. Joining is separate from messaging — an agent can be present without having sent any message.
- **D-04:** Join notification via SSE — when an agent joins, all other agents subscribed to the room's stream receive an `agent_joined` event with the new agent's card. Same for `agent_left` on disconnect/TTL expiry.
- **D-05:** Agent heartbeat extends room TTL — heartbeats count as room activity. Room's 3-day inactivity TTL (from Phase 1 D-05) resets on agent heartbeats, messages, or human activity.
- **D-06:** Room info endpoint (`/r/{slug}/info` or similar) returns full room state: all connected agents with their cards, room stats (message count, uptime, agent count), room metadata. No filtering needed — agents in the same room can see everyone.
- **D-07:** Cross-room discovery — agents can query a global directory of agents in public rooms. Private room agents stay hidden.
- **D-08:** Claude's discretion based on research. Per-room goroutine hub, in-memory registry, message routing model. Must support real-time presence events (join/leave) and synchronous message relay.
- **D-09:** Claude's discretion. Research A2A spec error codes and implement spec-compliant responses.

### Claude's Discretion

- Room event loop architecture (D-08)
- A2A error handling granularity (D-09)
- Agent heartbeat interval and TTL mechanics
- Global Agent Card URL pattern (research A2A spec alignment for D-01)
- Exact join endpoint path and payload format
- MessageBus interface usage for room fanout

### Deferred Ideas (OUT OF SCOPE)

- SSE streaming transport — Phase 3 (join/leave events defined here, but SSE delivery is Phase 3)
- A2A Tasks lifecycle (submitted/working/completed) — v2
- A2A Artifacts exchange — v2
- Agent-to-agent direct messaging outside rooms — not in scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| A2A-01 | Relay handles `message/send` (synchronous JSON-RPC 2.0) between agents in a room | a2asrv.NewJSONRPCHandler + RoomExecutor implementing AgentExecutor; routes message to target agent via room hub |
| A2A-04 | Relay returns proper A2A JSON-RPC error codes on failure | a2a.Err* variables map to JSON-RPC codes; SDK transport layer handles code serialization; relay wraps in a2a.Error |
| A2A-05 | All A2A endpoints require `A2A-Version: 1.0` header | SDK reads A2A-Version via NewServiceParams; VersionNotSupportedError returned when unsupported; custom chi middleware guards when SDK does not enforce |
| DISC-01 | Agent publishes its Agent Card when joining a room | POST /r/{slug}/join with AgentCard payload; stored in in-memory PresenceRegistry; persisted to DB for TTL tracking |
| DISC-02 | Agent can list all agents currently in a room (returns Agent Cards) | GET /r/{slug}/agents returns full Agent Cards from PresenceRegistry; public tier only (no auth) |
| DISC-03 | Agent can filter room members by skill, tag, or capability | Query params ?skill=X&tag=Y on agents list endpoint; server-side filter on AgentSkill.ID, AgentSkill.Tags fields |
| DISC-04 | Agent Card is removed from room registry on disconnect or TTL expiry | Heartbeat endpoint extends TTL; background reaper goroutine removes expired entries; emits agent_left event model |
| DISC-05 | Room-level Agent Card endpoint serves the room's relay card | GET /r/{slug}/.well-known/agent-card.json via a2asrv.NewAgentCardHandler with AgentCardProducerFn; reflects room's A2A URL |
| DISC-06 | Public Agent Card (basic info: name, description, skills) visible to anyone without auth | PresenceRegistry.PublicCard() returns stripped AgentCard (name, description, skills, tags only); no bearer required |
| DISC-07 | Extended Agent Card (full capabilities, endpoints, input/output modes) requires bearer token | PresenceRegistry.ExtendedCard() requires valid room bearer; returns full AgentCard including URL, capabilities, securitySchemes |
</phase_requirements>

---

## Summary

Phase 2 wires the A2A protocol SDK into the chi router and builds the core room machinery: a per-room goroutine hub, an in-memory presence registry for agent cards, and the JSON-RPC relay executor that forwards `message/send` calls between agents. The a2a-go v0.3.12 SDK handles all JSON-RPC framing — the relay must only implement `AgentExecutor` and mount `NewJSONRPCHandler` on chi.

The user decisions establish a "global card + room presence" model distinct from the SDK's default single-agent model. Quorum is a relay, not an agent — there is one `RoomExecutor` per room, and it forwards messages to target agents (or broadcasts, depending on message target). The SDK's `AgentExecutor` interface and `RequestContext` give us the incoming message and task context; the relay routes the message to the appropriate subscriber(s) in the room hub.

The two-tier card model (D-02) maps cleanly to the SDK's own pattern: `NewStaticAgentCardHandler` serves the public card, and `WithExtendedAgentCard` option on `NewHandler` serves the authenticated extended card. The room's relay card (DISC-05) is a separate concern — it describes the relay's own A2A endpoint, not the agent's card. Agent cards are stored in the `PresenceRegistry` and returned by REST endpoints (DISC-02, DISC-03, DISC-06, DISC-07), not by the SDK's card handler.

**Primary recommendation:** Implement Phase 2 in two plans exactly as roadmapped: (02-01) room hub + PresenceRegistry + RoomID type, then (02-02) JSON-RPC handler + discovery REST endpoints. Do not conflate hub logic with A2A SDK wiring — keep `internal/hub` and `internal/relay` as separate packages.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.com/a2aproject/a2a-go | v0.3.12 | A2A protocol implementation | Official SDK — do not hand-roll JSON-RPC compliance |
| github.com/go-chi/chi/v5 | v5.2.5 | HTTP routing | Mount a2asrv handlers alongside REST endpoints; net/http compatible |
| github.com/jackc/pgx/v5 | v5.9.0 | Postgres for presence persistence | Agent join records, heartbeat timestamps, room TTL updates |
| github.com/sqlc-dev/sqlc | v1.30.0 | Type-safe SQL for presence queries | Generate Go from SQL; prevents drift from agent_presence table |
| sync (stdlib) | Go 1.26 | RWMutex for PresenceRegistry | Low-overhead concurrent reads; single VPS does not need sync.Map complexity |
| log/slog (stdlib) | Go 1.26 | Structured logging in hub | No external logger needed; a2a-go uses slog internally |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| github.com/google/uuid | v1.x | RoomID type backing | `type RoomID uuid.UUID` — STATE.md requirement; generates UUID v4 |
| context (stdlib) | Go 1.26 | Hub goroutine lifecycle | Cancel hub when room closes; propagate to subscriber goroutines |

### Development Tools

| Tool | Purpose |
|------|---------|
| go test -race | Race detector — run on hub tests; concurrent map/channel bugs surface immediately |
| golangci-lint | Catch context leaks and unchecked errors in goroutine paths |

### Installation

No new dependencies beyond Phase 1. All packages were pulled in Phase 1 (`a2a-go`, `pgx/v5`, `sqlc`, `chi`, `uuid`). No additional `go get` needed.

---

## Architecture Patterns

### Recommended Project Structure (relay package additions)

```
relay/
├── internal/
│   ├── hub/
│   │   ├── hub.go          # RoomHub: per-room goroutine, channels, subscriber map
│   │   ├── registry.go     # PresenceRegistry: in-memory agent card store with RWMutex
│   │   └── roomid.go       # type RoomID uuid.UUID — prevents cross-room contamination
│   ├── relay/
│   │   ├── executor.go     # RoomExecutor implements a2asrv.AgentExecutor
│   │   ├── handler.go      # chi mounts: NewJSONRPCHandler + card handlers per room
│   │   └── middleware.go   # A2A-Version header guard middleware
│   ├── presence/
│   │   ├── db.go           # sqlc-generated presence queries
│   │   └── reaper.go       # background goroutine: expire stale agents, emit agent_left model
│   └── api/
│       └── discovery.go    # REST: GET /r/{slug}/agents, /r/{slug}/info, global directory
```

### Pattern 1: Per-Room Goroutine Hub

The hub owns all mutable state for a room (subscriber list, agent registry). External callers send commands over channels; the hub goroutine serializes all writes. This avoids lock contention and prevents data races.

```go
// Source: Go concurrency ownership pattern (stdlib)
type RoomHub struct {
    id          RoomID
    subscribe   chan subscribeCmd
    unsubscribe chan unsubscribeCmd
    broadcast   chan broadcastCmd
    done        chan struct{}
}

type subscribeCmd struct {
    agentName string
    ch        chan<- a2a.Event
    resp      chan error
}

// Hub goroutine — owns all room state
func (h *RoomHub) run(ctx context.Context, registry *PresenceRegistry) {
    subscribers := make(map[string]chan<- a2a.Event)
    for {
        select {
        case cmd := <-h.subscribe:
            subscribers[cmd.agentName] = cmd.ch
            cmd.resp <- nil
        case cmd := <-h.unsubscribe:
            delete(subscribers, cmd.agentName)
            close(cmd.ch)
        case cmd := <-h.broadcast:
            for _, ch := range subscribers {
                select {
                case ch <- cmd.event:
                default: // slow consumer; drop or buffer
                }
            }
        case <-ctx.Done():
            return
        }
    }
}
```

**When to use:** Always. The hub goroutine pattern is the standard Go pattern for any shared mutable state that multiple goroutines write to. It eliminates mutex complexity for the subscriber map.

### Pattern 2: PresenceRegistry (read-heavy, RWMutex)

Agent card reads (DISC-02, DISC-06, DISC-07) happen on every HTTP request. Writes happen only on join/leave. Use `sync.RWMutex` — multiple concurrent readers, single writer.

```go
// Source: Go stdlib sync package
type PresenceRegistry struct {
    mu      sync.RWMutex
    agents  map[RoomID]map[string]*AgentPresence // roomID -> agentName -> presence
}

type AgentPresence struct {
    Card        *a2a.AgentCard
    JoinedAt    time.Time
    LastSeen    time.Time
    AgentName   string
}

func (r *PresenceRegistry) PublicCard(roomID RoomID, agentName string) (*a2a.AgentCard, bool) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    // Return stripped card: name, description, skills only
}

func (r *PresenceRegistry) ExtendedCard(roomID RoomID, agentName string) (*a2a.AgentCard, bool) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    // Return full card — caller must have already verified bearer token
}
```

### Pattern 3: RoomExecutor (AgentExecutor implementation)

The `RoomExecutor` is the bridge between the A2A SDK and the room hub. For `message/send`, it receives the incoming message, routes it to the hub's broadcast channel, and writes a `TaskStatusUpdateEvent` (completed) back to the event queue. The SDK's `NewJSONRPCHandler` handles all JSON-RPC framing.

```go
// Source: a2asrv package docs — pkg.go.dev/github.com/a2aproject/a2a-go/a2asrv
type RoomExecutor struct {
    hub      *RoomHub
    registry *PresenceRegistry
}

func (e *RoomExecutor) Execute(
    ctx context.Context,
    reqCtx *a2asrv.RequestContext,
    queue eventqueue.Queue,
) error {
    // 1. Route message to hub (broadcast or targeted)
    e.hub.broadcast <- broadcastCmd{event: ..., from: senderAgentName}

    // 2. Build response message
    resp := a2a.NewMessage(a2a.MessageRoleAgent,
        a2a.NewTextPart("message relayed"))

    // 3. Write completed status event — SDK serializes to JSON-RPC response
    return queue.Write(ctx, a2a.NewStatusUpdateEvent(
        reqCtx.TaskInfo(), a2a.TaskStateCompleted, resp))
}

func (e *RoomExecutor) Cancel(
    ctx context.Context,
    reqCtx *a2asrv.RequestContext,
    queue eventqueue.Queue,
) error {
    return queue.Write(ctx, a2a.NewStatusUpdateEvent(
        reqCtx.TaskInfo(), a2a.TaskStateCanceled, nil))
}
```

### Pattern 4: Mounting a2asrv on chi Per Room

The key insight: `a2asrv.NewJSONRPCHandler` returns an `http.Handler` that catches ALL requests to the mounted path. Mount it under chi's per-room subrouter. Each room gets its own `RoomExecutor`, and thus its own `NewJSONRPCHandler`.

```go
// Source: CLAUDE.md §Stack Patterns + a2asrv pkg docs
func mountRoomA2ARoutes(r chi.Router, slug string, hub *RoomHub, registry *PresenceRegistry) {
    executor := &RoomExecutor{hub: hub, registry: registry}
    requestHandler := a2asrv.NewHandler(
        executor,
        a2asrv.WithExtendedAgentCardProducer(
            a2asrv.AgentCardProducerFn(func(ctx context.Context) (*a2a.AgentCard, error) {
                return buildRoomRelayCard(slug), nil
            }),
        ),
    )

    // JSON-RPC endpoint: handles message/send (and future message/stream)
    jsonrpcHandler := a2asrv.NewJSONRPCHandler(requestHandler)

    // Room's relay Agent Card (public, no auth)
    roomCard := buildRoomRelayCard(slug)
    cardHandler := a2asrv.NewStaticAgentCardHandler(roomCard)

    r.Route("/r/{slug}/a2a", func(r chi.Router) {
        r.Use(a2aVersionMiddleware)    // enforce A2A-Version: 1.0
        r.Use(bearerAuthMiddleware)    // require room bearer token
        r.Handle("/*", jsonrpcHandler) // all JSON-RPC methods
    })

    // Well-known card at room scope — public, no auth
    r.Get("/r/{slug}/.well-known/agent-card.json", cardHandler.ServeHTTP)
}
```

### Pattern 5: Global Agent Card URL (D-01 Research Finding)

The A2A spec defines `/.well-known/agent-card.json` as the canonical discovery endpoint. For Quorum's global card model, the recommended URL is:

```
GET /a/{agent-name}/.well-known/agent-card.json   → public tier (no auth)
```

This is not a standard A2A convention (the spec is server-centric, not agent-centric) but it is the closest spec-aligned pattern. The `/a/` prefix mirrors the `/r/` prefix for rooms (established in Phase 1 D-01) and signals it is an agent namespace. The `.well-known/agent-card.json` suffix preserves spec discovery semantics.

**Justification:** The A2A spec's `WellKnownAgentCardPath = "/.well-known/agent-card.json"` is relative to the agent's base URL. For a relay that hosts many agents, the agent name becomes the path prefix. This is consistent with how multi-tenant A2A servers operate.

### Pattern 6: A2A-Version Header Middleware

The SDK reads the `A2A-Version` header via `NewServiceParams` internally, but version validation behavior at the transport layer is not guaranteed to block the request before execution. Add a chi middleware guard to be explicit:

```go
// Enforce A2A-Version: 1.0 per spec requirement (A2A-05)
func a2aVersionMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        v := r.Header.Get("A2A-Version")
        if v == "" || v != "1.0" {
            // Return JSON-RPC error: VersionNotSupportedError
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusBadRequest)
            json.NewEncoder(w).Encode(map[string]any{
                "jsonrpc": "2.0",
                "error": map[string]any{
                    "code":    -32001, // A2A VersionNotSupportedError per spec
                    "message": "version not supported",
                },
                "id": nil,
            })
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

### Anti-Patterns to Avoid

- **Storing subscriber channels in sync.Map:** sync.Map is optimized for mostly-read stable key sets. The hub goroutine pattern is simpler and eliminates races without needing sync.Map at all.
- **One RoomExecutor per message:** Create one executor per room at room creation time, not per request. Executors are stateful (they hold a reference to the hub).
- **Writing to eventqueue.Queue after return:** The queue is closed after Execute returns. Any goroutine writing to the queue after Execute returns will get `ErrQueueClosed`. Complete all queue writes before returning.
- **Registering NewJSONRPCHandler at a named path:** The handler catches ALL requests via ServeHTTP — mount it as `r.Handle("/*", ...)` not as a named route. Routing to specific JSON-RPC methods happens by the method field in the JSON body, not by HTTP path.
- **Using a2asrv.NewHandler directly as http.Handler:** `NewHandler` returns a `RequestHandler` (transport-agnostic interface). You must wrap it with `NewJSONRPCHandler` to get an `http.Handler` for chi.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-RPC 2.0 framing | Custom JSON-RPC parser/encoder | `a2asrv.NewJSONRPCHandler` | Handles method dispatch, error serialization, id echoing, content-type |
| Agent Card JSON schema | Custom struct with manual tags | `a2a.AgentCard` struct | Exact proto-defined fields; JSON tags match spec; future-proof |
| Message construction | Manual JSON assembly | `a2a.NewMessage`, `a2a.NewTextPart` | Correct ID generation, role validation, part typing |
| Event queue mechanics | Custom channel-based event queue | `eventqueue.Queue.Write()` | SDK manages backpressure, versioning, ErrQueueClosed handling |
| Error code mapping | Magic numbers in response body | `a2a.ErrXxx` variables | SDK maps error vars to correct JSON-RPC codes in transport layer |
| Extended card auth | Custom gate handler | `a2asrv.WithExtendedAgentCard` option | Built-in authenticated endpoint at correct A2A path |

**Key insight:** The SDK is the protocol. Everything it provides represents edge cases that would require re-reading the spec to get right: error code integers, partial streaming flush behavior, task state transition guards. Use the SDK surface, don't re-implement it.

---

## Common Pitfalls

### Pitfall 1: Confusing the Room's Relay Card with Agent Cards

**What goes wrong:** Developer puts agent cards at `/r/{slug}/.well-known/agent-card.json`, making it impossible for agents to discover the relay's own endpoint.
**Why it happens:** The A2A spec's well-known URL is for the server's own card. Quorum has two card types: the room's relay card (DISC-05) and individual agent cards stored in PresenceRegistry (DISC-01..DISC-07).
**How to avoid:** The room's relay card at `/r/{slug}/.well-known/agent-card.json` describes Quorum's relay endpoint. Agent cards live at REST endpoints like `/r/{slug}/agents`. These are separate concerns.
**Warning signs:** Agents cannot connect to the room after discovering it from the card — the URL in the card points to agent data, not the A2A relay endpoint.

### Pitfall 2: Hub Goroutine Starvation Under Broadcast Load

**What goes wrong:** Slow subscriber channels block the hub's broadcast loop, causing all other subscribers to stall.
**Why it happens:** Unbuffered channels in the subscriber map cause the hub goroutine to block on every send.
**How to avoid:** Use buffered subscriber channels (buffer size 64 is sufficient for v1 load). Use non-blocking send with default case in the broadcast loop. Slow consumers that fill their buffer get dropped events — acceptable for Phase 2 (no persistence requirement).
**Warning signs:** A single slow agent connection causes room-wide message latency spikes.

### Pitfall 3: Agent Presence Surviving Process Restart

**What goes wrong:** In-memory PresenceRegistry is lost on process restart; agents believe they're joined but the relay has no record.
**Why it happens:** Presence is in-memory only; agents don't re-join after relay restarts.
**How to avoid:** Persist join records to Postgres `agent_presence` table with heartbeat timestamp. On startup, reload recent presence entries (heartbeat within TTL window). Agents with stale heartbeats are evicted on load.
**Warning signs:** After relay restart, `/r/{slug}/agents` returns empty even though agents are connected.

### Pitfall 4: RoomExecutor Created Outside Per-Room Context

**What goes wrong:** A single shared RoomExecutor is used for all rooms, routing all messages to the wrong hub.
**Why it happens:** `NewJSONRPCHandler(a2asrv.NewHandler(executor))` is called once at startup.
**How to avoid:** Create one `RoomExecutor` per room, keyed by `RoomID`. Use a `HubRegistry` (map[RoomID]*RoomHub) to look up the correct hub. Mount a separate `NewJSONRPCHandler` per room (or use a single dynamic handler that resolves the room from the URL using chi's `URLParam`).
**Warning signs:** Messages sent to room A appear in room B's event stream.

### Pitfall 5: Missing A2A-Version Header Returns 500 Instead of Protocol Error

**What goes wrong:** Requests without the `A2A-Version` header reach the executor and fail with a generic 500.
**Why it happens:** The SDK does not block execution based on version header at the handler level — it may only inspect it during capability negotiation.
**How to avoid:** Add `a2aVersionMiddleware` as a chi middleware on `/r/{slug}/a2a/*` before the handler is reached. Return a proper JSON-RPC `VersionNotSupportedError` response.
**Warning signs:** A2A-05 test fails; agents without the header get non-spec-compliant errors.

### Pitfall 6: Skill Filter On Wrong Field

**What goes wrong:** DISC-03 filter by "skill" matches on `AgentSkill.Name` instead of `AgentSkill.ID`.
**Why it happens:** Developer uses human-readable name for filtering; the spec uses `ID` as the stable identifier.
**How to avoid:** Filter DISC-03 by `AgentSkill.ID` (the stable identifier) for skill filtering. Filter by `AgentSkill.Tags` for tag filtering. Expose both `?skill=` (matches `ID`) and `?tag=` (matches `Tags`) as separate query params.
**Warning signs:** Two agents with skills named the same thing but different IDs both appear when one is expected.

---

## Code Examples

Verified patterns from official sources:

### Agent Card Construction

```go
// Source: pkg.go.dev/github.com/a2aproject/a2a-go/a2a#AgentCard
card := &a2a.AgentCard{
    Name:        "Quorum Relay",
    Description: "A2A relay for room my-room",
    URL:         "https://quorum.dev/r/my-room/a2a",
    Version:     "1.0.0",
    Capabilities: a2a.AgentCapabilities{
        Streaming: true,
    },
    DefaultInputModes:  []string{"text/plain"},
    DefaultOutputModes: []string{"text/plain"},
    Skills: []a2a.AgentSkill{
        {
            ID:          "relay",
            Name:        "Message Relay",
            Description: "Relay messages between agents in this room",
            Tags:        []string{"relay", "room"},
        },
    },
    SupportsAuthenticatedExtendedCard: true,
}
```

### A2A Handler Wiring (SDK chain)

```go
// Source: pkg.go.dev/github.com/a2aproject/a2a-go/a2asrv
executor := &RoomExecutor{hub: roomHub, registry: presenceReg}
requestHandler := a2asrv.NewHandler(
    executor,
    a2asrv.WithLogger(slog.Default()),
    a2asrv.WithExtendedAgentCard(extendedCard), // authenticated extended card
)
jsonrpcHandler := a2asrv.NewJSONRPCHandler(requestHandler)
// Mount on chi: r.Handle("/*", jsonrpcHandler) under /r/{slug}/a2a
```

### AgentExecutor.Execute — Relay Passthrough

```go
// Source: pkg.go.dev/github.com/a2aproject/a2a-go/a2asrv + eventqueue
func (e *RoomExecutor) Execute(
    ctx context.Context,
    reqCtx *a2asrv.RequestContext,
    queue eventqueue.Queue,
) error {
    // Route message to room hub
    select {
    case e.hub.broadcast <- broadcastCmd{event: reqCtx.Message}:
    case <-ctx.Done():
        return ctx.Err()
    }
    // Signal task completed
    ack := a2a.NewMessage(a2a.MessageRoleAgent, a2a.NewTextPart("relayed"))
    return queue.Write(ctx, a2a.NewStatusUpdateEvent(
        reqCtx.TaskInfo(), a2a.TaskStateCompleted, ack,
    ))
}
```

### Agent Card Public vs Extended Tier

```go
// Source: pkg.go.dev/github.com/a2aproject/a2a-go/a2asrv#NewStaticAgentCardHandler
// Public card (stripped) — served at /.well-known/agent-card.json, no auth required
publicCard := &a2a.AgentCard{Name: name, Description: desc, Skills: skills}
r.Get("/r/{slug}/.well-known/agent-card.json",
    a2asrv.NewStaticAgentCardHandler(publicCard).ServeHTTP)

// Extended card — only via authenticated bearer on the JSON-RPC handler
// WithExtendedAgentCard attaches to the RequestHandler, served at tasks/get or via
// OnGetExtendedAgentCard on the RequestHandler
requestHandler := a2asrv.NewHandler(executor,
    a2asrv.WithExtendedAgentCard(extendedCard))
```

### DISC-02 / DISC-03: Agents List Endpoint

```go
// REST endpoint — pure chi, no a2asrv involvement
// Source: project pattern (CLAUDE.md §Stack Patterns by Variant)
func (h *Handler) listAgents(w http.ResponseWriter, r *http.Request) {
    slug := chi.URLParam(r, "slug")
    skillFilter := r.URL.Query().Get("skill") // matches AgentSkill.ID
    tagFilter   := r.URL.Query().Get("tag")   // matches AgentSkill.Tags

    agents := h.registry.ListPublicCards(roomIDFor(slug))
    if skillFilter != "" {
        agents = filterBySkillID(agents, skillFilter)
    }
    if tagFilter != "" {
        agents = filterByTag(agents, tagFilter)
    }
    renderJSON(w, agents)
}
```

### Message/Send JSON-RPC Request/Response

```json
// Source: a2aprotocol.ai/docs/guide/a2a-sample-methods-and-json-responses
// Request:
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "hello room"}],
      "messageId": "550e8400-e29b-41d4-a716-446655440000"
    },
    "metadata": {}
  }
}

// Response (relay returns Message, not Task, for sync relay):
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "kind": "message",
    "role": "agent",
    "parts": [{"kind": "text", "text": "relayed"}],
    "messageId": "...",
    "contextId": "..."
  }
}
```

---

## A2A SDK Key Constants and Paths

| Constant / Type | Value | Source |
|----------------|-------|--------|
| `a2asrv.WellKnownAgentCardPath` | `"/.well-known/agent-card.json"` | pkg.go.dev/a2asrv |
| `a2a.Version` | `"0.3.0"` (SDK protocol version) | pkg.go.dev/a2a |
| A2A-Version header value (spec v1.0) | `"1.0"` | A2A spec §14.2.1 |
| `a2a.TaskStateCompleted` | `"completed"` | pkg.go.dev/a2a |
| `a2a.MessageRoleAgent` | `"agent"` | pkg.go.dev/a2a |
| `a2a.MessageRoleUser` | `"user"` | pkg.go.dev/a2a |
| JSON-RPC ParseError | `-32700` | JSON-RPC 2.0 spec |
| JSON-RPC InvalidRequest | `-32600` | JSON-RPC 2.0 spec |
| JSON-RPC MethodNotFound | `-32601` | JSON-RPC 2.0 spec |
| JSON-RPC InternalError | `-32603` | JSON-RPC 2.0 spec |
| A2A VersionNotSupportedError | `-32001` (A2A reserved range) | AWS Bedrock A2A contract |

**Note on A2A error codes:** The a2a-go package defines named error variables (`a2a.ErrTaskNotFound`, etc.) not numeric codes. The SDK's JSON-RPC transport layer serializes these to numeric codes. The numeric codes for A2A-specific errors use the range `-32000` to `-32099` (server-defined range per JSON-RPC 2.0 spec). Exact per-error codes are handled by the SDK — do not hardcode them except for the version header guard.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| Hand-rolled JSON-RPC A2A handler | a2a-go v0.3.12 official SDK | Mar 2026 | Do not build a JSON-RPC parser; SDK provides complete transport |
| A2A Tasks for all operations | message/send returns Message OR Task | v0.3.0 (Jul 2025) | Relay can return a `Message` response directly; no task lifecycle required for synchronous relay |
| A2A spec `/.well-known/agent.json` | `/.well-known/agent-card.json` | v0.3.0 | Old implementations used `agent.json`; current SDK constant is `agent-card.json` |
| WebSockets for real-time | SSE via `message/stream` | A2A spec original | SSE is the only spec-mandated streaming transport; WebSocket not in spec |

**Deprecated/outdated:**
- `/.well-known/agent.json`: Old path used in early A2A docs. Current path is `/.well-known/agent-card.json` (confirmed by `a2asrv.WellKnownAgentCardPath` constant).
- `a2a.ErrServerError`: Generic catch-all. Use specific error variables for correct code serialization.

---

## Open Questions

1. **Per-request vs per-room RoomExecutor + Handler construction**
   - What we know: Creating `NewJSONRPCHandler(NewHandler(executor))` per room at creation time is correct. Chi's route matching picks up `{slug}` before reaching the handler.
   - What's unclear: If a room is created while the server is running, the chi router needs to register a new route dynamically, OR a single dynamic handler resolves the room from the URL param. Dynamic route registration is not idiomatic in chi.
   - Recommendation: Use a **single dynamic A2A handler** that extracts `{slug}` from the chi URL param, looks up the room's hub in a `HubRegistry`, and delegates to the correct executor. Avoids dynamic route registration. Plan this explicitly in 02-01.

2. **agent_joined/agent_left event model without Phase 3 SSE**
   - What we know: D-04 requires SSE events on join/leave. SSE transport is Phase 3. Phase 2 must define the event model.
   - What's unclear: Should Phase 2 define the event struct and emit to a stub channel, or defer event definition entirely?
   - Recommendation: Define `RoomEvent` struct (type, payload, timestamp) in Phase 2. Hub emits events to a `events chan RoomEvent` channel that Phase 3 will consume for SSE delivery. The struct and emission logic live in hub.go; SSE serialization in Phase 3.

3. **Cross-room global agent directory (D-07) — database query scope**
   - What we know: DISC-07 requires a global directory of agents in public rooms. Private room agents are hidden.
   - What's unclear: How is "public room" tracked in the presence query? The `rooms.is_private` column (Phase 1 schema) must be joined with `agent_presence`.
   - Recommendation: `GET /agents?skill=X&tag=Y` performs a SQL JOIN between `agent_presence` (active agents) and `rooms` (public only) filtered by heartbeat TTL. Covered by a sqlc query in the presence package.

---

## Sources

### Primary (HIGH confidence)
- [pkg.go.dev/github.com/a2aproject/a2a-go/a2asrv](https://pkg.go.dev/github.com/a2aproject/a2a-go/a2asrv) — AgentExecutor interface, NewHandler, NewJSONRPCHandler, NewStaticAgentCardHandler, WellKnownAgentCardPath, WithExtendedAgentCard option
- [pkg.go.dev/github.com/a2aproject/a2a-go/a2a](https://pkg.go.dev/github.com/a2aproject/a2a-go/a2a) — AgentCard struct, AgentSkill struct, Message struct, error variables, TaskState constants, event types
- [pkg.go.dev/github.com/a2aproject/a2a-go/a2asrv/eventqueue](https://pkg.go.dev/github.com/a2aproject/a2a-go/a2asrv/eventqueue) — Queue interface, Writer.Write, WriteVersioned
- [a2aprotocol.ai/docs/guide/a2a-sample-methods-and-json-responses](https://a2aprotocol.ai/docs/guide/a2a-sample-methods-and-json-responses) — message/send JSON-RPC request/response format
- [docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-a2a-protocol-contract.html](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-a2a-protocol-contract.html) — JSON-RPC error codes with numeric values, well-known agent card path

### Secondary (MEDIUM confidence)
- [a2a-protocol.org/latest/specification/](https://a2a-protocol.org/latest/specification/) — A2A spec: error names, A2A-Version header, VersionNotSupportedError, agent card schema fields
- [a2a-protocol.org/latest/tutorials/python/3-agent-skills-and-card/](https://a2a-protocol.org/latest/tutorials/python/3-agent-skills-and-card/) — AgentSkill structure and two-tier card pattern
- [a2a-protocol.org/v0.2.5/tutorials/python/4-agent-executor/](https://a2a-protocol.org/v0.2.5/tutorials/python/4-agent-executor/) — AgentExecutor.Execute relay pattern (Python, translated to Go)

### Tertiary (LOW confidence — for patterns only)
- Go concurrency ownership pattern (hub goroutine) — established stdlib pattern, no single URL source; see [getstream.io/blog/goroutines-go-concurrency-guide/](https://getstream.io/blog/goroutines-go-concurrency-guide/)

---

## Metadata

**Confidence breakdown:**
- a2a-go SDK API surface: HIGH — verified against pkg.go.dev live docs for v0.3.12
- AgentCard schema fields: HIGH — verified against pkg.go.dev a2a package
- A2A-Version header + error names: HIGH — verified against official A2A spec
- A2A error numeric codes: MEDIUM — -32700/-32600 are standard JSON-RPC 2.0 (spec-defined); A2A-specific codes (-32001 range) confirmed by AWS Bedrock A2A contract but not the official spec page directly
- Hub goroutine pattern: HIGH — standard Go concurrency pattern, no external dependency
- WellKnownAgentCardPath constant value: HIGH — verified `"/.well-known/agent-card.json"` in pkg.go.dev

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (a2a-go is under active development; re-verify AgentExecutor API before Phase 3)
