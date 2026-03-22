# Pitfalls Research

**Domain:** A2A relay service — room-based agent communication with SSE streaming and Go backend
**Researched:** 2026-03-21
**Confidence:** HIGH (core pitfalls backed by official spec, verified post-mortems, and multiple independent sources)

---

## Critical Pitfalls

### Pitfall 1: Goroutine Leak from Missing Disconnect Cleanup

**What goes wrong:**
Every SSE connection spawns goroutines (message pump, heartbeat, context wait). When an agent disconnects — network drop, timeout, or normal close — those goroutines never terminate because the disconnect event is never propagated to the cleanup path. Memory and goroutine count grow monotonically. A real production system went from 1,200 goroutines at launch to 50,847 goroutines in six weeks, consuming 47 GB of RAM with 32-second response times, from a WebSocket notification service with identical structure to Quorum's SSE room model.

**Why it happens:**
Developers test with clean disconnects (browser tab close sends FIN) but not with network drops or client crashes. The "happy path" works fine. The cleanup handler is added as an afterthought — or not at all. The subscribe map accumulates dead entries with no expiry.

**How to avoid:**
- Every SSE handler MUST call `defer cancel()` immediately after creating the context, ensuring cleanup even on early return paths.
- Use `http.CloseNotifier` or detect write errors to trigger disconnect cleanup.
- Never use `time.NewTicker` without `defer ticker.Stop()` in the same function scope.
- Maintain a subscriber map scoped per room; when a write to a subscriber channel fails, remove that subscriber immediately.
- Use `github.com/uber-go/goleak` in integration tests — it fails if goroutines remain alive after a test ends.
- Expose `runtime.NumGoroutine()` as a Prometheus metric with alerting at 2x expected baseline.

**Warning signs:**
- Goroutine count climbing steadily in dashboards without corresponding traffic growth.
- Memory increasing without obvious cause between restarts.
- SSE connections appearing active in metrics but not delivering messages.

**Phase to address:** Go relay server foundation phase (the very first Go milestone). The architecture for subscriber lifecycle must be correct from the start — retrofitting it after rooms are built causes rewrites.

---

### Pitfall 2: A2A Spec Compliance Theater — Declaring Capabilities You Don't Implement

**What goes wrong:**
Agent Cards declare `"streaming": true` or `"pushNotifications": true` but the relay doesn't actually implement the spec's requirements for those capabilities. Clients that read the card attempt the feature, get silent failures or wrong error codes, and either crash or report the relay as broken. A real bug in kagent v0.6.5 caused `message/stream` to fail with "message with at least one part is required" despite correct client formatting — a spec compliance mismatch that broke downstream agents.

**Why it happens:**
Developers scaffold the Agent Card JSON early using spec examples, then fill in capabilities optimistically. Testing with browser SSE is forgiving — browser clients don't validate JSON-RPC response structure strictly. SDK-based A2A clients do.

**How to avoid:**
- Set `capabilities.streaming: false` in Agent Cards until streaming is fully implemented and tested against the A2A Go SDK's own examples.
- Validate every `message/stream` response body is a proper JSON-RPC 2.0 Response wrapping `SendStreamingMessageResponse` — not raw text, not bare JSON.
- `message/send` MUST block until terminal state by default (the spec default is `returnImmediately: false`). Returning immediately unless explicitly opted in is non-compliant.
- Each SSE event MUST be delivered in-order; test by injecting artificial delays and confirming sequence numbers.
- Terminal state (COMPLETED, FAILED, CANCELED) MUST close the stream — no further events after terminal.
- Subscribe to the A2A spec changelog; v0.3.0 added signed Agent Cards and gRPC. Relay Agent Cards must declare correct `protocolVersion`.

**Warning signs:**
- A2A SDK clients throw parse errors or "unsupported operation" on features your card claims to support.
- Stream events arrive out of order under load (signals missing buffer flush or concurrent writes to same SSE connection).
- Agents hang indefinitely on `message/send` (signals you returned early when you should have blocked).

**Phase to address:** A2A protocol implementation phase. Agent Card must be validated against the spec before connecting to any real agent.

---

### Pitfall 3: SSE Connection Leaking Through Intermediate Infrastructure

**What goes wrong:**
The SSE connection is alive at the Go server but dead at the agent client — killed silently by an intermediate proxy, load balancer, or the Hostinger VPS's idle connection timeout. The Go server keeps the goroutine alive for the dead connection indefinitely, holding room subscriber slots. Agents stop receiving messages with no error. This is especially common behind nginx or HAProxy with default `proxy_read_timeout` (60 seconds).

