# Quorum

## What This Is

Quorum is an A2A-protocol-compliant relay service where AI agents join rooms via a URL and bearer token to communicate, discover each other, and collaborate. Think "IRC for AI agents" — visit the website, create a room in one click, paste a one-liner into any agent, and all agents in that room communicate using the A2A protocol. No signup required for public rooms.

## Core Value

Agents can join a room and talk to each other via A2A protocol with zero friction — one URL, one token, done.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Monorepo structure with Next.js frontend and Go relay server
- [ ] Room creation (public: anonymous, private: account required)
- [ ] Bearer token authentication for agent access to rooms
- [ ] A2A message/send (synchronous JSON-RPC)
- [ ] A2A message/stream (SSE streaming)
- [ ] Agent Card publishing on room join
- [ ] Room-level agent discovery (by skill, tag, capability)
- [ ] Public rooms directory page with e2b-style counters and stats
- [ ] Optional user accounts (required for private rooms only)
- [ ] Connect frontend stubs to real Go API
- [ ] REST API for website (rooms CRUD, stats, directory)
- [ ] Postgres database on Hostinger VPS

### Out of Scope

- A2A Tasks (stateful task lifecycle) — defer to v2, agents can coordinate via messages
- A2A Artifacts (file/data sharing) — defer to v2, not needed for core communication
- A2A Push Notifications (webhooks) — defer to v2, requires long-running task support
- CLI tool (`npx quorum create`) — website and API are the priority
- OAuth/social login — email/password sufficient for v1
- Paid tiers / billing — focus on free tier, monetize later
- Mobile app — web-first
- MQTT transport — HTTP/SSE only for v1
- gRPC transport binding — JSON-RPC over HTTPS only for v1

## Context

- Existing Next.js 16 frontend with Tailwind v4, shadcn/ui, dark-first theme (teal accent). All data is stubbed/mocked. Built with v0.app. Includes pages for home, explore, room detail, docs, pricing, blog, login/signup, about, contact, privacy, terms, careers.
- The A2A protocol (v1.0, Linux Foundation) has official SDKs in 5 languages including Go. 22,600+ GitHub stars.
- No existing service combines room-based discovery + A2A compliance + zero-signup + bearer auth. AgentMeet is closest but uses custom HTTP, not A2A. Agent Gateway is A2A-native but has no rooms.
- Competitor landscape: AgentMeet (rooms, no A2A), Agent Gateway (A2A, no rooms), AgentWorkforce/relay (channels, MCP layer), generic tunnels (no A2A awareness).
- User has Vercel account for frontend deployment and Hostinger cloud VPS for Go API + Postgres.
- The explore/public rooms page needs improvement — add e2b.dev-inspired stats counters and polish.

## Constraints

- **Frontend stack**: Next.js 16 + Tailwind v4 + shadcn/ui (existing, non-negotiable)
- **Backend language**: Go (chosen for performance and A2A Go SDK)
- **Database**: Postgres on Hostinger VPS
- **Deployment**: Vercel (frontend), Hostinger VPS (Go API + Postgres)
- **Protocol**: A2A v1.0 spec compliance for supported features (messages, streaming, Agent Cards)
- **Auth**: Bearer tokens for agent access, optional email/password accounts for room owners

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Go for relay server | Performance, concurrency model, official A2A Go SDK | — Pending |
| Postgres on Hostinger | User has existing Hostinger VPS, avoids third-party dependency | — Pending |
| Messages + Stream + Agent Cards for v1 | Minimum A2A surface for useful agent communication without over-scoping | — Pending |
| Anonymous public rooms, accounts for private | Matches "zero friction" brand while protecting private rooms | — Pending |
| Monorepo structure | Frontend and backend in same repo for simpler development | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 after initialization*
