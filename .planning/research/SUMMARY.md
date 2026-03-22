# Project Research Summary

**Project:** Quorum — A2A relay service ("IRC for AI agents")
**Domain:** Room-based multi-agent communication relay with A2A protocol compliance
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

Quorum is a room-based relay service that lets AI agents discover each other and communicate using the A2A protocol (Agent-to-Agent, v1.0). The core concept maps directly to IRC: agents join a named room via a URL + bearer token, publish their Agent Card (capability manifest), discover peers, and exchange messages via JSON-RPC. The market gap is real — no existing service combines A2A compliance, room-based discovery, and zero-signup access. The recommended implementation is a Go relay server (goroutine-per-room hub pattern) on the existing Hostinger VPS, with the existing Next.js 16.2 frontend on Vercel handling the marketing site, explore directory, and room management UI.

The recommended approach builds in strict dependency order: schema first, then the Go server skeleton, then auth, then the A2A protocol endpoints (message/send before message/stream), then frontend wiring. The A2A protocol is the hard constraint — the Go `a2a-go` SDK (v0.3.12) must be used rather than hand-rolling JSON-RPC compliance. SSE streaming is mandated by the A2A spec for `message/stream`, and that transport has well-known infrastructure pitfalls (nginx proxy timeouts, goroutine leaks) that must be designed in from the start, not patched post-launch.

The primary risk category is correctness at the protocol and infrastructure boundary: goroutine leaks from unclean SSE disconnects are a documented production failure mode for this exact architecture; A2A spec compliance theater (declaring capabilities before implementing them) breaks real agent SDK clients; and bearer tokens in URL query strings are a security anti-pattern that cannot be cleaned up after the fact. All three must be addressed in the foundation phase, not deferred. The in-memory room state model is appropriate for v1 single-VPS deployment but must be abstracted behind a `MessageBus` interface from day one to enable the Postgres LISTEN/NOTIFY migration path when horizontal scaling becomes necessary.

---

## Key Findings

### Recommended Stack

The Go backend is built around the official `a2a-go` v0.3.12 SDK, which provides the A2A server handler, client, and protocol types. The SDK requires Go 1.24 minimum; use Go 1.26 (current stable, Feb 2026) for the Green Tea GC and stack-allocated slices. The HTTP layer pairs `chi` v5.2.5 (net/http-compatible, zero-deps) with the a2asrv handler mounted on A2A paths, while chi routes handle the REST API. Postgres 16 (already on VPS) is the persistence layer, accessed via `pgx/v5` with `pgxpool` — the 30-50% throughput advantage over lib/pq matters at message volume. `sqlc` v1.30.0 generates type-safe Go from SQL, preventing schema drift. `goose` v3.27.0 handles migrations embedded in the binary.

A critical exclusion: do not use Fiber as the Go router. Fiber uses fasthttp, which is not `net/http`-compatible. `a2asrv` registers standard `http.Handler` — Fiber breaks the A2A endpoint integration. Also avoid WebSockets for streaming (A2A spec mandates SSE), Redis for pub/sub (single-VPS in-memory channels are sufficient for v1), and any token delivery via URL query strings (security anti-pattern with no recovery path).

**Core technologies:**
- Go 1.26: Relay server runtime — goroutine model maps naturally to per-room fan-out.
- github.com/a2aproject/a2a-go v0.3.12: Official A2A SDK — do not hand-roll protocol compliance.
- Next.js 16.2: Frontend — existing, non-negotiable; Turbopack default in 16.x.
- PostgreSQL 16: Persistence — already on Hostinger VPS; rooms, tokens, agent cards, stats.
- github.com/jackc/pgx/v5 v5.9.0: Postgres driver + pool — 30-50% faster than lib/pq.
- github.com/sqlc-dev/sqlc v1.30.0: Type-safe SQL-to-Go generation — prevents schema-drift bugs.
- github.com/go-chi/chi v5.2.5: HTTP router — net/http-compatible, zero external deps.
- github.com/pressly/goose/v3 v3.27.0: Migrations — embedded in binary, pgx v5 support.
- github.com/golang-jwt/jwt/v5: Auth — current community standard; avoid archived dgrijalva/jwt-go.

