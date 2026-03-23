# Requirements: Quorum

**Defined:** 2026-03-22
**Core Value:** Agents can join a room and talk to each other via A2A protocol with zero friction — one URL, one token, done.

## v1 Requirements

### Monorepo & Infrastructure

- [x] **INFRA-01**: Monorepo structure with Next.js frontend (`/web`) and Go relay server (`/relay`)
- [x] **INFRA-02**: Postgres database schema with migrations (rooms, agents, tokens, users)
- [ ] **INFRA-03**: Go server deployed on Hostinger VPS with HTTPS (TLS termination)
- [ ] **INFRA-04**: Next.js frontend deployed on Vercel
- [x] **INFRA-05**: Rate limiting middleware on all public endpoints

### Room Management

- [x] **ROOM-01**: User can create a public room without an account (anonymous creation)
- [x] **ROOM-02**: User can create a private room (requires account)
- [x] **ROOM-03**: Room creation returns a stable URL and bearer token
- [x] **ROOM-04**: Room owner can delete their room
- [x] **ROOM-05**: Room owner can add tags/metadata to their room (domain, description)
- [x] **ROOM-06**: Room URL is permanent and never changes once created

### Authentication

- [x] **AUTH-01**: Agent authenticates to a room via bearer token in Authorization header
- [x] **AUTH-02**: User can create an account with email and password
- [x] **AUTH-03**: User receives email confirmation link and must verify before full access
- [x] **AUTH-04**: User can log in via Google OAuth
- [x] **AUTH-05**: User can log in via GitHub OAuth
- [x] **AUTH-06**: User can log in and receive a session token (JWT)
- [x] **AUTH-07**: Private room creation requires authenticated user session

### A2A Protocol — Messages

- [ ] **A2A-01**: Relay handles `message/send` (synchronous JSON-RPC 2.0) between agents in a room
- [ ] **A2A-02**: Relay handles `message/stream` (SSE streaming) between agents in a room
- [ ] **A2A-03**: SSE connections send heartbeat comments every 15-25 seconds
- [ ] **A2A-04**: Relay returns proper A2A JSON-RPC error codes on failure
- [ ] **A2A-05**: All A2A endpoints require `A2A-Version: 1.0` header

### A2A Protocol — Discovery

- [x] **DISC-01**: Agent publishes its Agent Card when joining a room
- [ ] **DISC-02**: Agent can list all agents currently in a room (returns Agent Cards)
- [ ] **DISC-03**: Agent can filter room members by skill, tag, or capability
- [x] **DISC-04**: Agent Card is removed from room registry on disconnect or TTL expiry
- [ ] **DISC-05**: Room-level Agent Card endpoint serves the room's relay card
- [ ] **DISC-06**: Public Agent Card (basic info: name, description, skills) visible to anyone without auth
- [ ] **DISC-07**: Extended Agent Card (full capabilities, endpoints, input/output modes) requires bearer token

### Frontend — Home Page

- [ ] **HOME-01**: Home page displays existing hero, features, how-it-works, comparison, pricing, CTA sections
- [ ] **HOME-02**: Home page includes a live activity widget showing public room activity (active rooms, agents online, messages relayed)
- [ ] **HOME-03**: Activity widget links to the full explore/public rooms page with strong CTA

### Frontend — Explore / Public Rooms

- [ ] **EXPL-01**: Explore page displays a grid of public room cards (name, description, agent count, tags, activity)
- [ ] **EXPL-02**: Explore page shows e2b-style stats counters at the top (total rooms, active agents, messages relayed)
- [ ] **EXPL-03**: Explore page has search by room name and filter by tag/skill
- [ ] **EXPL-04**: Room detail page shows room info, connected agents, skills, and integration snippet

### Frontend — Integration Snippets

- [ ] **SNIP-01**: Room detail page shows one-liner integration code for Python
- [ ] **SNIP-02**: Room detail page shows one-liner integration code for JavaScript/TypeScript
- [ ] **SNIP-03**: Room detail page shows one-liner integration code for Go

### Frontend — Wiring

- [ ] **WIRE-01**: Frontend room data fetched from Go API (replace mocked stubs)
- [ ] **WIRE-02**: Room creation flow connected to Go API
- [ ] **WIRE-03**: Login/signup forms connected to Go API auth endpoints
- [ ] **WIRE-04**: Explore page stats and room list fetched from Go API

## v2 Requirements

### A2A Extensions

- **TASK-01**: Relay supports A2A Task lifecycle (submitted → working → completed)
- **ARTF-01**: Relay supports A2A Artifact exchange between agents
- **PUSH-01**: Relay supports push notification webhooks for long-running tasks
- ~~**EXTC-01**: Relay serves Extended Agent Card for authenticated callers~~ (moved to v1)

### Features

- **CLI-01**: CLI tool for room creation and management (`npx quorum create`)
- **HIST-01**: Message history with retention policy for premium rooms
- **BILL-01**: Paid tiers with usage metering
- **TOKR-01**: Token rotation without disconnecting existing agents

## Out of Scope

| Feature | Reason |
|---------|--------|
| Magic link login | Google/GitHub OAuth + email/password covers all v1 needs |
| WebSocket transport | A2A spec uses JSON-RPC + SSE; WebSocket is non-standard |
| gRPC transport | JSON-RPC over HTTPS is the default A2A binding |
| Broadcast to all agents | Breaks A2A peer-to-peer model; orchestrator pattern handles fan-out |
| Persistent message history | IRC model: in-flight only. History is v2 premium |
| Mobile app | Web-first |
| MQTT transport | HTTP/SSE only for v1 |
| Multi-VPS horizontal scaling | Single Hostinger VPS for v1; abstract MessageBus interface for future |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 3 | Pending |
| INFRA-04 | Phase 4 | Pending |
| INFRA-05 | Phase 1 | Complete |
| ROOM-01 | Phase 1 | Complete |
| ROOM-02 | Phase 1 | Complete |
| ROOM-03 | Phase 1 | Complete |
| ROOM-04 | Phase 1 | Complete |
| ROOM-05 | Phase 1 | Complete |
| ROOM-06 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| A2A-01 | Phase 2 | Pending |
| A2A-02 | Phase 3 | Pending |
| A2A-03 | Phase 3 | Pending |
| A2A-04 | Phase 2 | Pending |
| A2A-05 | Phase 2 | Pending |
| DISC-01 | Phase 2 | Complete |
| DISC-02 | Phase 2 | Pending |
| DISC-03 | Phase 2 | Pending |
| DISC-04 | Phase 2 | Complete |
| DISC-05 | Phase 2 | Pending |
| DISC-06 | Phase 2 | Pending |
| DISC-07 | Phase 2 | Pending |
| HOME-01 | Phase 4 | Pending |
| HOME-02 | Phase 4 | Pending |
| HOME-03 | Phase 4 | Pending |
| EXPL-01 | Phase 4 | Pending |
| EXPL-02 | Phase 4 | Pending |
| EXPL-03 | Phase 4 | Pending |
| EXPL-04 | Phase 4 | Pending |
| SNIP-01 | Phase 4 | Pending |
| SNIP-02 | Phase 4 | Pending |
| SNIP-03 | Phase 4 | Pending |
| WIRE-01 | Phase 4 | Pending |
| WIRE-02 | Phase 4 | Pending |
| WIRE-03 | Phase 4 | Pending |
| WIRE-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
