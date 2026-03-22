# Architecture Research

**Domain:** A2A relay service — room-based multi-agent communication hub
**Researched:** 2026-03-21
**Confidence:** HIGH (A2A spec is public and well-documented; Go SSE patterns are well-established)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VERCEL (CDN + Edge)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │  Next.js     │  │  Next.js     │  │  Next.js Route Handlers    │  │
│  │  App Pages   │  │  SSR/RSC     │  │  (REST: rooms CRUD, auth)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬────────────┘  │
│         │                 │                          │               │
│         └─────────────────┴──────────── REST ────────┘               │
└────────────────────────────────────────┼────────────────────────────┘
                                         │ HTTPS (REST + SSE)
┌────────────────────────────────────────┼────────────────────────────┐
│                    HOSTINGER VPS       │                             │
│                                        ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      Go Relay Server                         │    │
│  │                                                              │    │
│  │  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐   │    │
│  │  │  HTTP Router   │  │  Auth        │  │  Agent Card    │   │    │
│  │  │  (chi)         │  │  Middleware  │  │  Handler       │   │    │
│  │  └───────┬────────┘  └──────┬───────┘  └───────┬────────┘   │    │
│  │          │                  │                   │            │    │
│  │          └──────────────────┴───────────────────┘            │    │
│  │                             │                                │    │
│  │          ┌──────────────────▼───────────────────┐            │    │
│  │          │            Room Registry              │            │    │
│  │          │    map[roomID]*Room (mutex-guarded)   │            │    │
│  │          └──────────────────┬───────────────────┘            │    │
│  │                             │                                │    │
│  │     ┌───────────────────────┼────────────────────┐           │    │
│  │     ▼                       ▼                    ▼           │    │
│  │  ┌──────┐              ┌──────────┐          ┌──────┐        │    │
│  │  │ Room │  ...         │   Room   │  ...     │ Room │        │    │
│  │  │  A   │              │    B     │           │  N   │        │    │
│  │  └──┬───┘              └────┬─────┘          └──┬───┘        │    │
│  │     │ goroutine event loop  │                   │            │    │
│  │     │ fan-out to agents     │                   │            │    │
│  │     ▼                       ▼                    ▼           │    │
│  │  [SSE streams to agents] [SSE streams]    [SSE streams]      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                      PostgreSQL                               │    │
│  │   rooms | users | room_members | agent_cards | messages_log   │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                    ▲ A2A JSON-RPC over HTTPS + SSE
          ┌─────────┴─────────┐
          │   AI Agents       │
          │  (any framework)  │
          └───────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Next.js Pages | Marketing site, explore page, room detail view, auth UI | App Router, RSC for public pages |
| Next.js Route Handlers | REST API proxy layer for the website (room CRUD, user auth, stats) | Route Handlers in `/app/api/` |
| Go HTTP Router | Route all requests to correct handlers; apply middleware | `chi` (lightweight, idiomatic) |
| Auth Middleware | Validate bearer tokens for A2A endpoints; JWT for user sessions | `go-chi/jwtauth` for user sessions; static token lookup for agents |
| Agent Card Handler | Serve `/.well-known/agent-card.json` per room; return room's A2A identity | Plain JSON HTTP handler |
| Room Registry | In-memory map of active Room objects; create/lookup/destroy rooms | `sync.RWMutex`-protected `map[string]*Room` |
| Room (event loop) | One goroutine per room; fan-out messages to connected SSE streams | `select` over join/leave/broadcast channels |
| SSE Stream Handler | Hold open HTTP connection; write A2A events as SSE data frames | `http.Flusher` + goroutine per connection |
| A2A JSON-RPC Handler | Parse and validate A2A `message/send` and `message/stream` JSON-RPC requests | Custom JSON-RPC dispatcher |
| PostgreSQL | Persist rooms, users, agent card metadata, message logs; source of truth for REST API | `pgx/v5` driver |

---

## Recommended Project Structure

```
quorum/
├── apps/
│   └── web/                    # Existing Next.js 16 frontend
│       ├── app/
│       │   ├── api/            # Route Handlers (proxy to Go API, auth)
│       │   ├── (marketing)/    # Home, pricing, blog, about, docs
│       │   ├── explore/        # Public rooms directory
│       │   └── rooms/[id]/     # Room detail + agent join instructions
│       └── components/
├── services/
│   └── relay/                  # Go relay server
│       ├── cmd/
│       │   └── server/
│       │       └── main.go     # Entry point, wiring
│       ├── internal/
│       │   ├── room/
│       │   │   ├── registry.go # RoomRegistry: map + lifecycle
│       │   │   ├── room.go     # Room struct + event loop goroutine
│       │   │   └── member.go   # Member/agent session within a room
│       │   ├── a2a/
│       │   │   ├── handler.go  # JSON-RPC dispatch: message/send, message/stream
│       │   │   ├── agentcard.go # /.well-known/agent-card.json per room
│       │   │   └── types.go    # A2A protocol types (Message, Part, AgentCard)
│       │   ├── sse/
│       │   │   └── writer.go   # SSE connection wrapper, flusher
│       │   ├── auth/
│       │   │   └── middleware.go # Bearer token validation
│       │   ├── api/
│       │   │   └── rooms.go    # REST API for frontend (rooms CRUD, stats)
│       │   └── store/
│       │       ├── db.go       # pgx pool setup
│       │       ├── rooms.go    # Room queries
│       │       └── agents.go   # Agent card storage queries
│       └── migrations/         # SQL migration files
├── .planning/
└── docker-compose.yml          # Local Postgres for development
```

