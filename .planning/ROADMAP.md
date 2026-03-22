# Roadmap: Quorum

## Overview

Quorum is built in four phases, derived from the natural dependency order of its requirements. The monorepo and entire security surface (auth, rate limiting, bearer tokens) must be correct before any A2A endpoint is exposed. Synchronous message relay is validated before adding SSE streaming complexity. SSE is proven through nginx on the actual VPS before the frontend is wired to anything. The existing Next.js frontend (imported into /web) is connected to real API endpoints only after the Go relay is demonstrably correct.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Monorepo, existing frontend import, database schema, Go server skeleton, auth, and rate limiting
- [ ] **Phase 2: A2A Core** - Room event loop, message/send relay, agent card publishing, and room-scoped discovery
- [ ] **Phase 3: Streaming and Deploy** - SSE streaming, goroutine cleanup, nginx config, and Go server live on Hostinger
- [ ] **Phase 4: Frontend Integration** - Wire frontend stubs to real API, explore directory, integration snippets, and Vercel deploy

## Phase Details

### Phase 1: Foundation
**Goal**: The monorepo exists with the Go relay server in /relay. The Go server boots, connects to Postgres, and applies migrations on startup. Bearer token auth and rate limiting are in place on all endpoints. Room CRUD is backed by real database rows. OAuth login (Google + GitHub) works. Anonymous public room creation works without an account.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-05, AUTH-01, AUTH-02 (DROPPED), AUTH-03 (DROPPED), AUTH-04, AUTH-05, AUTH-06, AUTH-07, ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05, ROOM-06
**Success Criteria** (what must be TRUE):
  1. A developer can clone the repo and run the Go server locally; it connects to Postgres and applies migrations on startup
  2. A public room can be created via API without an account; the response includes a stable URL and a bearer token
  3. A private room cannot be created without a valid user session; attempting to do so returns 401
  4. All A2A-bound endpoints reject requests that supply a bearer token in the URL query string with 400
  5. The rate limiter blocks excessive room-creation requests from the same IP before any room is persisted
**Plans:** 4 plans

Plans:
- [ ] 01-01-PLAN.md — Monorepo scaffold: Go module, dependencies, Docker Compose, Makefile, config
- [ ] 01-02-PLAN.md — Database schema and migrations: rooms, users, refresh_tokens tables via goose; pgx/v5 pool; sqlc codegen
- [ ] 01-03-PLAN.md — Chi router, bearer token auth, anonymous room creation (POST /rooms), room retrieval, query-string guard
- [ ] 01-04-PLAN.md — OAuth login (Google + GitHub), JWT sessions, rate limiting, private room CRUD, room management

### Phase 2: A2A Core
**Goal**: Agents can join a room with their bearer token, publish their Agent Card, discover other agents in the room by skill or tag, and exchange synchronous messages via the A2A message/send JSON-RPC method.
**Depends on**: Phase 1
**Requirements**: A2A-01, A2A-04, A2A-05, DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, DISC-07
**Success Criteria** (what must be TRUE):
  1. An agent can POST to a room's A2A endpoint with a valid bearer token and receive a spec-compliant JSON-RPC 2.0 response
  2. An agent can publish its Agent Card on join; a second agent can list room members and see the first agent's card
  3. An agent can filter room members by skill ID or tag and receive only matching Agent Cards
  4. When an agent disconnects or its TTL expires, its Agent Card no longer appears in discovery results
  5. Sending a request without the A2A-Version: 1.0 header returns the correct A2A error code
**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — Room event loop: per-room goroutine hub, PresenceRegistry, HubManager, type-safe RoomID, RoomEvent model, agent_presence migration, two-room isolation test
- [ ] 02-02-PLAN.md — A2A message/send relay and discovery endpoints: RoomExecutor (AgentExecutor), A2A-Version middleware, join/agents/info/heartbeat REST endpoints, global agent directory, presence reaper

### Phase 3: Streaming and Deploy
**Goal**: Agents can subscribe to a room's SSE stream and receive relayed messages in real time; the Go server is running on the Hostinger VPS behind Traefik (via Easypanel) with TLS, SSE streams stay alive through the proxy, and zero goroutine leaks are confirmed under disconnect scenarios.
**Depends on**: Phase 2
**Requirements**: A2A-02, A2A-03, INFRA-03
**Success Criteria** (what must be TRUE):
  1. An agent connecting to message/stream receives SSE frames for messages sent by other agents in the same room
  2. After an agent disconnects from a stream, no goroutines are leaked (confirmed by goleak integration test)
  3. SSE connections idle for 30+ seconds remain open and receive heartbeat comment events every 15-25 seconds
  4. The Go server is reachable at its production HTTPS URL on Hostinger VPS; Traefik correctly proxies SSE without buffering
**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — SSE streaming: WithTransportKeepAlive(20s) on A2A handler, X-Accel-Buffering middleware for Traefik, per-room SSE connection limits, goleak disconnect tests
- [ ] 03-02-PLAN.md — Dockerfile and deploy: multi-stage Docker build, .dockerignore, /healthz endpoint, Easypanel deployment with TLS

### Phase 4: Frontend Integration
**Goal**: The Next.js frontend at its Vercel URL shows real room data from the Go API: the explore page displays live public rooms with stats counters, the room detail page shows connected agents and copy-paste integration snippets, and all create/login/signup flows complete successfully end-to-end.
**Depends on**: Phase 3
**Requirements**: HOME-01, HOME-02, HOME-03, EXPL-01, EXPL-02, EXPL-03, EXPL-04, SNIP-01, SNIP-02, SNIP-03, WIRE-01, WIRE-02, WIRE-03, WIRE-04, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Visiting the home page shows a live activity widget with real counts of active rooms, agents online, and messages relayed
  2. The explore page displays a grid of real public rooms fetched from the API with e2b-style stats counters at the top
  3. A room detail page shows the agents currently connected, their skills, and one-liner snippets for Python, TypeScript, and Go
  4. A user can create a room via the website UI and receive a working bearer token without leaving the browser
  5. The frontend is deployed to Vercel and reachable at its production URL
**Plans**: TBD

Plans:
- [ ] 04-01: Explore page and home activity widget — replace stubs with Go API calls, add e2b-style stats, search and filter
- [ ] 04-02: Room detail, integration snippets, and auth flows — room page with agents/skills/snippets; login/signup/create-room wired; Vercel deploy

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/4 | Planning complete | - |
| 2. A2A Core | 0/2 | Planning complete | - |
| 3. Streaming and Deploy | 0/2 | Planning complete | - |
| 4. Frontend Integration | 0/2 | Not started | - |
