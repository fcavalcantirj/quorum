# Phase 3: Streaming and Deploy - Research

**Researched:** 2026-03-22
**Domain:** SSE streaming (a2a-go v0.3.12 built-in transport), goroutine lifecycle, Easypanel + Traefik v3 SSE proxy, multi-stage Dockerfile, goleak integration testing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Everything managed by code — Dockerfile handles the entire Go server build. No manual VPS configuration needed.
- **D-02:** Deploy via git push + Easypanel. Easypanel is already installed and running on the Hostinger VPS. Create a new service pointing to the repo.
- **D-03:** TLS via Let's Encrypt with auto-renewal. Easypanel or certbot handles certificate provisioning and renewal.
- **D-04:** Nginx/Traefik proxy config managed by Easypanel — SSE-specific settings (proxy_read_timeout, proxy_buffering off) configured in the Easypanel service or Dockerfile entrypoint.
- **D-05:** SSE delivers real-time events: `agent_joined`, `agent_left`, `message` (relayed A2A messages), `heartbeat` comments. Event model defined in Phase 2, transport implemented here.
- **D-06:** Heartbeat comments every 15-25 seconds to keep connections alive through proxies (per A2A-03 requirement).

### Claude's Discretion

- SSE reconnection strategy (D-08)
- Connection limits per room and per server (D-07)
- Goroutine cleanup mechanics on disconnect
- Dockerfile multi-stage build details
- Easypanel service configuration specifics
- Nginx/Traefik SSE proxy tuning parameters

### Deferred Ideas (OUT OF SCOPE)

- Horizontal scaling with Redis pub/sub — v2, single VPS for v1
- Room capacity validation against VPS limits — monitor after deploy, tune limits
- Blue-green deployment — Easypanel handles rolling restarts
- CI/CD pipeline — git push to Easypanel is sufficient for v1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| A2A-02 | Relay handles `message/stream` (SSE streaming) between agents in a room | a2a-go v0.3.12 SDK handles SSE internally via `NewJSONRPCHandler` + `WithTransportKeepAlive`; `AgentExecutor.Execute` yields `iter.Seq2[a2a.Event, error]` — streaming is automatic when method is `message/stream` |
| A2A-03 | SSE connections send heartbeat comments every 15-25 seconds | `WithTransportKeepAlive(20 * time.Second)` on `NewJSONRPCHandler` — SDK calls `sseWriter.WriteKeepAlive` at the specified interval; confirmed by transport.go source |
| INFRA-03 | Go server deployed on Hostinger VPS with HTTPS (TLS termination) | Multi-stage Dockerfile + Easypanel Dockerfile builder + auto Let's Encrypt via Easypanel; Traefik 3.6.7 is Easypanel's proxy; SSE requires `X-Accel-Buffering: no` response header from Go server |
</phase_requirements>

---

## Summary

The a2a-go v0.3.12 SDK handles `message/stream` SSE transport natively inside `NewJSONRPCHandler`. There is no need for an external SSE library (`jetify-com/sse`) for the A2A streaming endpoint — the SDK's `jsonrpc.go` uses an internal `sse` package to write `text/event-stream` responses, flush frames, and send keep-alive comments. The relay's `RoomExecutor.Execute` method returns an `iter.Seq2[a2a.Event, error]` iterator; the SDK consumes that iterator and writes each event as an SSE frame. Keep-alive is configured via `WithTransportKeepAlive(interval)` on `NewJSONRPCHandler`.

**CRITICAL AgentExecutor interface change**: Phase 2 research documented the old queue-based interface (`Execute(ctx, reqCtx *RequestContext, queue eventqueue.Queue) error`). Live research confirms the current v0.3.12 interface is `Execute(ctx context.Context, execCtx *ExecutorContext) iter.Seq2[a2a.Event, error]`. The iterator pattern eliminates the `eventqueue` dependency. Phase 2 plans must reconcile this before Phase 3 implementation starts.

Deployment on Easypanel is straightforward: Easypanel v2.25.0 uses Traefik 3.6.7 as its reverse proxy. Traefik does not buffer SSE streams by default (no buffering middleware is active unless explicitly added). The one required action from the Go server is setting `X-Accel-Buffering: no` as a response header on all SSE responses. Traefik respects this header and disables any response buffering for that connection. TLS is fully automated via Easypanel's Let's Encrypt integration — no certbot or manual certificate management.