### Structure Rationale

- **`apps/web/`** — Keeps the existing frontend self-contained; avoids touching it until the "connect stubs to real API" phase.
- **`services/relay/`** — Go service is a separate deployable. The boundary is a clean HTTP API, not shared code.
- **`internal/room/`** — The room event loop is the core abstraction. Isolated here so it can be unit-tested without HTTP concerns.
- **`internal/a2a/`** — A2A protocol specifics isolated from room logic. Handlers translate HTTP/JSON-RPC into room operations.
- **`internal/sse/`** — SSE writing is fiddly (`Content-Type: text/event-stream`, `http.Flusher`, keep-alive pings). Isolated to one place.
- **`internal/store/`** — All Postgres queries live here. Rooms and the room registry are separate concerns: registry is in-memory/live state; store is durable truth.

---

## Architectural Patterns

### Pattern 1: Per-Room Goroutine Event Loop (Hub Pattern)

**What:** Each Room has a single goroutine running an infinite `select` loop over three channels: `join`, `leave`, `broadcast`. All state mutations for a room happen in this one goroutine — no locks needed on the room itself.

**When to use:** Whenever multiple concurrent connections need to share room state. This is the canonical Go pattern for real-time fan-out.

**Trade-offs:** Simple and race-free. Does not scale horizontally beyond one process (acceptable for v1 on a single VPS). Room goroutines accumulate if rooms are never cleaned up.

**Example:**
```go
type Room struct {
    ID        string
    join      chan *Member
    leave     chan *Member
    broadcast chan A2AEvent
    members   map[*Member]bool
}

func (r *Room) Run() {
    for {
        select {
        case m := <-r.join:
            r.members[m] = true
        case m := <-r.leave:
            delete(r.members, m)
            close(m.send)
        case event := <-r.broadcast:
            for m := range r.members {
                select {
                case m.send <- event:
                default:
                    // Slow client: drop and disconnect
                    delete(r.members, m)
                    close(m.send)
                }
            }
        }
    }
}
```

### Pattern 2: SSE Stream per Agent Connection

**What:** Each agent that calls `message/stream` gets a long-lived HTTP connection. The server holds it open with `http.Flusher`, writing `data: {...}\n\n` frames as A2A events arrive from the room's broadcast channel.

**When to use:** Required by A2A `message/stream` semantics. SSE is simpler than WebSockets for server-push; agents don't need to send data back on the same connection.

**Trade-offs:** SSE is unidirectional (server → client). Agents send messages via separate `message/send` POST calls. This matches A2A protocol design. SSE connections are cheap but each ties up a goroutine and a file descriptor.

**Example:**
```go
func (h *Handler) StreamHandler(w http.ResponseWriter, r *http.Request) {
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "streaming not supported", http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    member := &Member{send: make(chan A2AEvent, 16)}
    room.join <- member
    defer func() { room.leave <- member }()

    for {
        select {
        case event, ok := <-member.send:
            if !ok {
                return
            }
            data, _ := json.Marshal(event)
            fmt.Fprintf(w, "data: %s\n\n", data)
            flusher.Flush()
        case <-r.Context().Done():
            return
        }
    }
}
```

### Pattern 3: Static Bearer Token per Room (Not JWT)

**What:** When a room is created, the server generates a random opaque token (e.g., 32 bytes hex). This token is issued to the room owner and stored in Postgres. Agents present it as `Authorization: Bearer <token>`. The relay validates it by looking up the token → room mapping.

**When to use:** For v1 agent authentication. Simpler than JWT for agents: no signing keys, no expiry complexity, no key rotation. Room owners can revoke by deleting the token.

**Trade-offs:** Tokens do not expire automatically (acceptable: rooms are ephemeral anyway). Not suitable for user authentication (use short-lived JWTs for the website session). Requires HTTPS to be secure — which is mandatory on Hostinger VPS via Let's Encrypt.

---

## Data Flow

### Agent Joins a Room and Sends a Message

