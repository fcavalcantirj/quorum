---
phase: 03-streaming-deploy
plan: 02
subsystem: infra
tags: [docker, dockerfile, healthcheck, easypanel, traefik, sse, deploy, alpine]

dependency_graph:
  requires:
    - relay/cmd/server/main.go (Phase 01-foundation — chi router, config, graceful shutdown)
    - relay/internal/config/config.go (PORT env var via caarlos0/env tag)
    - relay/internal/migrations (go:embed embedded SQL migrations)
    - relay/internal/relay/handler.go (Phase 03-01 — SSE keep-alive + X-Accel-Buffering)
  provides:
    - relay/Dockerfile (multi-stage build: golang:1.26-alpine builder + alpine:3.21 runtime)
    - relay/.dockerignore (excludes test files, dev artifacts, docs from build context)
    - /healthz endpoint on chi router (unauthenticated, matches Docker HEALTHCHECK path)
  affects:
    - Phase 04-frontend-integration (needs HTTPS URL from this plan to configure FRONTEND_URL/BASE_URL)

tech-stack:
  added:
    - golang:1.26-alpine (Docker builder stage)
    - alpine:3.21 (Docker runtime stage)
  patterns:
    - Multi-stage Docker build: download deps as separate layer before COPY source (cache optimization)
    - Non-root container user (addgroup -S relay + adduser -S relay) for security hardening
    - Migrations embedded in binary via go:embed — no external SQL files needed at runtime
    - CGO_ENABLED=0 + -trimpath + -ldflags="-s -w" for minimal static binary

key-files:
  created:
    - relay/Dockerfile
    - relay/.dockerignore
  modified:
    - relay/cmd/server/main.go (/healthz endpoint added alongside existing /health)

key-decisions:
  - "GOARCH=amd64 explicit in ENV — Hostinger VPS is x86_64; prevents misbuilds from ARM Mac builders"
  - "wget used in HEALTHCHECK (not curl) — alpine:3.21 includes busybox wget, curl not installed by default"
  - "/healthz separate from /health — Dockerfile HEALTHCHECK uses /healthz; /health kept for backward compat"
  - "ca-certificates + tzdata in alpine runtime — required for Postgres TLS connections and time.LoadLocation"

patterns-established:
  - "Dockerfile at relay/Dockerfile (not repo root) — Easypanel build context must be set to relay/ subdirectory"
  - "Docker HEALTHCHECK targets /healthz with wget -qO- to avoid curl dependency in alpine runtime"

requirements-completed: [INFRA-03]

duration: ~15min
completed: 2026-03-23
tasks_completed: 1
tasks_pending: 1
files_created: 2
files_modified: 1
---

# Phase 03 Plan 02: Dockerfile and Easypanel Deploy Summary

**Multi-stage Docker build for Go relay server with embedded migrations, non-root user, and /healthz endpoint — pending Easypanel deploy verification on Hostinger VPS**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-23T01:47:33Z
- **Completed:** 2026-03-23 (Task 1 complete; Task 2 awaiting human-verify)
- **Tasks:** 1 of 2 complete (Task 2 is checkpoint:human-verify)
- **Files modified:** 3

## Accomplishments
- Production Dockerfile with multi-stage build (golang:1.26-alpine builder, alpine:3.21 runtime)
- Static CGO_ENABLED=0 binary with -trimpath and -ldflags="-s -w" stripping
- Non-root container user (relay:relay group) for security hardening
- Docker HEALTHCHECK at /healthz every 30s with 5s timeout, 10s start period
- .dockerignore excluding test files, git, .env, docs, and IDE artifacts from build context
- /healthz endpoint added to chi router (unauthenticated — Easypanel + Docker daemon can probe it)
- go build ./... passes cleanly after all changes

## Task Commits

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Dockerfile, .dockerignore, /healthz endpoint | be6daa4 | relay/Dockerfile, relay/.dockerignore, relay/cmd/server/main.go |
| 2 | Deploy to Easypanel + Traefik SSE verification | PENDING CHECKPOINT | — |

## Files Created/Modified
- `relay/Dockerfile` — Multi-stage build: golang:1.26-alpine builder, alpine:3.21 runtime, non-root user, HEALTHCHECK
- `relay/.dockerignore` — Excludes *_test.go, .git/, .env*, *.md, tmp/ from Docker build context
- `relay/cmd/server/main.go` — Added /healthz endpoint alongside existing /health for Docker HEALTHCHECK

## Decisions Made
- `GOARCH=amd64` explicit in Dockerfile ENV — Hostinger VPS is x86_64; without it, ARM Mac builders would produce ARM binaries
- `wget` used in HEALTHCHECK (`wget -qO- http://localhost:8080/healthz`) — alpine:3.21 includes busybox wget; curl is not installed by default and would require an extra `apk add`
- `/healthz` added as a distinct endpoint from `/health` — plan specified `/healthz` for Docker HEALTHCHECK; `/health` kept for backward compatibility with any existing monitoring
- `ca-certificates` and `tzdata` added to alpine runtime — Postgres TLS connections require ca-certificates; Go's `time.LoadLocation` requires tzdata on alpine

## Deviations from Plan

None — plan executed exactly as written for Task 1.

Docker build could not be verified locally (Docker daemon not running in this automated session — requires Docker Desktop GUI to be active). All structural acceptance criteria verified via grep checks. `go build ./...` passes cleanly. The Docker image will be validated by Easypanel on the VPS (Task 2).

## Issues Encountered

Docker daemon unavailable during automated session (Docker Desktop requires GUI initialization). Docker build verification moved to Task 2 Easypanel deploy verification, which is a human-verify checkpoint anyway.

## Known Stubs

None. All code is production-ready:
- Dockerfile builds a real static binary with embedded migrations
- /healthz is a real endpoint returning `{"status":"ok"}` with 200
- No hardcoded values, no mock responses

## User Setup Required

Task 2 (PENDING) requires manual Easypanel configuration:
1. Create Easypanel service pointing to git repo
2. Set Dockerfile path to `relay/Dockerfile`
3. Set proxy port to `8080`
4. Configure environment variables: DATABASE_URL, JWT_SECRET, FRONTEND_URL, BASE_URL, MAX_SSE_PER_ROOM (optional), MAX_SSE_TOTAL (optional)
5. Add domain + enable Let's Encrypt TLS
6. Deploy and verify /healthz returns 200 and SSE heartbeats arrive every ~20 seconds

## Next Phase Readiness

- Task 2 is a blocking checkpoint — Phase 04 should not start until the HTTPS URL is known (needed for FRONTEND_URL/BASE_URL env vars and Next.js API configuration)
- Once Easypanel deploy is verified, the production HTTPS URL must be documented (update STATE.md and any Phase 04 context)

---
*Phase: 03-streaming-deploy*
*Plan: 02*
*Completed (Task 1): 2026-03-23*