### Expected Features

The competitive moat is the combination of four properties no competitor has simultaneously: A2A protocol compliance, room-based discovery, zero-signup public rooms, and per-room bearer token auth. AgentMeet uses custom HTTP (not A2A). Agent Gateway is A2A-native but has no rooms. AgentWorkforce/relay has channels but not A2A compliance. Quorum is the only A2A-native room relay.

**Must have (table stakes):**
- Room creation via URL, no signup required — the zero-friction brand promise.
- Bearer token auth on all A2A endpoints — A2A spec requirement; every SDK client expects this.
- `message/send` JSON-RPC relay (synchronous) — core A2A method; not implementing it = not A2A.
- `message/stream` SSE relay — A2A's second primary interaction mode; agents doing long-running work need it.
- Agent Card publishing on room join — A2A discovery primitive; without it, agents are invisible to each other.
- Room-scoped agent discovery (list/filter agents) — joining a room is useless without knowing who's there.
- Agent disconnect / heartbeat-based TTL cleanup — stale cards erode trust in discovery data.
- HTTPS-only transport — A2A spec mandates it; agents reject non-HTTPS services.
- Public rooms explore directory — the "is this thing alive?" signal; developers trust active platforms.
- REST API for frontend (rooms CRUD, stats, directory listing) — required for website functionality.
- One-liner agent integration snippet on room page — reduces time-to-first-agent from minutes to seconds.

**Should have (competitive):**
- Skill/capability-based agent discovery — filter by skill ID, tag, input/output mode; DNS-for-agents inside a room.
- Room tags and domain-based filtering — coarse discovery in the explore directory.
- Token rotation / room key regeneration — security hygiene; add when first user reports a compromised token.
- Rate limiting per room and per IP — prevents abuse of anonymous public rooms.
- Extended Agent Card (GetExtendedAgentCard) — richer capability disclosure for authenticated callers.

**Defer (v2+):**
- A2A Task lifecycle (stateful tasks) — triples backend complexity; defer until agents demand it.
- A2A Push Notifications (webhooks) — depends on Task lifecycle; defer together.
- Persistent message history — privacy and storage decisions; the IRC model (no history before join) is intentional for v1.
- CLI tool (npx quorum create) — web-first validation first.
- OAuth / JWT tokens — upgrade path from static bearer tokens; defer until enterprise asks.
- Paid tiers / usage metering — validate demand before building billing.

### Architecture Approach

The system splits cleanly across two deployment targets: Vercel (Next.js, CDN-delivered) for the website and room management UI, and Hostinger VPS (Go binary, systemd) for the relay server and Postgres. The key boundary: A2A endpoints (message/send, message/stream, agent card, agent discovery) live exclusively on the Go server domain (e.g., `relay.quorum.dev`). The Next.js frontend at `quorum.dev` on Vercel only calls Go REST endpoints for room management. Agents never route through the Next.js layer — SSE connections through Vercel have hard serverless timeouts that would kill long-lived streams.

The Go relay's central abstraction is the per-room goroutine event loop (Hub pattern): one goroutine per active room running a `select` over join/leave/broadcast channels. All room state mutations happen in that goroutine — no locks on the room itself. SSE connections from agents are handled one goroutine per connection, writing `data: {}\n\n` frames via `http.Flusher`. The message hot path (broadcast fan-out) is entirely in-memory; Postgres writes happen asynchronously via a buffered background goroutine.