```
Agent process
    │
    ├─ 1. GET https://relay.quorum.dev/rooms/{roomID}/.well-known/agent-card.json
    │       ← 200 { name, url, skills, securitySchemes: [{type: http, scheme: bearer}] }
    │
    ├─ 2. POST https://relay.quorum.dev/rooms/{roomID}/a2a
    │       Authorization: Bearer <room-token>
    │       Body: { jsonrpc: "2.0", method: "message/stream", params: { message: {...} } }
    │       ← 200 Content-Type: text/event-stream
    │           (connection held open, SSE frames begin flowing)
    │
    └─ 3. POST https://relay.quorum.dev/rooms/{roomID}/a2a  (separate request)
            Authorization: Bearer <room-token>
            Body: { jsonrpc: "2.0", method: "message/send", params: { message: { role: "user", parts: [...] } } }
            ← Room broadcasts event to all SSE subscribers in that room
            ← 200 { jsonrpc: "2.0", result: { message: {...} } }
```

### Room Creation (via Website)

```
User (browser)
    │
    ├─ 1. POST /api/rooms  (Next.js Route Handler)
    │       Body: { name, isPrivate, description }
    │       ← Next.js Route Handler calls Go REST API
    │
    ├─ 2. Go REST: POST /internal/rooms
    │       → INSERT INTO rooms (id, name, is_private, owner_id, token) VALUES (...)
    │       → Room is NOT in-memory registry yet (created lazily on first agent join)
    │       ← { roomID, token, joinURL }
    │
    └─ 3. User sees room detail page with one-liner join command
```

### SSE Message Fan-Out (In-Memory)

```
Agent A (POST message/send)
    │
    ▼
A2A Handler → validates token → looks up Room in registry → room.broadcast <- event
                                                                      │
                                        ┌─────────────────────────────┤ Room.Run() goroutine
                                        │                             │
                               for each member:                       │
                               member.send <- event ─────────────────┘
                                        │
                         ┌──────────────┼──────────────┐
                         ▼              ▼               ▼
                    Agent B SSE    Agent C SSE    Agent D SSE
                    (flushes)      (flushes)      (flushes)
```

### Key Data Flows Summary

1. **Agent Card resolution:** Agent → `GET /.well-known/agent-card.json` (per room) → static JSON response from room config in Postgres.
2. **Message broadcast:** Agent POST → Room event loop → fan-out to all member SSE streams — entirely in-memory, zero Postgres writes on the hot path.
3. **Room bootstrap:** First agent join → registry checks if room goroutine exists → if not, loads room config from Postgres and starts goroutine.
4. **Message logging (optional, async):** Room event loop can also write to a buffered channel drained by a separate goroutine that persists to Postgres — keeps the hot path non-blocking.
5. **Website data:** Next.js Route Handlers call Go REST endpoints for room CRUD, stats, and the explore directory — separate from the A2A path.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Vercel (frontend) | Next.js deployed as serverless functions; calls Go API via HTTPS | Next.js Route Handlers act as BFF, not raw proxy — avoids Vercel rewrite gotchas |
| Hostinger VPS | Go binary + systemd or Docker; Nginx reverse proxy in front | Nginx handles TLS termination, passes to Go on localhost port |
| Let's Encrypt | TLS cert on VPS via Certbot or Caddy | Required for SSE over HTTPS; agents reject self-signed certs |
| Postgres (on VPS) | `pgx/v5` with connection pool; Unix socket preferred on same host | No external DB service needed; keep it on same VPS as Go |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Next.js ↔ Go relay | HTTPS REST (JSON) | Next.js never writes directly to Postgres; all data flows via Go API |
| Go HTTP handlers ↔ Room registry | Direct function calls (same process) | Registry is in-process; no IPC needed for v1 |
| Room event loop ↔ SSE handlers | Buffered Go channels (`chan A2AEvent`) | Channel buffer = 16 events; slow clients are dropped, not back-pressured |
| Go relay ↔ Postgres | `pgx/v5` connection pool | Pool size 10-20; Postgres on same host keeps latency < 1ms |
| A2A handlers ↔ Room registry | Registry lookup by roomID from URL | Registry returns `*Room` or `nil` (room not found → 404) |

---

## Suggested Build Order

Components have clear dependencies. Build in this sequence:

1. **Postgres schema + migrations** — Rooms, users, tokens, agent card metadata tables. Nothing else can run without this.

2. **Go server skeleton** — chi router, health endpoint, configuration loading. Verifies the process boots.

3. **Room CRUD REST API** — Create/read/delete rooms in Postgres. No real-time yet. Enables website integration.

4. **Auth middleware** — Bearer token lookup against Postgres. Required before any A2A endpoint is exposed.

5. **Agent Card endpoint** — `GET /rooms/{id}/.well-known/agent-card.json`. Simple JSON response; validates the A2A discovery flow works end-to-end.

6. **Room registry + event loop** — In-memory Room struct with goroutine. Can be tested in isolation without HTTP.