Goroutine leak prevention follows the standard pattern: the SSE handler blocks on `<-r.Context().Done()`, which fires when the client disconnects (TCP close, browser navigate away). The hub unsubscribes the channel and `close()`s it, draining any goroutines waiting on that channel. `goleak.VerifyTestMain` in the test package confirms zero leaks after disconnect.

**Primary recommendation:** Use `NewJSONRPCHandler(requestHandler, WithTransportKeepAlive(20*time.Second))` for the A2A endpoint. Write `X-Accel-Buffering: no` in the SSE handler (or middleware). The `RoomHub.unsubscribe` command must `close()` the subscriber channel so downstream goroutines exit cleanly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.com/a2aproject/a2a-go | v0.3.12 | Built-in SSE streaming for `message/stream` | SDK owns SSE framing, Content-Type, flush, keep-alive — no external SSE lib needed for A2A endpoint |
| go.uber.org/goleak | v1.3.0 | Goroutine leak detection in tests | Uber-maintained, stable since Oct 2023, `VerifyTestMain` integrates cleanly with standard `go test` |
| net/http (stdlib) | Go 1.26 | HTTP server and `http.Flusher` | SDK uses `http.Flusher` internally; standard library, no dep |
| context (stdlib) | Go 1.26 | Disconnect detection via `r.Context().Done()` | Request context cancels on client disconnect — the primary cleanup trigger |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| github.com/jetify-com/sse | latest | SSE primitives for custom (non-A2A) SSE endpoints | Use ONLY if Phase 4+ needs a non-A2A SSE endpoint (e.g., live room activity feed for the frontend). NOT needed for `message/stream` — the SDK handles that. |
| time (stdlib) | Go 1.26 | Heartbeat ticker in custom SSE handlers | For any SSE endpoint outside the SDK's scope (frontend live feed). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| go.uber.org/goleak | Goroutine leak tests | `go get go.uber.org/goleak@v1.3.0` — add as test dependency only |
| Docker Compose | Local Postgres during development | Already in Phase 1 — reuse same compose file |
| Easypanel | Production deployment | Git push → Easypanel auto-builds Dockerfile → deploys container |

### Installation

```bash
# Only new test dependency in Phase 3
go get go.uber.org/goleak@v1.3.0
```

**No other new dependencies.** `a2a-go`, `chi`, `pgx`, `sqlc` were all added in Phase 1/2.

---

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
relay/
├── internal/
│   ├── hub/
│   │   ├── hub.go          # Phase 2: RoomHub (gains unsubscribe cleanup in Phase 3)
│   │   └── ...
│   ├── relay/
│   │   ├── handler.go      # Phase 2: mountRoomA2ARoutes — add WithTransportKeepAlive here
│   │   └── ...
│   └── stream/
│       └── handler.go      # NEW: custom SSE endpoint for future non-A2A consumers (optional Phase 3)
├── Dockerfile               # NEW: multi-stage build
└── ...
```

### Pattern 1: SDK-Native SSE for message/stream

The a2a-go SDK handles `message/stream` automatically when `NewJSONRPCHandler` is configured with `WithTransportKeepAlive`. No code changes are needed in the handler for streaming — the `RoomExecutor.Execute` already returns an iterator. The SDK routes `message/stream` JSON-RPC calls to `OnSendMessageStream`, which drives the iterator and writes SSE frames.

```go
// Source: a2a-go a2asrv/transport.go + a2asrv/jsonrpc.go
// Already in relay/internal/relay/handler.go from Phase 2 — add WithTransportKeepAlive
jsonrpcHandler := a2asrv.NewJSONRPCHandler(
    requestHandler,
    a2asrv.WithTransportKeepAlive(20 * time.Second), // satisfies A2A-03 (15-25s range)
)
```

**What WithTransportKeepAlive does**: Creates a `time.Ticker` inside the SSE streaming loop. On each tick it calls `sseWriter.WriteKeepAlive(ctx)`, which writes an SSE comment (`": keep-alive\n\n"`) and flushes the response writer. This is exactly what A2A-03 requires.

### Pattern 2: AgentExecutor with iter.Seq2 (CURRENT v0.3.12 interface)

**CRITICAL**: The Phase 2 research used the old queue-based interface. The live a2asrv/agentexec.go confirms the current interface uses Go's iterator protocol:

```go
// Source: github.com/a2aproject/a2a-go a2asrv/agentexec.go (v0.3.12)
type AgentExecutor interface {
    Execute(ctx context.Context, execCtx *ExecutorContext) iter.Seq2[a2a.Event, error]
    Cancel(ctx context.Context, execCtx *ExecutorContext) iter.Seq2[a2a.Event, error]
}