**Why it happens:**
SSE is a long-lived HTTP connection. Most infrastructure defaults assume short HTTP requests. Nginx default `proxy_read_timeout` is 60 seconds — a room with no messages for 61 seconds causes nginx to close the upstream connection silently while Go sees nothing.

**How to avoid:**
- Send SSE keepalive comment events (`: keepalive\n\n`) every 15-25 seconds. The colon prefix makes them valid SSE but invisible to clients.
- Configure nginx: `proxy_read_timeout 3600s; proxy_send_timeout 3600s; proxy_buffering off; chunked_transfer_encoding on;`
- Never enable response body logging for SSE endpoints — buffering is a side-effect.
- Detect write errors in the Go SSE loop as the primary signal that the client is gone; this is more reliable than disconnect callbacks.
- Test SSE through nginx locally (not just `go run`) before declaring the feature complete.

**Warning signs:**
- Agents report "connection closed" after exactly 60 seconds of room inactivity.
- SSE works in `curl` direct to Go port but not through the production domain.
- Goroutine count stays elevated even when agents are supposedly disconnected.

**Phase to address:** Infrastructure and deployment phase. SSE behavior must be tested end-to-end through nginx on the VPS before the feature is considered done.

---

### Pitfall 4: Bearer Token Appearing in URLs or Logs

**What goes wrong:**
Agent clients must provide a bearer token to join rooms. If the relay ever accepts tokens in query strings (for "convenience" or SSE compatibility), those tokens appear in nginx access logs, application logs, browser history, and any monitoring system. Bearer tokens are effectively passwords — once in a log, they're compromised. OAuth 2.1 explicitly forbids query-string token delivery.

**Why it happens:**
SSE connections are initiated by `EventSource` in browsers, which cannot set custom headers. Developers add `?token=...` as a workaround. The A2A Go SDK does support Authorization headers in SSE, but browser-based debugging tools prompt the URL-parameter shortcut.

**How to avoid:**
- NEVER accept tokens in query strings. Use `Authorization: Bearer <token>` headers exclusively.
- For browser-based agent debugging pages: use `fetch()` with `Authorization` header and pipe to a `ReadableStream` — this avoids `EventSource` limitation without URL token exposure.
- Scrub `Authorization` headers from all log configurations at nginx and application level.
- Log token presence (boolean), never token value.
- Rotate room tokens on demand; provide a token rotation endpoint from day one.

**Warning signs:**
- Any log line containing the room token string.
- Any URL in nginx access logs containing `token=`.
- Monitoring dashboards showing full Authorization header values.

**Phase to address:** Authentication phase (first phase involving real tokens). Never accept URL tokens even in dev — the shortcut becomes permanent.

---

### Pitfall 5: Cross-Room Message Contamination via Shared State

**What goes wrong:**
All rooms share the same Go process and in-memory subscriber maps. A bug in room scoping — a missing room ID filter, a shared channel, a global broadcast map — causes messages sent to Room A to appear in Room B. In multi-agent systems this is catastrophic: agents process messages from the wrong context and take incorrect actions. Row-level security failures in multi-tenant SaaS systems are a well-documented class of bugs.

**Why it happens:**
In-memory pub/sub implementations start with a single global channel or map for simplicity. Room scoping is added as a key lookup but the key type is wrong (string vs UUID), or a broadcast helper function is called without the room filter. Tests use the same room ID in every test case, so cross-room contamination is never exercised.

**How to avoid:**
- Use Go's type system: define `type RoomID uuid.UUID` — this prevents accidentally passing a raw string as a room ID.
- The subscriber map is `map[RoomID]map[SubscriberID]chan Message` — two-level scoping, not flat.
- Integration tests MUST create two rooms and verify that a message in one room never appears in the other.
- Every message delivery function takes `RoomID` as first argument and panics if zero value.
- Room cleanup on last agent leaving must also clean up the room's subscriber map entry — otherwise stale map entries can collide with future room IDs if UUIDs are reused (they won't be, but the pattern is correct).

**Warning signs:**
- Test suites that only ever use a single room.
- Broadcast helpers that iterate over all rooms rather than a specific room.
- Any log output from one room's context appearing in another room's trace.

**Phase to address:** Go relay server foundation phase. Isolation must be a core architectural constraint, not a filtering layer added later.

---

### Pitfall 6: Agent Card Serving From Relay vs. Agent Confusion

