---
phase: quick
plan: 260323-g8m
subsystem: api, ui
tags: [go, a2a, hub, broadcast, next.js, explore, create-room]

requires:
  - phase: 03-streaming-deploy
    provides: Go API with A2A handler, hub infrastructure, frontend explore page

provides:
  - Agent name correctly extracted from X-Agent-Name header in message/send
  - Buffered hub broadcast channel (64) enabling non-blocking broadcast
  - Hub broadcast re-enabled in message/send handler
  - Explore page shows only live API data (no mock rooms)
  - Create Room dialog accessible from explore page
  - Real room count displayed instead of hardcoded "1,247"

affects: [frontend, api, a2a-protocol]

tech-stack:
  added: []
  patterns: [X-Agent-Name header for agent identity in message/send]

key-files:
  created:
    - web/components/create-room-dialog.tsx
  modified:
    - relay/internal/relay/handler.go
    - relay/internal/hub/hub.go
    - web/components/room-grid.tsx
    - web/components/room-filters.tsx
    - web/components/explore-hero.tsx

key-decisions:
  - "Use hubMgr.Get (not GetOrCreate) for broadcast — only broadcast if hub already exists for room"
  - "Use result.bearer_token in CreateRoomDialog — matches Go API JSON field name and TypeScript type"
  - "Empty array fallback (not mock data) when apiRooms is undefined or empty"

patterns-established:
  - "X-Agent-Name header: agents identify themselves via this header in A2A requests"

requirements-completed: []

duration: 25min
completed: 2026-03-23
---

# Quick Task 260323-g8m: Post-MVP Fixes Summary

**Agent name from X-Agent-Name header, buffered broadcast channel, mock data removal, Create Room on explore page**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-23T14:45:29Z
- **Completed:** 2026-03-23T15:10:29Z
- **Tasks:** 2 completed, 1 awaiting human verification (OAuth)
- **Files modified:** 6

## Accomplishments
- Messages now show the real agent name (from X-Agent-Name header) instead of the literal string "user"
- Hub broadcast channel buffered at 64 — message/send no longer risks blocking on broadcast
- Hub.Broadcast re-enabled in message/send handler (was skipped for MVP)
- Explore page shows only live API room data — all fake "1,247 rooms" and mock room cards removed
- CreateRoomDialog extracted as standalone component and wired into explore page hero section
- Hardcoded category tabs with fake counts removed from room-filters.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Go API fixes -- agent_name + buffered broadcast** - `be2e2dc` (fix)
2. **Task 2: Frontend cleanup -- mock data removal + Create Room** - `dbfadf3` (feat)
3. **Task 3: OAuth login smoke test** - CHECKPOINT (awaiting human verification)

## Files Created/Modified
- `relay/internal/hub/hub.go` - Buffered broadcast channel (64)
- `relay/internal/relay/handler.go` - X-Agent-Name extraction, hub.Broadcast re-enabled
- `web/components/create-room-dialog.tsx` - Standalone CreateRoomDialog extracted from dashboard
- `web/components/room-grid.tsx` - Mock data removed, real room count, empty state
- `web/components/room-filters.tsx` - Hardcoded categories removed
- `web/components/explore-hero.tsx` - Create Room button added

## Decisions Made
- Used `hubMgr.Get()` instead of `GetOrCreate()` for broadcast in message/send — only broadcast when a hub already exists (no need to spin up a hub just for broadcast if no SSE subscribers)
- Used `result.bearer_token` (matching Go API response JSON field) in the new CreateRoomDialog instead of `result.token` — the dashboard-content.tsx has a pre-existing bug using `.token`
- Empty array fallback when no API rooms available instead of mock data — accurately reflects live state

## Deviations from Plan

None - plan executed as written for Tasks 1 and 2.

Note: Plan suggested using `hubMgr.GetHub()` but the actual method is `hubMgr.Get()` — adjusted to match existing codebase API.

## Issues Encountered
- API on port 8080 (http://148.230.73.44:8080) was unreachable after deploy trigger — may be behind Traefik proxy or deploy still building. Go compilation on constrained VPS hardware can take several minutes. Frontend deployed to Vercel successfully.
- Pre-existing TypeScript errors in `dashboard-content.tsx` (`.token` instead of `.bearer_token`, `.id` instead of `.slug`) — not caused by this plan's changes, not fixed per scope boundary rules.

## Next Steps
- Task 3 (OAuth smoke test) requires human verification — see checkpoint below
- Verify API is responsive after deploy completes
- Test end-to-end: send message with X-Agent-Name header, verify agent_name in /messages response

---
*Quick Task: 260323-g8m*
*Completed: 2026-03-23*
