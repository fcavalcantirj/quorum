# Feature Research

**Domain:** A2A relay service — room-based agent communication and discovery ("IRC for AI agents")
**Researched:** 2026-03-21
**Confidence:** HIGH (A2A spec directly consulted, competitor landscape researched)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features agents/developers assume exist. Missing these = product feels broken or incomplete before they even try it.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Room creation via URL | Core brand promise: "paste one URL, done." Anything else breaks the zero-friction pitch. | LOW | Anonymous public rooms require no account. A UUID or slug URL is the artifact. |
| Bearer token auth for room access | A2A spec requires servers to declare auth schemes. Every A2A client expects to pass a bearer token. | LOW | Token scoped per room. Simple static token for v1 (not JWT/OAuth). |
| `message/send` (synchronous JSON-RPC) | Core A2A method. Any A2A-compliant agent will call this first. Not implementing it = not A2A. | MEDIUM | Relay routes the call to the target agent in the room and returns the response synchronously. |
| `message/stream` (SSE streaming) | A2A spec's second primary interaction mode. Agents doing long-running work rely on streaming. | MEDIUM | SSE endpoint. Needs heartbeat every ~30s to survive proxies. Connection limit awareness (max ~6/domain in browsers). |
| Agent Card publishing on join | The A2A discovery primitive. Without it, agents in a room are invisible to each other. | LOW | Agent card published to room registry when agent connects. Stored in Postgres, TTL-evicted on disconnect. |
| Room-scoped agent discovery (list agents in room) | Without this, joining a room is useless — you can't find who to talk to. Analogous to IRC `/who` command. | LOW | Returns list of Agent Cards for all currently-joined agents. Filterable by skill/tag. |
| Agent disconnect / room leave | Agents leave cleanly or time out. Stale agent cards in the directory erode trust in the data. | LOW | Heartbeat or explicit leave. TTL-based cleanup for unclean disconnects. |
| HTTPS-only transport | A2A spec mandates HTTPS. Any agent team deploying against HTTP will reject the service on security review. | LOW | Non-negotiable per spec. TLS termination at load balancer or Caddy reverse proxy. |
| Stable room URL | Developers copy-paste URLs into agent configs. URL instability = broken agent setups. | LOW | Room URL must be permanent once created. No renaming that breaks existing tokens. |
| Public rooms directory / explore page | Developers need to discover rooms and understand the platform's activity. GitHub's explore page, e2b's sandbox counters — this is the "is this thing alive?" signal. | MEDIUM | Shows public rooms with stats: agent count, message count, created at. Polish is a differentiator but existence is table stakes. |
| Error responses with A2A error codes | A2A spec defines structured JSON-RPC error codes. Agents parse error codes to decide retry logic. Non-standard errors break integrations. | LOW | Standard JSON-RPC error envelope. Map relay-specific errors to appropriate codes. |

### Differentiators (Competitive Advantage)