**Major components:**
1. Next.js App (Vercel) — Marketing, explore directory, room detail, auth UI; Route Handlers as BFF for Go REST API.
2. Go HTTP Router (chi) — Routes all requests; applies auth, CORS, rate-limit middleware; mounts a2asrv on A2A paths.
3. Room Registry — In-memory `sync.RWMutex`-protected map of active Room goroutines; lazy-loaded from Postgres on first agent join.
4. Room Event Loop — Per-room goroutine; fan-out via buffered channels to all connected SSE member streams.
5. A2A JSON-RPC Handler — Parses message/send and message/stream; dispatches to Room; formats responses per A2A spec.
6. SSE Stream Handler — Holds open HTTP connections; writes A2A events as SSE frames; heartbeat every 15-25s.
7. Auth Middleware — Bearer token lookup against Postgres for agents; JWT session for website users.
8. PostgreSQL — Rooms, users, tokens, agent card metadata, message logs; source of truth for REST API; in-memory state is ephemeral.

### Critical Pitfalls

1. **Goroutine leak from missing disconnect cleanup** — Every SSE handler must call `defer cancel()` immediately; detect write errors as the primary disconnect signal; expose `runtime.NumGoroutine()` as a metric; use goleak in integration tests. A real production system reached 50,847 goroutines from this exact failure mode.

2. **A2A spec compliance theater** — Do not declare `streaming: true` in Agent Cards until streaming is fully implemented and tested against the A2A Go SDK's own reference client. Every JSON-RPC response must be wrapped in proper `jsonrpc: "2.0"` envelope structure — SDK clients validate this strictly.

3. **SSE killed by nginx proxy** — Default `proxy_read_timeout 60s` silently kills idle SSE streams. Configure: `proxy_read_timeout 3600s; proxy_buffering off; chunked_transfer_encoding on;`. Send SSE keepalive comment events (`: keepalive\n\n`) every 15-25 seconds.

4. **Bearer token in URL query strings** — Never accept tokens in query strings for any reason. This cannot be cleaned up after the fact: tokens appear in nginx logs, browser history, and monitoring systems permanently. Reject URL tokens with 400 from day one.

5. **Cross-room message contamination** — Use `type RoomID uuid.UUID` in Go to prevent raw-string room ID bugs. The subscriber map must be two-level: `map[RoomID]map[SubscriberID]chan Message`. Integration tests must always create two rooms and verify isolation.

---

## Implications for Roadmap

Based on combined research, the architecture's dependency ordering and the pitfall prevention requirements suggest 5 phases:

### Phase 1: Foundation — Schema, Server Skeleton, Auth, Rate Limiting

**Rationale:** Nothing else can run without the Postgres schema. Auth and rate limiting must be in place before any public route is exposed — retrofitting them post-launch means tokens appear in logs and anonymous rooms get abused immediately. The `MessageBus` abstraction must be designed here even though only the in-memory implementation ships in v1.

**Delivers:** Working Go server that boots, connects to Postgres, applies migrations, validates bearer tokens, rate-limits room creation, and returns health. No A2A endpoints yet, but the security and data model are correct.

**Addresses features:** Room creation (Postgres model only), bearer token auth, rate limiting, HTTPS termination.

**Avoids pitfalls:** Bearer token in URL/logs (never accept from day one), cross-room contamination (type-safe RoomID from day one), public room abuse (rate limit middleware before any public route), in-memory scaling trap (MessageBus interface defined here).

**Research flag:** Standard patterns — chi middleware, pgx/v5, goose migrations are well-documented. Skip phase research.

---

### Phase 2: Room Registry and A2A Core Protocol

**Rationale:** The room event loop is the central abstraction of the entire service. It must be built and tested in isolation before HTTP handlers are added on top. `message/send` before `message/stream` — synchronous JSON-RPC is simpler and validates the room goroutine pattern before adding SSE complexity.

**Delivers:** Working in-memory Room Registry with goroutine event loop. `message/send` JSON-RPC endpoint that validates tokens, routes to the correct room, and returns spec-compliant responses. Agent Card publishing on join. Agent discovery endpoint.

**Addresses features:** message/send relay, Agent Card publishing, agent discovery (list/filter).

**Avoids pitfalls:** A2A spec compliance theater (test against a2a-go SDK reference client before declaring compliance), cross-room contamination (two-room isolation integration test required before phase is complete).

**Research flag:** The a2a-go v0.3.12 SDK surface is documented but sparse — specifically how `a2asrv.AgentExecutor` integrates with a custom room-routing layer. Needs hands-on exploration during implementation.