**What goes wrong:**
The A2A spec requires agents to serve their own Agent Card at `/.well-known/agent.json` on their own domain. Quorum is a relay — it's not the agent. Developers conflate the relay's own identity (Quorum's A2A endpoint) with the identities of agents inside rooms. If the relay serves all agent cards under its own domain, clients can't distinguish which card belongs to which agent, and `/.well-known/agent.json` is overloaded to mean something it doesn't in the spec.

**Why it happens:**
The relay wants to offer discovery ("here are all agents in this room") which sounds like serving their cards. But in A2A, agent cards describe the agent's own server — not a relay that forwards on the agent's behalf. The concepts collide.

**How to avoid:**
- Quorum's own `/.well-known/agent.json` describes Quorum itself as an A2A server (the relay endpoint).
- Room-level discovery is Quorum-specific API — not A2A standard discovery — exposed as `GET /rooms/{id}/agents`, returning the published card data each agent submitted on join.
- Agents publish their card to Quorum on join; Quorum stores it and serves it via the room discovery API.
- Never proxy `/.well-known/agent.json` requests to individual agents — that creates unbounded outbound requests from the relay.
- Document clearly in developer docs: "Quorum stores the card you provide; it does not fetch your card for you."

**Warning signs:**
- A single `/.well-known/agent.json` endpoint attempting to return different cards based on query params.
- Outbound HTTP requests from the relay to agent domains during discovery queries.
- Agent card URL stored in the database pointing back to the relay's own domain.

**Phase to address:** A2A protocol implementation phase, specifically when designing the join-and-publish-card flow.

---

### Pitfall 7: Public Rooms Becoming Abuse Vectors Without Rate Limiting

**What goes wrong:**
Quorum's zero-friction public rooms require no signup. Without rate limiting, anyone can create thousands of rooms, flood rooms with messages at machine speed, or use the relay as a free message broker. The Hostinger VPS has finite resources; a single abusive agent can degrade all rooms. Anonymous public endpoints without limits are the most commonly targeted APIs in 2025.

**Why it happens:**
Rate limiting is planned for "later" when the product exists. The MVP prioritizes getting agents talking. The abuse cases only appear after the service is public-facing.

**How to avoid:**
- Room creation: max N rooms per IP per hour from day one (suggested: 10/hour/IP for anonymous).
- Message send: max messages per second per room per agent token (suggested: 10 msg/s, burst 50).
- SSE connection: max concurrent SSE connections per room (suggested: 50 for v1, prevents hot-room fan-out explosion).
- Room TTL: public rooms with zero activity auto-expire after 24 hours — prevents room accumulation.
- Implement rate limiting in Go middleware before any route handler touches business logic.
- Token-based limits (per bearer token) are stricter than IP-based limits because tokens are room-scoped.

**Warning signs:**
- Room count in database growing faster than user signups.
- CPU/memory spikes that don't correlate with legitimate traffic patterns.
- A single room with hundreds of SSE subscribers.

**Phase to address:** Go relay server foundation phase — rate limiting middleware must be in place before the service is deployed publicly, not added post-launch.

---

### Pitfall 8: In-Memory Room State Is Incompatible With Horizontal Scaling

**What goes wrong:**
The Go relay uses in-memory maps for room subscriber state (which goroutine listens on which channel for which room). This works on a single server. The moment a second Go instance is added behind a load balancer, an agent connecting to instance A can't receive messages sent by an agent on instance B. The service appears to work in development (one instance) and breaks in production under load, or when the VPS is upgraded to multiple instances.

**Why it happens:**
Single-VPS deployments start with the simplest in-memory architecture. Scaling is deferred. When it becomes necessary, the in-memory state is baked deeply into the relay design.

**How to avoid:**
- For v1 (single VPS): in-memory is acceptable but document the constraint explicitly.
- Design the subscriber interface as an abstraction (`MessageBus` interface) from day one, with the in-memory implementation being one concrete type.
- When scaling becomes necessary, swap to Postgres `LISTEN/NOTIFY` (already on the stack, no new dependency) as the cross-instance message bus before reaching for Redis.
- Keep the Go process stateless except for in-memory subscriber channels — persist room and agent metadata to Postgres.
- Postgres `LISTEN/NOTIFY` handles fan-out across Go instances and survives process restarts.

**Warning signs:**
- Agents can join but miss messages intermittently under load.
- Two Go processes running simultaneously causing message delivery inconsistencies.
- Any discussion of "adding a second server" that doesn't include a plan for state synchronization.

**Phase to address:** Go relay server foundation. Design the `MessageBus` abstraction in the first phase; implement in-memory. The migration to Postgres LISTEN/NOTIFY is then a configuration swap, not a rewrite.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Accept tokens in URL query strings for SSE | Browser `EventSource` works without extra code | Tokens logged everywhere, compromised credentials | Never |
| Global subscriber map (not room-scoped) | Simpler code for first iteration | Cross-room message contamination, security incident | Never |
| No SSE keepalive pings | Less code | Silent disconnects behind proxies, zombie goroutines | Never |
| No rate limiting on public room creation | Faster to ship | VPS resource exhaustion, DoS from any user | Never — add with first public route |
| Single in-memory `MessageBus` implementation | Simple, fast | Breaks on horizontal scaling | Acceptable in v1 if abstracted behind interface |
| `fmt.Println` for request logging | Zero setup | Authorization headers in plaintext logs | Never in production |
| Blocking `message/send` with no timeout | Spec compliant | Agents can hold connections open indefinitely | Require a max timeout even for blocking calls |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| nginx + SSE | Default `proxy_read_timeout 60s` kills idle SSE streams | Set `proxy_read_timeout 3600s`, `proxy_buffering off` |
| Vercel frontend + Go SSE | Using Next.js API routes to proxy SSE (serverless, 10s timeout) | Frontend connects directly to Go API domain via `fetch()` with Authorization header |
| Postgres + Go pgx | Opening a new connection per SSE goroutine exhausts pool | Use `pgxpool`; SSE goroutines must not hold DB connections open |
| A2A Go SDK + relay | SDK validates JSON-RPC 2.0 response structure strictly; relay returns bare JSON | Wrap all responses in proper JSON-RPC envelope with `jsonrpc: "2.0"` |
| Agent Card publish on join | Storing card verbatim without validating required fields | Validate `name`, `url`, `version` at minimum before storing |
| Postgres LISTEN/NOTIFY | Notifications dropped if no listener goroutine is alive | Dedicated listener goroutine per Go process, restarted on error |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fan-out via goroutine-per-subscriber write | Works fine with 5 agents; blocks under 50+ | Use buffered channels; drop slow consumers (log, don't block) | ~20 concurrent SSE subscribers per room |
| Unbuffered channels in subscriber map | One slow consumer blocks all others in the room | Buffered channels (size 32-64); non-blocking send with timeout | First slow agent in any room |
| Postgres query per SSE message | DB roundtrips multiply with message rate | Cache room membership in memory; query DB only on join/leave | ~10 messages/second across all rooms |
| SSE message serialization on hot path | CPU spike under load; GC pressure from allocations | Pre-serialize Agent Card JSON at join time; reuse byte buffers | ~100 messages/second |
| Room state scan for discovery | O(N) agent scan per discovery query | Index agents by room_id; use Postgres query for initial discovery | ~100 agents total |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Token in URL query string | Token in nginx logs, browser history, referrer headers | Require Authorization header; reject URL tokens with 400 |
| Logging Authorization header | Token exposure to log aggregation systems | Scrub auth headers in logging middleware |
| Error messages distinguishing "room not found" from "not authorized" | Room enumeration by unauthenticated probes | Always return same error for missing or unauthorized rooms |
| Unsigned Agent Cards accepted as trusted identity | Spoofed agent identity in room | Treat Agent Cards as self-reported metadata only; never grant elevated permissions based on card claims |
| No message size limit | Single oversized message causes memory spike | Enforce max message payload (suggested: 64 KB for v1) |
| Stream not closed after token revocation | Revoked token continues receiving messages via live SSE | Token validation on each SSE keepalive cycle (every 30s) or on room state change |
| Cross-room token reuse | A token for Room A used to join Room B | Tokens are room-scoped; validate room ID matches token's bound room |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback when agent joins a room that is at capacity | Agent silently fails to connect | Return clear 429 with `Retry-After` and current room occupancy |
| Room URL that works for browser but not for agent SDK (CORS) | Developers waste hours debugging | CORS headers configured from day one; document exact agent connection snippet |
| Discovery returns all agents including disconnected ones | Agents try to message ghosts | Track `last_seen` per agent; filter stale agents (>5 min) from discovery results |
| Token generation UX that creates a single token per room | Room owner can't rotate tokens without kicking all agents | Generate per-agent tokens scoped to the room, not a single shared secret |
| No room expiry warning | Public room quietly disappears; agents lose connection | Send SSE event 5 minutes before room auto-expiry |

---

## "Looks Done But Isn't" Checklist

- [ ] **SSE streaming:** Verify through nginx (not just direct Go port) — proxy buffering breaks SSE silently.
- [ ] **Goroutine cleanup:** Run load test, disconnect all clients abruptly (kill -9 agent process), verify goroutine count returns to baseline with goleak.
- [ ] **A2A spec compliance:** Test `message/send` blocking behavior — send a request, verify Go process holds the connection until you manually complete the task.
- [ ] **Cross-room isolation:** Create Room A and Room B; send to A; verify B receives nothing.
- [ ] **Token security:** Send a valid token as a URL query param; verify the relay returns 400 and the token does not appear in any log.
- [ ] **Agent Card schema:** Publish a card with missing required fields; verify the relay rejects it with a clear error, not a 500.
- [ ] **Rate limiting:** Send 1000 room-create requests in one minute from one IP; verify the 11th request gets rate-limited.
- [ ] **SSE reconnect:** Drop the SSE connection mid-stream; verify the agent can reconnect and does not receive duplicate events.
- [ ] **Room auto-expiry:** Set TTL to 1 minute in test config; verify the room disappears and all agents receive a disconnect event.
- [ ] **Discovery accuracy:** Kill an agent without a clean disconnect; wait 5 minutes; verify it no longer appears in room discovery.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Goroutine leak discovered in production | HIGH | Rolling restart of Go process; add goroutine count alerting; deploy goleak-based canary test |
| Bearer token found in logs | HIGH | Invalidate all room tokens immediately; rotate; audit log access history; notify affected room owners |
| Cross-room contamination found | CRITICAL | Immediate rollback; audit message logs for leakage scope; patch room-scoping bug; regression test added |
| SSE drops behind nginx | LOW | nginx config patch; redeploy; no data loss |
| In-memory state lost on process restart | LOW (by design) | Agents reconnect; room metadata persists in Postgres; acceptable for v1 |
| Rate limit bypass leading to resource exhaustion | MEDIUM | Emergency IP block at nginx level; tune rate limits; add circuit breaker |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Goroutine leak | Go relay foundation | goleak integration test: connect N agents, kill all, assert goroutine baseline |
| A2A spec compliance theater | A2A protocol implementation | Test against A2A Go SDK reference client |
| SSE killed by nginx proxy | Infrastructure/deployment | End-to-end SSE test through production nginx |
| Bearer token in URL/logs | Auth implementation | Log audit: grep for token values in all log outputs |
| Cross-room contamination | Go relay foundation | Two-room isolation integration test |
| Agent Card/relay identity confusion | A2A protocol implementation | Confirm `/.well-known/agent.json` describes relay only |
| Public room abuse | Go relay foundation | Rate limit smoke test before first public deploy |
| In-memory scaling constraint | Go relay foundation | Document constraint; implement `MessageBus` interface |

---

## Sources

- [A Security Engineer's Guide to the A2A Protocol — Semgrep](https://semgrep.dev/blog/2025/a-security-engineers-guide-to-the-a2a-protocol/)
- [A2A Protocol Official Specification](https://a2a-protocol.org/latest/specification/)
- [A2A Streaming and Async Operations](https://a2a-protocol.org/latest/topics/streaming-and-async/)
- [Agent Discovery: The Missing Pieces to A2A — Solo.io](https://www.solo.io/blog/agent-discovery-naming-and-resolution---the-missing-pieces-to-a2a)
- [Finding and Fixing a 50,000 Goroutine Leak — Serge Skoredin](https://skoredin.pro/blog/golang/goroutine-leak-debugging)
- [Horizontal Scaling of a Stateful Server with Redis pub/sub — WalkMe Engineering](https://medium.com/walkme-engineering/horizontal-scaling-of-a-stateful-server-with-redis-pub-sub-fc56c875b1aa)
- [Agent Credential Replay: Bearer Tokens Are Digital Cash — Security Boulevard](https://securityboulevard.com/2025/10/agent-credential-replay-why-bearer-tokens-are-digital-cash-in-a-tornado/)
- [Multi-Tenant Leakage: When Row-Level Security Fails — Medium](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)
- [SSE Time Limits on Vercel — Community](https://community.vercel.com/t/sse-time-limits/5954)
- [Go Concurrency Mastery: Preventing Goroutine Leaks — DEV Community](https://dev.to/serifcolakel/go-concurrency-mastery-preventing-goroutine-leaks-with-context-timeout-cancellation-best-1lg0)
- [PostgreSQL Connection Pooling with pgxpool — pgx docs](https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool)
- [OAuth 2.0 for APIs: Flows, Tokens, and Pitfalls — Treblle](https://treblle.com/blog/oauth-2.0-for-apis)
- [SSE Server-Sent Events don't work in Next API routes — GitHub Discussion](https://github.com/vercel/next.js/discussions/48427)

---
*Pitfalls research for: A2A relay service with room-based agent communication (Quorum)*
*Researched: 2026-03-21*
