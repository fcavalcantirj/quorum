# Phase 3: Streaming and Deploy - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents subscribe to a room's SSE stream and receive relayed messages in real time. Join/leave presence events flow over SSE. The Go server runs on the Hostinger VPS via Easypanel with TLS. SSE streams stay alive through the proxy. Zero goroutine leaks confirmed under disconnect scenarios.

</domain>

<decisions>
## Implementation Decisions

### Deployment model
- **D-01:** Everything managed by code — Dockerfile handles the entire Go server build. No manual VPS configuration needed.
- **D-02:** Deploy via git push + Easypanel. Easypanel is already installed and running on the Hostinger VPS. Create a new service pointing to the repo.
- **D-03:** TLS via Let's Encrypt with auto-renewal. Easypanel or certbot handles certificate provisioning and renewal.
- **D-04:** Nginx/Traefik proxy config managed by Easypanel — SSE-specific settings (proxy_read_timeout, proxy_buffering off) configured in the Easypanel service or Dockerfile entrypoint.

### SSE streaming
- **D-05:** SSE delivers real-time events: `agent_joined`, `agent_left`, `message` (relayed A2A messages), `heartbeat` comments. Event model defined in Phase 2, transport implemented here.
- **D-06:** Heartbeat comments every 15-25 seconds to keep connections alive through proxies (per A2A-03 requirement).

### Connection limits & cleanup
- **D-07:** Claude's discretion — max SSE connections per room and per server, based on Hostinger VPS resource constraints. Graceful rejection when limits are hit.

### SSE reconnection
- **D-08:** Claude's discretion — pick based on A2A spec patterns and complexity tradeoff. Options: reconnect fresh (re-query room info) vs short replay buffer with Last-Event-ID.

### Claude's Discretion
- SSE reconnection strategy (D-08)
- Connection limits per room and per server (D-07)
- Goroutine cleanup mechanics on disconnect
- Dockerfile multi-stage build details
- Easypanel service configuration specifics
- Nginx/Traefik SSE proxy tuning parameters

</decisions>

<specifics>
## Specific Ideas

- "All managed by code, I don't need to manually do anything. Dockerfile takes care of everything."
- "Deploy we use git and Easypanel"
- Easypanel is the deployment platform — no raw systemd/nginx config needed, Easypanel abstracts it
- SSE must survive proxy layers — Easypanel's reverse proxy needs proper SSE passthrough config

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Room TTL (3-day inactivity), rate limiting, auth model
- `.planning/phases/02-a2a-core/02-CONTEXT.md` — SSE event types (agent_joined, agent_left), heartbeat extends room TTL, room event loop model

### Project specs
- `.planning/PROJECT.md` — Deployment constraint (Vercel frontend, Hostinger VPS for Go + Postgres)
- `.planning/REQUIREMENTS.md` — A2A-02 (message/stream SSE), A2A-03 (heartbeat 15-25s), INFRA-03 (VPS with HTTPS)
- `.planning/ROADMAP.md` — Phase 3 plans (03-01, 03-02), success criteria, goleak test requirement

### Technology stack
- `CLAUDE.md` §Technology Stack — jetify-com/sse for SSE primitives, a2asrv HTTP transport, Go 1.26 stdlib net/http

### External
- A2A v1.0 spec — `message/stream` SSE transport requirements, heartbeat comment format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 2 delivers: room event loop, message routing, agent registry, join/leave event model
- Phase 1 delivers: chi router, bearer token middleware, Postgres pool, rate limiter
- a2asrv may provide built-in SSE transport helpers — research in Phase 2

### Established Patterns
- Room event loop (Phase 2) — SSE subscriptions attach to the same hub
- Bearer token auth (Phase 1) — SSE connections authenticated the same way

### Integration Points
- SSE handler mounts on chi router alongside REST and A2A JSON-RPC routes
- Room hub gains SSE subscriber management (add on connect, remove on disconnect)
- Dockerfile must include: Go binary build, goose migrations embedded, health check endpoint
- Easypanel service config: git repo URL, Dockerfile path, port mapping, env vars (DATABASE_URL, JWT_SECRET, etc.)

</code_context>

<deferred>
## Deferred Ideas

- Horizontal scaling with Redis pub/sub — v2, single VPS for v1
- Room capacity validation against VPS limits — monitor after deploy, tune limits
- Blue-green deployment — Easypanel handles rolling restarts, no custom strategy needed for v1
- CI/CD pipeline — git push to Easypanel is sufficient for v1

</deferred>

---

*Phase: 03-streaming-deploy*
*Context gathered: 2026-03-22*