// RoomExecutor — correct implementation for v0.3.12
func (e *RoomExecutor) Execute(
    ctx context.Context,
    execCtx *a2asrv.ExecutorContext,
) iter.Seq2[a2a.Event, error] {
    return func(yield func(a2a.Event, error) bool) {
        // 1. Route message to hub broadcast
        e.hub.broadcast <- broadcastCmd{
            event: buildRoomEvent(execCtx),
            from:  execCtx.Message.Metadata["agent_name"].(string),
        }

        // 2. Yield completed status event — SDK sends as SSE frame for stream,
        //    or as JSON-RPC response for send
        event := a2a.NewStatusUpdateEvent(
            execCtx.TaskID, execCtx.ContextID,
            a2a.TaskStateCompleted, nil, true, // final=true
        )
        yield(event, nil)
    }
}
```

**Streaming vs. synchronous**: The SDK routes `message/send` and `message/stream` through the same `Execute` method. For `message/send`, the SDK collects the first terminal event and returns it as a synchronous JSON-RPC response. For `message/stream`, the SDK streams each yielded event as an SSE frame.

### Pattern 3: Hub Subscribe/Unsubscribe with Disconnect Cleanup

The SSE connection lifecycle requires three components to coordinate: the HTTP handler, the room hub, and the goroutine that forwards hub events to the HTTP response.

```go
// Source: Go stdlib context + net/http patterns
func (h *SSEHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // Set SSE headers — MUST include X-Accel-Buffering for Traefik passthrough
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("X-Accel-Buffering", "no")  // Critical for Easypanel/Traefik
    w.Header().Set("Connection", "keep-alive")

    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "streaming not supported", http.StatusInternalServerError)
        return
    }

    ctx := r.Context()
    eventCh := make(chan a2a.Event, 32) // buffered — prevents hub blocking on slow consumer

    // Subscribe to room hub
    hub.subscribe <- subscribeCmd{agentName: agentName, ch: eventCh}
    defer func() {
        // Unsubscribe triggers hub to close(eventCh), draining the goroutine below
        hub.unsubscribe <- unsubscribeCmd{agentName: agentName}
    }()

    // Forward hub events to SSE stream
    go func() {
        for event := range eventCh { // exits when hub closes eventCh
            data, err := json.Marshal(event)
            if err != nil {
                continue
            }
            fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type(), data)
            flusher.Flush()
        }
    }()

    <-ctx.Done() // Block until client disconnects (TCP close, navigate away, etc.)
    // defer unsubscribes → hub closes eventCh → goroutine exits
    // No goroutine leak: all exits are deterministic
}
```

**Note:** For the A2A `message/stream` endpoint, this pattern is handled internally by the SDK — the relay does not write its own SSE frames. This custom pattern is only needed for non-A2A SSE endpoints (e.g., a frontend room activity feed).

### Pattern 4: Goroutine Cleanup Verification with goleak

```go
// Source: go.uber.org/goleak README + pkg.go.dev/go.uber.org/goleak
// relay/internal/hub/hub_test.go (or relay/internal/relay/streaming_test.go)

func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m) // runs after ALL tests in package; catches net/http background goroutines
}