Features that set Quorum apart. These are where the product competes — not every one needs to be in v1, but the combination is the moat.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero signup for public rooms | No competitor (AgentMeet, Agent Gateway, AgentWorkforce/relay) offers anonymous room creation at this friction level. This is the hook. | LOW | Anonymous rooms: anyone creates, anyone joins with token. Account required only for private rooms — keeps friction minimal. |
| A2A spec compliance (not custom HTTP) | AgentMeet uses custom HTTP. Agent Gateway has no rooms. Quorum is the only room-based A2A-native service. Any A2A-compatible agent works out of the box. | HIGH | Compliance requires implementing the full A2A data model: Task, Message, Part, Artifact. Even for MVP, the wire format must be correct. |
| Skill/capability-based agent discovery | Beyond "list all agents" — filter by skill ID, tag, or input/output mode. Enables automated agent-to-agent discovery within a room. DNS-for-agents inside a namespace. | MEDIUM | Agent Card skill fields from spec: `id`, `name`, `description`, `inputModes`, `outputModes`. Query by any field. |
| Room-scoped Agent Card registry | Central Agent Cards per room rather than per domain (the spec's `/.well-known/agent.json` model). Quorum acts as the curated registry the spec says "is not yet standardized." | MEDIUM | Quorum fills the gap the A2A spec explicitly leaves open: "the current A2A specification does not prescribe a standard API for curated registries." |
| Live room stats on explore page | e2b-style counters: active agents, messages/hour, room age. Signals ecosystem vitality. Developers trust platforms that look alive. | LOW | Counter data already in Postgres. Aggregate query + cached display. No real-time requirement for explore page. |
| One-liner agent integration snippet | The explore/room page shows a ready-to-paste code snippet for major A2A SDKs (Python, JS, Go). Reduces time-to-first-agent from minutes to seconds. | LOW | Static code template with room URL + token interpolated. No runtime logic. |
| Room metadata / tags | Rooms can be tagged by domain (e.g., "coding", "research", "data"). Enables coarse discovery in the public directory without requiring a full agent card query. | LOW | Simple tag array on room model. Filterable in explore page. |
| Extended Agent Card (authenticated) | A2A spec defines `GetExtendedAgentCard` — a richer card visible only to authenticated callers. Private rooms can gate full capability disclosure behind auth. | HIGH | Deferred to v1.x. Requires understanding of which callers are "authenticated" at the relay level. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem obviously useful but introduce complexity or contradict the core positioning.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| A2A Task lifecycle (stateful tasks) | Tasks are a first-class A2A concept. Developers will ask "where are my task states?" | Tasks require persistent state management, retry logic, artifact storage, and push notification webhooks. This triples backend complexity for v1. Agents can coordinate via messages without formal task tracking. PROJECT.md explicitly deferred this. | Implement `message/send` and `message/stream`. Let agents maintain task state internally. Revisit in v2 when demand is validated. |
| A2A Push Notifications (webhooks) | "I want async callbacks when my task completes" — natural request. | Requires webhook registration, delivery guarantees, retry queues, and HTTP POST to arbitrary URLs (security surface). Depends on Task lifecycle existing first. | SSE streaming covers the real-time case. Synchronous send covers the one-shot case. Webhooks are v2. |
| OAuth / JWT bearer tokens | "Bearer tokens are insecure, we need OAuth" — valid security concern. | OAuth flow adds redirect dance, token refresh, PKCE, provider setup. For v1 dev audience, a static bearer token per room is sufficient and matches the IRC mental model (channel key). | Static bearer token per room for v1. Clear upgrade path to JWT signing in v2. Token rotation is a room operation. |
| CLI tool (`npx quorum join`) | Developers want terminal-first experience. | CLI is a separate artifact to build, document, and maintain. Adds distribution complexity. The one-liner integration snippet on the room page achieves 80% of the value with 0% of the maintenance. | Room page shows SDK snippet. CLI is v2 if web-first proves successful. |
| Paid tiers / usage metering | "How do we monetize?" | Billing requires Stripe integration, usage tracking, quota enforcement, plan management UI, and customer support surface — before product-market fit. | Ship free tier. Validate demand. Add metering when users ask to pay. |
| Persistent message history | "I want to see what agents said before I joined" | Message persistence for arbitrary history requires storage planning, privacy decisions (can other agents read history?), retention policies, and search. The IRC model: you only see messages while you're in the room. | Messages are in-flight only. Agents maintain their own context. History is a v2 premium feature. |
| Broadcast to all agents in room | "Send one message to everyone" | Fan-out at relay level breaks the A2A peer-to-peer model. It introduces message deduplication concerns and partial-failure handling. | Agents discover peers via Agent Card registry and send individual messages. Orchestrator agent pattern handles fan-out at the application layer. |
| WebSocket transport | "SSE is one-directional, WebSockets are better" | WebSocket adds handshake complexity, binary framing, and Go library management. A2A v1 spec transport is JSON-RPC over HTTP + SSE. Introducing WebSockets would be non-standard. | SSE for server-to-client streaming. Standard HTTP POST for client-to-server. This matches A2A spec exactly. |
| gRPC transport | "More efficient binary protocol" | gRPC requires protobuf schema management, HTTP/2 in Go, and is not the default A2A binding. Most LLM agent SDKs are HTTP/JSON-first. | JSON-RPC over HTTPS is the A2A default binding. Go's `net/http` handles it cleanly with no additional frameworks. |

---

## Feature Dependencies

```
Room creation (slug + token)
    └──requires──> Postgres room model
                       └──requires──> Schema migrations

Bearer token validation
    └──requires──> Room model (token lookup)

message/send (JSON-RPC relay)
    └──requires──> Bearer token validation
    └──requires──> Agent registry (who is in the room?)

message/stream (SSE)
    └──requires──> Bearer token validation
    └──requires──> SSE connection management (heartbeat, cleanup)
    └──enhances──> message/send (same message path, different transport)

Agent Card publishing
    └──requires──> Room membership (must have joined a room first)
    └──feeds──> Agent discovery

Agent discovery (list/filter agents)
    └──requires──> Agent Card publishing
    └──requires──> Room membership

Public rooms directory
    └──requires──> Room model
    └──enhances──> Agent discovery (cross-room visibility of public rooms)

Private rooms
    └──requires──> User accounts (email/password)
    └──conflicts──> Anonymous-only architecture (must gate account creation)

Extended Agent Card (GetExtendedAgentCard)
    └──requires──> Agent Card publishing
    └──requires──> Authentication scheme on the relay (not just room-level bearer token)
    [DEFERRED to v1.x]

A2A Tasks (stateful)
    └──requires──> Persistent task storage
    └──requires──> Task state machine
    └──enables──> Push notifications (webhooks)
    [DEFERRED to v2]

Push notifications
    └──requires──> Task lifecycle
    └──requires──> Webhook delivery queue
    [DEFERRED to v2]
```

### Dependency Notes

- **message/stream requires SSE connection management:** Go's `net/http` supports SSE natively, but the relay must track open connections per room and clean them up on agent disconnect. Heartbeat comments (`: ping\n\n`) every 30s are mandatory to survive proxies.
- **Agent Card publishing requires room membership:** The relay must verify the bearer token before accepting a card publish. Publishing without membership would pollute the registry.
- **Private rooms conflict with anonymous-only architecture:** The user account system exists solely to gate private room ownership. It must not become a barrier for public room creation/joining.
- **message/send and message/stream share the same routing layer:** The relay looks up the target agent's endpoint from the Agent Card registry, then proxies the request. The only difference is the response transport (blocking HTTP vs SSE fan-through).

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates the "IRC for AI agents" concept.

- [ ] Room creation (public, anonymous) — no account required, returns room URL + bearer token
- [ ] Bearer token validation on all agent endpoints
- [ ] `message/send` JSON-RPC relay (sync, proxies to target agent in room)
- [ ] `message/stream` SSE relay (proxies streaming response from target agent)
- [ ] Agent Card publishing on join (POST to room endpoint with agent card)
- [ ] Agent discovery within room (GET agents in room, filter by skill/tag)
- [ ] Agent disconnect / heartbeat-based TTL cleanup
- [ ] Public rooms directory page with live stats (agent count, message count)
- [ ] Room detail page with one-liner integration snippet (SDK-specific)
- [ ] Private rooms (account required) — needed to validate that use case exists
- [ ] REST API for frontend (rooms CRUD, stats, directory listing)

### Add After Validation (v1.x)

Features to add once core loop is working and usage data exists.

- [ ] Extended Agent Card (`GetExtendedAgentCard`) — add when agents start requesting richer capability disclosure
- [ ] Room tags and domain-based explore filtering — add when directory has enough rooms to warrant browsing
- [ ] Token rotation / room key regeneration — add when first user reports a compromised token
- [ ] Rate limiting per room — add when first abuse case is observed
- [ ] Agent session replay / basic room log — add when users ask for debugging history

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] A2A Task lifecycle (stateful tasks: submitted → working → completed) — requires full task state machine; defer until agents demand it
- [ ] A2A Push Notifications (webhooks) — depends on Task lifecycle; defer together
- [ ] A2A Artifacts (file/data sharing) — significant storage and privacy decisions; defer until use case is clear
- [ ] CLI tool (`npx quorum create`) — web-first validation first
- [ ] Paid tiers / usage metering — validate demand before building billing
- [ ] Persistent message history — privacy and storage decisions; validate demand
- [ ] OAuth / JWT tokens — upgrade path from static bearer tokens; defer until enterprise asks
- [ ] gRPC transport binding — add only if A2A ecosystem shifts to gRPC as default

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Room creation (public, anonymous) | HIGH | LOW | P1 |
| Bearer token auth | HIGH | LOW | P1 |
| `message/send` relay | HIGH | MEDIUM | P1 |
| `message/stream` (SSE) relay | HIGH | MEDIUM | P1 |
| Agent Card publishing | HIGH | LOW | P1 |
| Agent discovery (list/filter) | HIGH | LOW | P1 |
| Public rooms directory | MEDIUM | MEDIUM | P1 |
| Private rooms + accounts | MEDIUM | MEDIUM | P1 |
| Integration snippet on room page | HIGH | LOW | P1 |
| Heartbeat / TTL cleanup | HIGH | LOW | P1 |
| Room tags / domain filtering | MEDIUM | LOW | P2 |
| Extended Agent Card | MEDIUM | HIGH | P2 |
| Rate limiting | MEDIUM | MEDIUM | P2 |
| Token rotation | MEDIUM | LOW | P2 |
| A2A Tasks lifecycle | HIGH | HIGH | P3 |
| Push notifications (webhooks) | MEDIUM | HIGH | P3 |
| A2A Artifacts | MEDIUM | HIGH | P3 |
| Persistent message history | MEDIUM | HIGH | P3 |
| CLI tool | LOW | MEDIUM | P3 |
| gRPC transport | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | AgentMeet | Agent Gateway | AgentWorkforce/relay | Quorum (plan) |
|---------|-----------|---------------|----------------------|----------------|
| Room-based model | Yes — custom HTTP | No — point-to-point | Channels (not rooms) | Yes — A2A native rooms |
| A2A protocol compliance | No — custom HTTP | Yes — A2A native | No — MCP layer | Yes — A2A v1.0 |
| Anonymous / no-signup | Unknown | No | No | Yes — public rooms |
| Bearer token auth | Unknown | OAuth/enterprise | API key | Yes — per-room bearer |
| Agent Card discovery | No | Yes — registry | No | Yes — per-room registry |
| Skill-based filtering | No | Partial | No | Yes |
| SSE streaming | Unknown | Yes | Yes (websocket) | Yes |
| Public directory | No | No | No | Yes — explore page |
| Zero-friction join | Low (signup) | Low (enterprise) | Low (SDK setup) | High — URL + token |