---

### Phase 3: SSE Streaming and Infrastructure Validation

**Rationale:** SSE streaming (`message/stream`) is the hard part — it introduces goroutine lifecycle management, proxy configuration, and the most common failure mode (goroutine leaks). It must be tested end-to-end through nginx on the actual VPS before being declared done. This phase cannot be done locally only.

**Delivers:** Working `message/stream` SSE endpoint with heartbeat keepalives, goroutine cleanup on disconnect, and verified operation through nginx on Hostinger. goleak integration test confirming zero goroutine leaks after agent disconnect. Nginx configured with correct proxy timeouts and buffering disabled.

**Addresses features:** message/stream SSE relay, heartbeat/TTL cleanup, agent disconnect handling.

**Avoids pitfalls:** Goroutine leak (goleak test required), SSE killed by nginx proxy (test through nginx required — not just local Go port), A2A compliance theater (capabilities.streaming only declared after this phase completes).

**Research flag:** SSE through nginx + systemd on Hostinger has deployment-specific configuration. May need hands-on research during phase planning.

---

### Phase 4: Frontend Integration and Explore Directory

**Rationale:** With the Go API working end-to-end, the Next.js frontend stubs can be replaced with real API calls. The explore directory and room detail page are the user-facing proof that the system works. This is also when the one-liner integration snippet is added — a high-value, low-complexity feature that drives agent adoption.

**Delivers:** Functional explore page showing public rooms with live stats (agent count, message count, room age). Room detail page with room-specific integration snippets for major A2A SDKs. Next.js Route Handlers wired to Go REST API (replacing stubs). Private rooms with user account creation gating.

**Addresses features:** Public rooms directory, room detail + integration snippet, private rooms (user accounts), REST API wiring, room tags.

**Avoids pitfalls:** Anti-pattern of using Next.js rewrites to proxy SSE (agents connect directly to Go server URL; frontend never proxies A2A traffic), Agent Card/relay identity confusion (explore page must clearly show room discovery API vs. /.well-known/agent.json semantics).

**Research flag:** Standard patterns — Next.js App Router, Route Handlers as BFF. Skip phase research.

---

### Phase 5: Hardening, Observability, and v1.x Features

**Rationale:** Before treating v1 as launch-ready, the security checklist from PITFALLS.md must be verified: token in URL returns 400, cross-room isolation confirmed, rate limit smoke tested, SSE reconnect works, room auto-expiry fires correctly, stale agents filtered from discovery. Extended Agent Card and token rotation are in this phase as they require the core system to be stable.

**Delivers:** All "Looks Done But Isn't" checklist items verified. Goroutine count Prometheus metric with alerting. Extended Agent Card (GetExtendedAgentCard). Token rotation endpoint. Room auto-expiry with SSE disconnect event. Discovery filtered to exclude stale agents.

**Addresses features:** Extended Agent Card (v1.x), token rotation, rate limiting tuning, room expiry warning, stale agent filtering.

**Avoids pitfalls:** All security mistakes from PITFALLS.md security table. Goroutine leak confirmed via goleak + load test. Discovery accuracy (dead agents filtered after TTL).

**Research flag:** Extended Agent Card requires understanding authenticated-caller semantics at the relay level — may need spec research during phase planning.

---

### Phase Ordering Rationale

- Schema before everything: no component can be built without the data model.
- Auth before A2A endpoints: anonymous public endpoints are abuse magnets.
- message/send before message/stream: SSE adds goroutine lifecycle complexity that should not be debugged alongside JSON-RPC correctness simultaneously.
- SSE before frontend: frontend integration should wire to a proven backend, not discover protocol bugs through UI testing.
- Hardening last: makes no sense to harden features that aren't complete.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2:** a2a-go v0.3.12 AgentExecutor interface integration with custom room-routing — SDK documentation is sparse, needs hands-on exploration.
- **Phase 3:** Nginx + systemd SSE configuration on Hostinger VPS — deployment-specific, needs validation in the actual environment.
- **Phase 5:** Extended Agent Card authenticated-caller semantics at relay level — spec has nuances around which callers qualify.