func TestSSEDisconnectNoLeak(t *testing.T) {
    // Use goleak.VerifyNone(t) for individual test isolation
    // Use TestMain approach for package-level — preferred with parallel tests

    hub := NewRoomHub(...)
    server := httptest.NewServer(sseHandler(hub))
    defer server.Close()

    // Connect SSE client
    resp, _ := http.Get(server.URL + "/stream")

    // Simulate disconnect by closing response body
    resp.Body.Close()

    // Allow cleanup goroutines to exit
    time.Sleep(100 * time.Millisecond)

    // goleak.VerifyTestMain catches any remaining goroutines after all tests
}
```

**IgnoreTopFunction**: If the test environment has persistent background goroutines (e.g., from `pgxpool`), use `goleak.IgnoreTopFunction("github.com/jackc/pgx/v5/...")` to exclude them from leak detection.

### Pattern 5: Multi-Stage Dockerfile

```dockerfile
# Source: Docker multi-stage builds official docs + Go best practices 2026
# relay/Dockerfile

## Stage 1: Build
FROM golang:1.26-alpine AS builder

# CGO disabled: static binary, no C runtime dependency
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64

WORKDIR /build

# Layer cache: deps before source
COPY go.mod go.sum ./
RUN go mod download

# Build binary
COPY . .
RUN go build \
    -trimpath \
    -ldflags="-s -w" \
    -o relay \
    ./cmd/relay

## Stage 2: Runtime
FROM alpine:3.21

# ca-certificates: required for HTTPS outbound (Postgres TLS, OAuth)
RUN apk --no-cache add ca-certificates tzdata

# Non-root user: security best practice
RUN addgroup -S relay && adduser -S relay -G relay

WORKDIR /app

# Copy only the binary
COPY --from=builder /build/relay .

# Migrations are embedded in the binary via go:embed (Phase 1/2 pattern)
# No external migration files needed at runtime

USER relay

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/healthz || exit 1

ENTRYPOINT ["./relay"]
```

**Migration embedding (already established in Phase 2)**:
```go
// relay/internal/db/migrations/embed.go
//go:embed *.sql
var MigrationFiles embed.FS
```

### Pattern 6: SSE Reconnection Strategy (Claude's Discretion — Recommendation)

**Decision: Reconnect fresh (no replay buffer)**

Rationale:
- A2A relay messages are transient — an agent that was disconnected during a conversation joins the ongoing state, not the history (IRC model, no persistent history per REQUIREMENTS.md Out of Scope)
- Replay buffer adds complexity (ring buffer, event IDs, concurrent access to buffer)
- The A2A spec's `ResubscribeToTask` handles task-specific reconnection via `a2asrv.RequestHandler.OnResubscribeToTask` — but for room-level pub/sub, fresh connect is appropriate
- On reconnect, agents call the room info endpoint (`GET /r/{slug}/info`) to recover current room state (agents present, room metadata)

**Implementation**: Do not generate SSE `id:` fields. Do not check `Last-Event-ID` header. Client reconnects fresh and re-subscribes.

### Pattern 7: Connection Limits (Claude's Discretion — Recommendation)

**Recommended limits for Hostinger VPS (2-4GB RAM baseline):**

Each SSE connection holds:
- 1 goroutine (handler, ~4-8KB stack initial)
- 1 goroutine (event forwarder, ~4-8KB stack initial)
- 1 buffered channel (32 events × ~200 bytes = ~6KB)
- HTTP response buffer (~32KB)

Approximate per-connection overhead: ~50KB total. On a 2GB VPS with 1GB available to the Go process: ~20,000 connections theoretical max. However, file descriptors (default OS limit: 1024, tunable to 65535) and Postgres pool size are the practical bottlenecks.

**Recommended limits**:
- Per room: 100 SSE subscribers (configurable via `MAX_SSE_PER_ROOM` env var)
- Server-wide: 1000 SSE connections (configurable via `MAX_SSE_TOTAL` env var)

**Implementation**: Atomic counter per room in the hub, atomic server-wide counter. Return `HTTP 503 Service Unavailable` when limit is hit (with `Retry-After: 30` header).

```go
// relay/internal/hub/hub.go — add to RoomHub
type RoomHub struct {
    // ... existing fields ...
    sseCount    atomic.Int32  // current SSE subscriber count for this room
}