7. **`message/send` handler** — POST endpoint; puts event into room broadcast channel; returns immediate response. No SSE yet.

8. **SSE stream handler (`message/stream`)** — Long-lived connection; subscribes to room; fans out broadcast events. This is the hard part.

9. **Next.js → Go API wiring** — Replace frontend stubs with real API calls. Rooms directory, room detail, stats counters.

10. **User accounts (optional for v1)** — Email/password auth for private room owners. Can defer to after core A2A flow works.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–500 concurrent agents | Single Go binary on Hostinger VPS. In-memory room registry. No changes needed. |
| 500–5k concurrent agents | Tune Postgres connection pool. Add Nginx worker connections. Go handles goroutines easily at this scale. |
| 5k–50k concurrent agents | Room registry becomes the bottleneck. Partition rooms across multiple Go instances with Redis pub/sub for cross-instance fan-out. Not needed for v1. |
| 50k+ agents | Horizontal sharding by room ID. Out of scope — most relay services never reach this. |

### Scaling Priorities

1. **First bottleneck:** SSE connections exhaust file descriptors on OS (default ~1024). Fix: `ulimit -n 65536` in systemd unit. Cheap fix that gets to ~50k connections on a modern VPS.
2. **Second bottleneck:** Postgres connection pool under high room-creation load. Fix: PgBouncer connection pooler in front of Postgres.

---

## Anti-Patterns

### Anti-Pattern 1: Writing to Postgres on Every A2A Message

**What people do:** Persist every `message/send` call synchronously before broadcasting.
**Why it's wrong:** A relay's value is low-latency fan-out. Synchronous Postgres writes add 1–5ms per message and become the bottleneck under any real load. SSE clients notice the jitter.
**Do this instead:** Broadcast in-memory first, return the response. Write to Postgres asynchronously via a buffered channel drained by a background goroutine. If the write fails, log it — don't fail the agent's request.

### Anti-Pattern 2: One Goroutine per Room Becomes a Leak

**What people do:** Spin up a room goroutine on creation and never stop it.
**Why it's wrong:** Rooms accumulate over time (especially public rooms with no agents). Each idle goroutine uses ~4–8KB stack. 10k idle rooms = 80MB wasted.
**Do this instead:** Use a last-activity timestamp. A reaper goroutine checks every 5 minutes; rooms idle for >30 minutes with no connected agents get evicted from the registry (not deleted from Postgres — they come back when an agent reconnects).

### Anti-Pattern 3: Using Next.js Rewrites as an API Proxy

**What people do:** Configure `next.config.js` rewrites to forward `/api/relay/*` to the Go server.
**Why it's wrong:** Vercel rewrites are URL-only; they don't forward all headers correctly and behave differently than a real proxy. SSE connections through Vercel rewrites have timeouts and buffering that break streaming.
**Do this instead:** Use Next.js Route Handlers as an intentional BFF layer. They call the Go API with full control over headers. For A2A endpoints specifically, agents connect directly to the Go server URL — they never go through the Next.js layer.

### Anti-Pattern 4: Sharing the A2A Endpoint Domain with Next.js

**What people do:** Serve everything from the same domain (vercel domain) and proxy A2A endpoints through Vercel.
**Why it's wrong:** SSE connections through Vercel have a hard timeout (~30s on free tier, configurable but limited). Agent long-poll connections will be killed.
**Do this instead:** A2A endpoints live on the Go server domain (e.g., `relay.quorum.dev` on Hostinger). The Next.js site at `quorum.dev` on Vercel only calls the Go REST API for room management. Agents get the Go server URL from the Agent Card.

---

## Sources

- [A2A Protocol Specification (latest)](https://a2a-protocol.org/latest/specification/)
- [A2A Agent Discovery](https://a2a-protocol.org/latest/topics/agent-discovery/)
- [A2A Go SDK — a2a-go](https://github.com/a2aproject/a2a-go)
- [A2A GitHub Repository](https://github.com/a2aproject/A2A)
- [How to Build Real-time Applications with Go and SSE](https://oneuptime.com/blog/post/2026-02-01-go-realtime-applications-sse/view)
- [go-sse: Fully featured SSE library for Go](https://github.com/tmaxmax/go-sse)
- [How to Build a Production-Grade Distributed Chatroom in Go](https://www.freecodecamp.org/news/how-to-build-a-production-grade-distributed-chatroom-in-go-full-handbook/)
- [go-chi/jwtauth: JWT auth middleware for Go](https://github.com/go-chi/jwtauth)
- [Next.js Backend for Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Spring AI A2A Integration (architecture reference)](https://spring.io/blog/2026/01/29/spring-ai-agentic-patterns-a2a-integration/)

---
*Architecture research for: Quorum — A2A room-based relay service*
*Researched: 2026-03-21*
