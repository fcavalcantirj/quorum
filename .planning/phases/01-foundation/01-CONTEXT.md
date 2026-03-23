# Phase 1: Foundation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Monorepo exists with the existing Next.js frontend imported into `/web` and Go relay server in `/relay`. Go server boots, connects to Postgres, and applies migrations on startup. Bearer token auth and rate limiting are in place on all endpoints. Room CRUD is backed by real database rows. OAuth login (Google + GitHub) works. Anonymous public room creation works without an account.

</domain>

<decisions>
## Implementation Decisions

### Room identity & URL shape
- **D-01:** Room URLs use the `/r/` prefix — e.g., `quorum.dev/r/my-cool-room`. IRC-like, short, clean.
- **D-02:** Users pick a room name (display name); slug is auto-generated from it (lowercase, hyphens). Slug format: 3-40 characters, `[a-z0-9-]`, no leading/trailing hyphens.
- **D-03:** Slug conflicts show an error — "This name is taken" — user picks another name. No auto-suffixing.
- **D-04:** A2A endpoint lives at `/r/{slug}/a2a`
- **D-05:** Public rooms created anonymously expire after **3 days of inactivity** (no messages, no agent connections). Activity resets the timer. Rooms owned by logged-in users do not expire.

### Authentication flow
- **D-06:** OAuth only for v1 — Google and GitHub. **Email/password dropped entirely from v1** (AUTH-02, AUTH-03 removed from scope).
- **D-07:** After OAuth login, user lands on a **single-page dashboard** that packs everything: My Rooms + Create button, public rooms directory, quick-start/API docs link, activity stats. Even the footer is instructive.
- **D-08:** Anonymous users can create public rooms but cannot manage them (no delete, no edit). If the anonymous user later logs in via OAuth **in the same browser session**, their rooms auto-link to the new account (browser session-based claiming).
- **D-09:** JWT session duration: 30 days with secure httpOnly cookies. Refresh token pattern for silent re-auth.

### Rate limiting
- **D-10:** Room creation: **strict for anonymous** (2 rooms/hour per IP), **moderate for logged-in** (5 rooms/hour per IP). Limits must be easily configurable (env vars or config struct).
- **D-11:** A2A message rate limits: Claude's discretion based on research — must be generous enough for real multi-agent conversation but prevent runaway loops.
- **D-12:** Rate limit response format: Claude's discretion based on what's most intuitive for AI agents to handle programmatically.

### Bearer token format & lifecycle
- **D-13:** Claude's discretion — must be secure and easy to use. Research best practices for relay/room-based token auth. Consider: opaque vs JWT, hashed storage, revocation, one vs multiple tokens per room.

### Claude's Discretion
- Bearer token format, storage, and lifecycle (D-13)
- A2A message rate limit thresholds (D-11)
- Rate limit response format (D-12)
- JWT refresh token implementation details (D-09)
- Dashboard page layout specifics
- Password hashing N/A — OAuth only

</decisions>

<specifics>
## Specific Ideas

- Dashboard should be a single page — "pack everything, even the footer must be instructive"
- Room URL should feel IRC-like: `/r/room-name`
- Anonymous room creation is core to "zero friction" brand — never gate public rooms behind login
- Make rate limits easily configurable — plan for tuning in production
- "If it's secure, session can be longer" — user prefers convenience over aggressive session expiry

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Core value, constraints, key decisions, technology stack
- `.planning/REQUIREMENTS.md` — Full v1 requirement list with IDs; note AUTH-02 and AUTH-03 are now dropped from v1 per D-06
- `.planning/ROADMAP.md` — Phase 1 plan breakdown (01-01, 01-02, 01-03), success criteria, dependencies

### Technology stack
- `CLAUDE.md` §Technology Stack — Complete stack table with versions, alternatives considered, and compatibility matrix
- `CLAUDE.md` §Stack Patterns by Variant — How chi, a2asrv, and pgx wire together

### External protocol
- A2A v1.0 spec at `a2a-protocol.org/latest/specification/` — JSON-RPC 2.0 binding, error codes, Agent Card schema, required headers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing Next.js frontend (to be imported into `/web`) — complete pages for home, explore, room detail, docs, pricing, blog, login/signup, about, contact, privacy, terms. All data currently stubbed/mocked.

### Established Patterns
- Dark-first theme with teal accent (existing frontend)
- shadcn/ui components (existing frontend)
- Tailwind v4 (existing frontend)

### Integration Points
- Go relay API will be called from Next.js frontend (cross-origin — CORS middleware required)
- Frontend currently uses mocked data — Phase 4 replaces stubs with real API calls
- OAuth redirect flow: frontend initiates → Go API handles OAuth callback → redirects back to frontend with session

</code_context>

<deferred>
## Deferred Ideas

- Email/password authentication — explicitly dropped from v1 (was AUTH-02, AUTH-03)
- Token rotation without disconnecting agents — v2 (TOKR-01)
- Room capacity limits based on VPS resources — validate during Phase 3 deployment
- Horizontal scaling / Redis pub-sub — v2, single VPS for v1

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-22*