// On subscribe cmd: check limit before adding
if h.sseCount.Load() >= int32(config.MaxSSEPerRoom) {
    cmd.resp <- ErrRoomAtCapacity
    return
}
h.sseCount.Add(1)
// On unsubscribe: h.sseCount.Add(-1)
```

### Anti-Patterns to Avoid

- **Polling `time.Sleep` for disconnect detection:** Never. Use `<-r.Context().Done()`. Sleep loops burn goroutines.
- **Using `jetify-com/sse` for `message/stream`:** The SDK already handles this. Using both creates double SSE framing.
- **Not setting `X-Accel-Buffering: no`:** SSE will appear to work locally but silently buffer behind Traefik in production. The failure mode is invisible: events arrive 30 seconds late and all at once.
- **Unbuffered subscriber channels in the hub:** If the hub's broadcast goroutine sends to an unbuffered channel and the SSE writer is slow, the hub goroutine blocks, blocking all other room subscribers. Use a buffered channel (32+) with a non-blocking send (drop policy for slow consumers).
- **Closing the subscriber channel in the HTTP handler:** The hub goroutine must be the only closer of subscriber channels. HTTP handler sends an unsubscribe command; hub closes the channel. Closing from multiple goroutines causes panic.
- **Running goose migrations in a separate init container:** The binary already embeds migrations and runs them at startup via `goose.Up`. Don't add init container complexity.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE framing for `message/stream` | Custom `fmt.Fprintf(w, "data: ...")` on the A2A endpoint | `a2asrv.NewJSONRPCHandler` + `WithTransportKeepAlive` | SDK handles Content-Type, flush, keep-alive, event ordering, panic recovery, and iter.Seq2 consumption |
| Keep-alive timer in A2A SSE | Manual `time.Ticker` writing comments | `WithTransportKeepAlive(20 * time.Second)` option | SDK ticker is already inside the streaming loop; adding another creates duplicate keep-alives |
| TLS certificate management | certbot + cron | Easypanel Let's Encrypt integration | Easypanel provisions and auto-renews certificates for any domain added to the service |
| Goroutine leak detection | Manual goroutine count assertions | `go.uber.org/goleak` | goleak compares goroutine stacks before/after; catches subtle leaks that count-based tests miss |
| Binary-embedded migrations | Copying SQL files at runtime | `//go:embed *.sql` + `goose.SetBaseFS` | Embed is the established pattern from Phase 1/2 — migrations travel with the binary |

**Key insight:** The SDK is doing the heavy lifting for SSE. The relay's job is (1) implement the iterator-based `AgentExecutor.Execute`, (2) configure `WithTransportKeepAlive`, and (3) set `X-Accel-Buffering: no`. Everything else is already solved.

---

## Common Pitfalls

### Pitfall 1: X-Accel-Buffering Missing in Production

**What goes wrong:** SSE streams appear to work in local development (no Traefik layer). In production behind Easypanel's Traefik, events accumulate in the proxy buffer for ~30 seconds, then arrive all at once. The client connection never drops, but real-time streaming is broken.

**Why it happens:** Traefik buffers chunked responses unless instructed not to. The `X-Accel-Buffering: no` response header is the per-response signal that disables Traefik's buffering for that connection.

**How to avoid:** Set `w.Header().Set("X-Accel-Buffering", "no")` before `w.WriteHeader()` in any SSE handler. For the A2A endpoint, this needs to be set inside the SDK's SSE writer — check whether `rest.go`'s `handleStreamingRequest` sets this header. If not, add it via a chi middleware that wraps the A2A handler path and sets the header before the SDK writes its own headers.

**Warning signs:** SSE works locally, timeouts or delayed batch delivery in production.

### Pitfall 2: AgentExecutor Interface Mismatch (Phase 2 vs. v0.3.12)

**What goes wrong:** Phase 2 research documented `Execute(ctx, reqCtx *RequestContext, queue eventqueue.Queue) error`. If Phase 2 implementation used this signature, it will not compile against v0.3.12 which uses `Execute(ctx context.Context, execCtx *ExecutorContext) iter.Seq2[a2a.Event, error]`.

**Why it happens:** The SDK was refactored between the time the Phase 2 research was written and the live code was inspected.

**How to avoid:** Verify the actual interface in `go.sum`/`vendor/` or `pkg.go.dev` before starting Phase 3 implementation. The `RoomExecutor` must match `iter.Seq2` signature.

**Warning signs:** Compilation error "RoomExecutor does not implement AgentExecutor" during Phase 3.

