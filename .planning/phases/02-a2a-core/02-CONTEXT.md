# Phase 2: A2A Core - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents can join a room with their bearer token, publish their Agent Card, see other agents in the room, and exchange synchronous messages via the A2A `message/send` JSON-RPC method. Room presence is real-time — agents see when others join or leave.

</domain>

<decisions>
## Implementation Decisions

### Agent Card model
- **D-01:** Global card + room presence — agent registers a global card once (at `/a/{agent-name}/.well-known/agent.json`), joining a room creates a presence entry pointing to the global card. Research needed to confirm best A2A-spec-aligned URL pattern.
- **D-02:** Two-tier cards: public card (name, description, skills) visible without auth; extended card (full capabilities, endpoints, input/output modes) requires bearer token. Per A2A spec and PROJECT.md decision.

### Agent join & presence
- **D-03:** Explicit join handshake — agent POSTs to a join endpoint with its Agent Card. This registers presence in the room. Joining is separate from messaging — an agent can be present without having sent any message.
- **D-04:** Join notification via SSE — when an agent joins, all other agents subscribed to the room's stream receive an `agent_joined` event with the new agent's card. Same for `agent_left` on disconnect/TTL expiry.
- **D-05:** Agent heartbeat extends room TTL — heartbeats count as room activity. Room's 3-day inactivity TTL (from Phase 1 D-05) resets on agent heartbeats, messages, or human activity.

### Room info (not "discovery filtering")
- **D-06:** Room info endpoint (`/r/{slug}/info` or similar) returns full room state: all connected agents with their cards, room stats (message count, uptime, agent count), room metadata. No filtering needed — agents in the same room can see everyone. This is just "who's in the room?"
- **D-07:** Cross-room discovery — agents can query a global directory of agents in public rooms. Private room agents stay hidden. This is the real "discovery" use case.

### Room event loop
- **D-08:** Claude's discretion based on research. Per-room goroutine hub, in-memory registry, message routing model. Must support real-time presence events (join/leave) and synchronous message relay.

### Error handling
- **D-09:** Claude's discretion. Research A2A spec error codes and implement spec-compliant responses. Malformed cards, unknown targets, oversized messages — all should return proper A2A JSON-RPC errors.

### Claude's Discretion
- Room event loop architecture (D-08)
- A2A error handling granularity (D-09)
- Agent heartbeat interval and TTL mechanics
- Global Agent Card URL pattern (research A2A spec alignment for D-01)
- Exact join endpoint path and payload format
- MessageBus interface usage for room fanout

</decisions>

<specifics>
## Specific Ideas

- "If agents are in the same room, they don't need to 'find' each other — room info lists everyone"
- "For everybody in the room, they must see a new user arrived... how would others know if it's on first message only?"
- Agent join should feel like entering an IRC channel — explicit entry, presence announced, then you can talk or just listen
- Cross-room discovery of public room agents enables the "marketplace" feel

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Room URL format (`/r/{slug}`), bearer token decisions, rate limiting, auth model (OAuth only)

### Project specs
- `.planning/PROJECT.md` — Two-tier Agent Cards decision, MessageBus abstraction requirement, a2a-go SDK concern
- `.planning/REQUIREMENTS.md` — A2A-01, A2A-04, A2A-05, DISC-01 through DISC-07
- `.planning/ROADMAP.md` — Phase 2 plans (02-01, 02-02), success criteria, type-safe RoomID requirement

### Technology stack
- `CLAUDE.md` §Technology Stack — a2a-go v0.3.12, chi v5 routing, Stack Patterns for a2asrv + chi integration

### External protocol
- A2A v1.0 spec at `a2a-protocol.org/latest/specification/` — JSON-RPC 2.0, Agent Card schema, error codes, `message/send` method, `A2A-Version` header requirement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1 delivers: chi router, bearer token middleware, rate limiter, room CRUD, Postgres pool, goose migrations
- MessageBus abstraction (interface defined in Phase 1) — Phase 2 implements in-memory version for room fanout
- Type-safe `RoomID` (`type RoomID uuid.UUID`) defined in Phase 2 per STATE.md decision

### Established Patterns
- Bearer token auth middleware (Phase 1) — reuse for A2A endpoint protection
- Room CRUD REST pattern (Phase 1) — extend for A2A-specific endpoints

### Integration Points
- A2A endpoints mount alongside REST routes on chi router
- a2asrv `AgentExecutor` interface — room executor routes to correct room's hub
- Agent join triggers SSE event to room subscribers (SSE transport built in Phase 3, but event model defined here)

</code_context>

<deferred>
## Deferred Ideas

- SSE streaming transport — Phase 3 (join/leave events defined here, but SSE delivery is Phase 3)
- A2A Tasks lifecycle (submitted/working/completed) — v2
- A2A Artifacts exchange — v2
- Agent-to-agent direct messaging outside rooms — not in scope

</deferred>

---

*Phase: 02-a2a-core*
*Context gathered: 2026-03-22*