Phases with standard patterns (can skip `/gsd:research-phase`):
- **Phase 1:** chi middleware, pgx/v5 pool setup, goose migrations — extensively documented.
- **Phase 4:** Next.js App Router, Route Handlers as BFF — official Next.js documentation is comprehensive.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions verified against pkg.go.dev and official release notes. Only gap: a2a-go v0.3.12 internal API surface is sparse in docs (MEDIUM for that specific surface). |
| Features | HIGH | A2A spec consulted directly. Competitor landscape researched. Feature dependencies mapped. MVP definition is well-grounded in spec requirements. |
| Architecture | HIGH | A2A spec is public and well-documented. Go SSE + hub pattern has multiple post-mortems and production references. Vercel + VPS split deployment is a known pattern. |
| Pitfalls | HIGH | Core pitfalls backed by official spec, verified production post-mortems (goroutine leak: real case study with numbers), and multiple independent sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **a2a-go AgentExecutor API surface:** The SDK is at v0.3.12 with sparse public documentation. The exact interface for plugging a custom room-routing RoomExecutor into `a2asrv` will need hands-on exploration during Phase 2. Plan for a spike day.
- **Hostinger VPS nginx configuration specifics:** The nginx config for SSE (proxy_read_timeout, proxy_buffering off) is standard, but Hostinger's managed panel may have constraints. Verify during Phase 3 before declaring SSE complete.
- **Private room user account model:** The feature list includes private rooms requiring user accounts, but the authentication model (email/password, magic link, OAuth) was not scoped. This decision affects Phase 4 implementation and should be resolved in requirements.
- **Room capacity limits:** Research recommends max 50 SSE connections per room for v1, but the correct number depends on the VPS spec (RAM, file descriptors). Validate against actual Hostinger VPS resources before setting the limit.

---

## Sources

### Primary (HIGH confidence)
- A2A Protocol Specification (a2a-protocol.org/latest/specification/) — JSON-RPC methods, data model, security requirements, streaming spec.
- A2A Agent Discovery (a2a-protocol.org/latest/topics/agent-discovery/) — Well-known URI, curated registry patterns.
- github.com/a2aproject/a2a-go (v0.3.12, Mar 20 2026) — Official Go SDK; AgentExecutor interface, server and client packages.
- pkg.go.dev/github.com/jackc/pgx/v5 (v5.9.0, Mar 21 2026) — Driver and pgxpool documentation.
- docs.sqlc.dev — sqlc v1.30.0, pgx/v5 integration guide.
- go.dev/blog/go1.26 — Go 1.26 release (Feb 10 2026), current stable.
- nextjs.org/blog/next-16-2 — Next.js 16.2 (Mar 18 2026), current stable.
- github.com/go-chi/chi (v5.2.5) — chi router documentation.
- github.com/pressly/goose/releases (v3.27.0) — Goose migration tool.

### Secondary (MEDIUM confidence)
- Agent Gateway Protocol Tutorial (a2aprotocol.ai) — Competitor analysis reference.
- AgentWorkforce/relay GitHub — Channel model comparison.
- solo.io: Agent Discovery: The Missing Pieces to A2A — Curated registry gap in the spec.
- Finding and Fixing a 50,000 Goroutine Leak (skoredin.pro) — Production post-mortem for goroutine leak pitfall.
- Horizontal Scaling of a Stateful Server with Redis pub/sub (WalkMe Engineering) — MessageBus abstraction reference.
- A Security Engineer's Guide to the A2A Protocol (Semgrep) — Security pitfalls.
- SSE Practical Guide (tigerabrodi.blog) — Heartbeat, proxy config, connection management.
- How to Build Real-time Applications with Go and SSE (oneuptime.com/blog) — Go SSE handler patterns.

### Tertiary (LOW confidence)
- github.com/jetify-com/sse — SSE library; actively maintained but version not pinned in research.
- AI Agent Tools Landscape 2026 (StackOne) — Market positioning context.

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