### Pitfall 3: Hub Goroutine Blocking on Slow SSE Consumer

**What goes wrong:** Hub's broadcast loop sends to a subscriber's channel. If the SSE writer is behind a slow network (or the proxy buffers output), the channel fills up. The hub goroutine blocks on that send, stalling delivery to all other subscribers in the room.

**Why it happens:** Using an unbuffered channel or a too-small buffer.

**How to avoid:** Buffer subscriber channels (32 events minimum). Use non-blocking sends with drop policy:
```go
select {
case ch <- event:
default:
    // slow consumer — drop event, increment metric
}
```

**Warning signs:** One slow client causes all other clients in the room to stop receiving events.

### Pitfall 4: Goroutine Leak on Abnormal Client Disconnect

**What goes wrong:** TCP connection closes without a clean HTTP close. The `http.Flusher.Flush()` call returns without error because the Go HTTP stack has not yet detected the dead socket. The handler goroutine stays alive waiting on `<-ctx.Done()`. Eventually the OS recycles the socket and the context cancels — but this can take minutes.

**Why it happens:** TCP keep-alive probes have a default interval of minutes. The Go HTTP server's default read/write deadlines do not apply to long-lived SSE connections.

**How to avoid:** Set `server.IdleTimeout` and rely on the SSE keep-alive writes to detect write failures. A failed `Flusher.Flush()` should be caught (though `http.Flusher` does not return an error — use `fmt.Fprintf` return value instead). Additionally, the 20-second keep-alive ensures the OS detects dead connections within 40 seconds at most (one missed keep-alive).

**Warning signs:** goleak reports goroutines stuck on `runtime.gopark` with SSE-related frames after test cleanup.

### Pitfall 5: Easypanel Deploy Fails on PORT Binding

**What goes wrong:** Go server binds to `:8080` but Easypanel service is configured with proxy port 3000 (or any other default). Traefik routes traffic to the wrong port and returns 502.

**Why it happens:** Easypanel requires explicitly setting the "proxy port" in the service configuration to match what the container listens on.

**How to avoid:** Ensure the Go server reads `PORT` from env (`os.Getenv("PORT")`) and falls back to `8080`. Set `PORT=8080` in Easypanel service environment. Set proxy port to `8080` in Easypanel domain configuration.

**Warning signs:** 502 Bad Gateway immediately after deploy; container logs show server started successfully.

### Pitfall 6: goleak False Positives from Background Goroutines

**What goes wrong:** `goleak.VerifyTestMain` reports goroutine leaks that are actually background goroutines started by `pgxpool`, the Go HTTP server, or the test framework itself.

**Why it happens:** goleak captures the goroutine snapshot after all tests finish. Persistent goroutines from connection pools, background timers, etc. appear as leaks.

**How to avoid:** Use `goleak.IgnoreTopFunction` or `goleak.IgnoreCurrent()` to exclude known-good goroutines. For integration tests that use `pgxpool`, ignore the pool's background goroutines:
```go
func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m,
        goleak.IgnoreTopFunction("github.com/jackc/pgx/v5/pgxpool.(*Pool).backgroundHealthCheck"),
        goleak.IgnoreTopFunction("database/sql.(*DB).connectionOpener"),
    )
}
```

**Warning signs:** All hub tests pass individually but `TestMain` reports leaks in functions you didn't write.

---

## Code Examples

Verified patterns from official sources:

### SSE Headers (Go server side)

```go
// Source: clawhosters.com Docker+Traefik+SSE article (Feb 2026) + Traefik community docs
// These FOUR headers are required for SSE through Traefik (Easypanel's proxy)
w.Header().Set("Content-Type", "text/event-stream")
w.Header().Set("Cache-Control", "no-cache")
w.Header().Set("Connection", "keep-alive")
w.Header().Set("X-Accel-Buffering", "no") // disables Traefik response buffering
```

### WithTransportKeepAlive Configuration

```go
// Source: a2a-go a2asrv/transport.go — WithTransportKeepAlive confirmed
// Satisfies A2A-03: heartbeat every 15-25 seconds
jsonrpcHandler := a2asrv.NewJSONRPCHandler(
    requestHandler,
    a2asrv.WithTransportKeepAlive(20 * time.Second),
)
```