**Gap Quorum fills:** No existing service combines room-based discovery + A2A compliance + zero-signup + bearer auth. Quorum's moat is that combination, not any single feature.

---

## Sources

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/) — JSON-RPC methods, data model, security requirements (HIGH confidence — official spec)
- [A2A Agent Discovery](https://a2a-protocol.org/latest/topics/agent-discovery/) — Well-known URI, curated registry, direct config patterns (HIGH confidence — official spec)
- [A2A GitHub Repository](https://github.com/a2aproject/A2A) — Protocol status, SDK support, 22K+ stars (HIGH confidence)
- [Agent Gateway Protocol (AGP) Tutorial](https://a2aprotocol.ai/blog/agent-gateway-protocol) — Policy-based routing, capability announcements (MEDIUM confidence — community blog)
- [AgentWorkforce/relay GitHub](https://github.com/AgentWorkforce/relay) — Channel model, TypeScript/Python SDK, message broadcasting (MEDIUM confidence — GitHub)
- [Google Developers Blog: A2A Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) — Protocol rationale, 50+ partners (HIGH confidence — official)
- [AI Agent Tools Landscape 2026 — StackOne](https://www.stackone.com/blog/ai-agent-tools-landscape-2026/) — MCP as table stakes, A2A ecosystem position (MEDIUM confidence)
- [Agent Discovery Naming Resolution — Solo.io](https://www.solo.io/blog/agent-discovery-naming-and-resolution---the-missing-pieces-to-a2a) — Gap in A2A discovery that curated registries fill (MEDIUM confidence)
- [SSE Practical Guide — tigerabrodi.blog](https://tigerabrodi.blog/server-sent-events-a-practical-guide-for-the-real-world) — Heartbeat, proxy config, connection management (MEDIUM confidence)
- [Bearer Token Security in Agent Relay — Security Boulevard](https://securityboulevard.com/2025/10/agent-credential-replay-why-bearer-tokens-are-digital-cash-in-a-tornado/) — Token relay pitfalls (MEDIUM confidence)

---

*Feature research for: A2A relay service (Quorum)*
*Researched: 2026-03-21*
