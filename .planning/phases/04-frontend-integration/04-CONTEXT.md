# Phase 4: Frontend Integration - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Next.js frontend shows real room data from Go API. Explore page displays live public rooms with e2b-style stats counters. Room detail page shows connected agents and multi-format integration snippets. All create/login flows work end-to-end. Dashboard for logged-in users. Deployed to Vercel.

</domain>

<decisions>
## Implementation Decisions

### Page architecture
- **D-01:** Separate pages — `/explore` is the public-facing rooms directory (no login required). `/dashboard` is the logged-in user's hub (My Rooms + create + quick-start + stats). These are distinct pages, not one page with auth states.
- **D-02:** `/explore` page is gorgeous — grid of public room cards with names, descriptions, agent counts, tags, activity indicators. e2b-style stats counters at top. Search and filter. Strong CTAs to view rooms and create new ones.
- **D-03:** Room detail page at `/r/{slug}` shows room info, connected agents with their cards, skills, and integration snippets.

### Integration snippets
- **D-04:** Tabbed interface on room detail page with multiple snippet formats:
  - **Tab 1 — Terminal**: curl one-liner (e.g., `curl -sL quorum.dev/join.sh | bash`)
  - **Tab 2 — Agent Prompt**: Markdown block to paste into an AI agent's context with URL, token, and instructions
  - **Tab 3 — Python**: SDK/client code example
  - **Tab 4 — Go**: SDK/client code example
- **D-05:** Snippets auto-populate with the room's actual URL and bearer token (masked, with copy button).

### Live updates
- **D-06:** SSE from Go API to browser for real-time updates — best experience possible without hammering the API. SSE for room detail (agents joining/leaving in real time) and explore page (room activity updates). Lightweight events, not full data payloads — browser fetches details on change.

### Auth flow wiring
- **D-07:** OAuth only — Google and GitHub buttons on login page. No email/password forms. Redirect to dashboard after successful login.
- **D-08:** Room creation flow: logged-in users create from dashboard, anonymous users create from explore page or home CTA. Both get room URL + bearer token on success.

### Claude's Discretion
- Exact explore page card layout and stats counter design (reference e2b.dev for inspiration)
- Dashboard layout and section ordering
- SSE event granularity for frontend (full data vs notification-to-refetch)
- Vercel deployment configuration
- API client/fetch patterns in Next.js (server components vs client-side)

</decisions>

<specifics>
## Specific Ideas

- Explore page should be "gorgeous" — the public face of the platform
- "Even the footer must be instructive" — every part of the page teaches users how to use Quorum
- Integration snippets inspired by solvr.dev install pattern — one-liner copy-paste that just works
- Agent prompt tab is unique to Quorum — users paste instructions into their AI agent and it knows how to connect
- "Best experience possible" for live updates — real-time without being heavy

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Dashboard concept (D-07), OAuth only (D-06), room URL format `/r/{slug}` (D-01), anonymous room creation (D-08)
- `.planning/phases/02-a2a-core/02-CONTEXT.md` — Room info endpoint (D-06), agent join/leave events (D-04), global agent cards (D-01)
- `.planning/phases/03-streaming-deploy/03-CONTEXT.md` — SSE transport (D-05, D-06), Easypanel deploy (D-02), Go server live on VPS

### Project specs
- `.planning/PROJECT.md` — Existing frontend description (v0.app, dark theme, teal accent, stubbed data)
- `.planning/REQUIREMENTS.md` — HOME-01 to HOME-03, EXPL-01 to EXPL-04, SNIP-01 to SNIP-03, WIRE-01 to WIRE-04, INFRA-04
- `.planning/ROADMAP.md` — Phase 4 plans (04-01, 04-02), success criteria

### Technology
- `CLAUDE.md` §Technology Stack — Next.js 16.2, Tailwind v4, shadcn/ui (non-negotiable frontend stack)

### Design reference
- Existing v0.app-generated frontend (imported into `/web` during Phase 1) — dark-first theme, teal accent, existing page layouts for home, explore, room detail, docs, pricing, blog, auth pages
- e2b.dev explore page — reference for stats counters and public room directory style

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing Next.js frontend pages (imported in Phase 1): home, explore, room detail, docs, pricing, blog, login/signup, about, contact, privacy, terms, careers — all with mocked data
- shadcn/ui component library already integrated
- Phase 3 delivers: live Go API on VPS with SSE support, all REST and A2A endpoints

### Established Patterns
- Dark-first theme with teal accent (preserve existing design language)
- shadcn/ui components (extend, don't replace)
- Mocked data pattern in existing frontend (replace stubs with real API calls)

### Integration Points
- Next.js → Go API: cross-origin fetch from Vercel domain to VPS domain (CORS configured in Phase 1)
- OAuth flow: Next.js login page → redirect to Go API OAuth handler → callback back to Next.js with session
- SSE: browser EventSource connects to Go API for real-time room/explore updates
- Room creation: Next.js form → POST to Go API → response with room URL + token → display in UI

</code_context>

<deferred>
## Deferred Ideas

- CLI tool for room management (`npx quorum create`) — v2 (CLI-01)
- Advanced room analytics dashboard — not in v1
- Agent marketplace / featured rooms — future enhancement
- Dark/light theme toggle — v0 frontend is dark-first, keep it

</deferred>

---

*Phase: 04-frontend-integration*
*Context gathered: 2026-03-22*