### goleak TestMain Integration

```go
// Source: go.uber.org/goleak README — VerifyTestMain pattern
func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m,
        // Ignore persistent pool goroutines from pgxpool
        goleak.IgnoreTopFunction("github.com/jackc/pgx/v5/pgxpool.(*Pool).backgroundHealthCheck"),
    )
}
```

### Goose Embedded Migration Pattern

```go
// Source: pressly.github.io/goose — embed SQL migrations blog post
package migrations

import "embed"

//go:embed *.sql
var MigrationFiles embed.FS

// In main/startup:
goose.SetBaseFS(migrations.MigrationFiles)
if err := goose.Up(db, "."); err != nil {
    log.Fatal("migration failed", "err", err)
}
```

### Dockerfile Health Check Endpoint

```go
// relay/cmd/relay/healthz.go — minimal health endpoint
// Checked by Docker HEALTHCHECK every 30s
http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
    // Optionally: ping the DB pool here
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("ok"))
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AgentExecutor` with `eventqueue.Queue` parameter | `AgentExecutor` returns `iter.Seq2[a2a.Event, error]` | a2a-go SDK refactor (exact version unclear, present in v0.3.12) | RoomExecutor must return iterator, not push to queue — Phase 2 patterns need update |
| Manual nginx on VPS (systemd + certbot + nginx.conf) | Easypanel Traefik 3.6.7 with auto Let's Encrypt | Easypanel deployment model | No manual VPS config; all routing/TLS managed by Easypanel |
| External SSE library (r3labs/sse, jetify-com/sse) for A2A | SDK-internal SSE via `a2asrv/jsonrpc.go` internal `sse` package | a2a-go SDK design | Don't add external SSE lib for A2A endpoint |

**Deprecated/outdated references from prior research:**
- Phase 2 RESEARCH.md `RoomExecutor.Execute(ctx, reqCtx, queue)` signature: outdated — use `iter.Seq2` interface.
- Phase 2 RESEARCH.md `NewJSONRPCHandler(requestHandler)` without options: still valid but add `WithTransportKeepAlive` for A2A-03.

---

## Open Questions

1. **Does the SDK's `jsonrpc.go` set `X-Accel-Buffering: no` automatically?**
   - What we know: The SDK uses an internal `sse` package that calls `sseWriter.WriteHeaders()`. The `X-Accel-Buffering` header is a de facto standard but not part of the SSE spec.
   - What's unclear: Whether the SDK's internal `sse` package includes this header.
   - Recommendation: Assume it does NOT. Add a chi middleware on the A2A path that sets `X-Accel-Buffering: no` unconditionally before the SDK handler runs. Headers set by middleware are not overwritten by the handler unless the handler explicitly sets the same header.

2. **Is the AgentExecutor interface in Phase 2 code already using `iter.Seq2` or the old queue pattern?**
   - What we know: Phase 2 research documented the queue-based interface. Phase 2 plans have not been executed yet (STATUS.md: "0/2 complete").
   - What's unclear: The current a2asrv source was built with `iter.Seq2` in v0.3.12 confirmed by live fetch of agentexec.go.
   - Recommendation: Phase 2 planning must use the `iter.Seq2` interface from the start. Phase 3 planning should note this as a prerequisite: "Phase 2 RoomExecutor compiles against v0.3.12 `iter.Seq2` signature."

3. **Does Easypanel expose Traefik label configuration per service via the UI?**
   - What we know: Easypanel has a custom Traefik config guide at `/etc/easypanel/traefik/config/custom.yaml` (requires SSH + Traefik restart). Services may also support per-service labels.
   - What's unclear: Whether Easypanel's UI exposes Docker labels for services, or if the custom.yaml file is the only path for SSE config.
   - Recommendation: Use the `X-Accel-Buffering: no` header approach from the Go server — this is self-contained in code and does not require Easypanel UI access or SSH for SSE configuration. Reserve Easypanel's custom Traefik config only if header approach fails.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Go testing stdlib + goleak v1.3.0 |
| Config file | None — standard `go test ./...` |
| Quick run command | `go test ./relay/internal/hub/... -v -timeout 10s` |
| Full suite command | `go test ./relay/... -race -timeout 60s` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| A2A-02 | `message/stream` delivers SSE events to subscribers in same room | integration | `go test ./relay/internal/relay/... -run TestSSEStreamDelivery -v` | Wave 0 |
| A2A-03 | Heartbeat comments every 15-25s on idle SSE connections | integration | `go test ./relay/internal/relay/... -run TestHeartbeatInterval -v` | Wave 0 |
| INFRA-03 (goroutines) | Zero goroutine leak after SSE client disconnects | integration | `go test ./relay/internal/hub/... -run TestSSEDisconnectNoLeak -v` | Wave 0 |
| INFRA-03 (deploy) | Server reachable at production HTTPS URL; Traefik proxies SSE | manual smoke | `curl -sN https://<domain>/r/<slug>/a2a -H "Authorization: Bearer <token>"` | Manual |

### Sampling Rate

- **Per task commit:** `go test ./relay/internal/hub/... -race -timeout 10s`
- **Per wave merge:** `go test ./relay/... -race -timeout 60s`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `relay/internal/relay/streaming_test.go` — covers A2A-02, A2A-03 (httptest.Server + SSE client simulation)
- [ ] `relay/internal/hub/hub_test.go` — goleak TestMain, covers INFRA-03 disconnect leak
- [ ] `relay/internal/hub/hub_test.go` TestMain with goleak — `go get go.uber.org/goleak@v1.3.0`

---

## Sources

### Primary (HIGH confidence)

- `github.com/a2aproject/a2a-go/a2asrv/transport.go` (live fetch Mar 2026) — `WithTransportKeepAlive(interval time.Duration) TransportOption`, `TransportConfig.KeepAliveInterval`, keep-alive ticker drives `sseWriter.WriteKeepAlive`
- `github.com/a2aproject/a2a-go/a2asrv/agentexec.go` (live fetch Mar 2026) — `AgentExecutor` interface uses `iter.Seq2[a2a.Event, error]`, not `eventqueue.Queue`. `ExecutorContext` replaces `RequestContext`.
- `github.com/a2aproject/a2a-go/a2asrv/jsonrpc.go` (live fetch Mar 2026) — `NewJSONRPCHandler(handler RequestHandler, options ...TransportOption) http.Handler`; SSE via internal `sse.NewWriter`; keep-alive ticker in streaming loop
- `pkg.go.dev/go.uber.org/goleak` — v1.3.0, `VerifyTestMain` and `VerifyNone` patterns, `IgnoreTopFunction` option
- Easypanel changelog (easypanel.io/changelog, Feb 2026) — Easypanel v2.25.0 uses Traefik 3.6.7; May 2025 v2.17.0 removed default compress middleware

### Secondary (MEDIUM confidence)

- clawhosters.com "Docker + Traefik + SSE" article (Feb 2026) — confirmed `X-Accel-Buffering: no` as required response header for Traefik SSE passthrough; four-header SSE setup
- pressly.github.io/goose "Embed SQL Migrations" — `//go:embed *.sql` + `goose.SetBaseFS` pattern (confirmed working approach, already used in Phase 1/2)
- Docker multi-stage builds official docs (docs.docker.com) — `golang:1.26-alpine` builder + `alpine:3.21` runtime pattern; `-trimpath -ldflags="-s -w"` build flags
- community.traefik.io SSE discussions — Traefik does not buffer SSE by default if no buffering middleware is active; `X-Accel-Buffering: no` is the per-response override

### Tertiary (LOW confidence)

- WebSearch synthesis on connection limits — ~50KB per SSE connection estimated; 100 connections/room, 1000 server-wide as starting limits for 2GB VPS. Needs validation against actual Hostinger VPS specs after deploy.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK source verified live; goleak version confirmed; no new external deps
- Architecture patterns: HIGH — SDK internals confirmed; Traefik SSE approach confirmed via community + article
- AgentExecutor interface: HIGH — live source fetch confirmed `iter.Seq2` interface in v0.3.12
- Pitfalls: HIGH (X-Accel-Buffering, interface mismatch, hub blocking) / MEDIUM (goroutine leak timing, goleak false positives)
- Connection limits: LOW — estimated from first principles; validate after production deploy

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (a2a-go is under active development; check for v0.4.x before implementation)
