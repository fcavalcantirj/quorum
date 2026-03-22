# Phase 4: Frontend Integration - Research

**Researched:** 2026-03-22
**Domain:** Next.js 16 App Router — data fetching, SSE client, OAuth with Go backend, Vercel monorepo deploy
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Separate pages — `/explore` (public rooms, no login required) and `/dashboard` (logged-in user hub). Distinct pages, not one page with auth states.
- **D-02:** `/explore` is gorgeous — grid of public room cards with names, descriptions, agent counts, tags, activity indicators. e2b-style stats counters at top. Search and filter. Strong CTAs.
- **D-03:** Room detail page at `/r/{slug}` shows room info, connected agents with their cards, skills, and integration snippets.
- **D-04:** Tabbed integration snippets with four tabs: Terminal (curl one-liner), Agent Prompt (markdown block), Python (SDK code), Go (SDK code).
- **D-05:** Snippets auto-populate with the room's actual URL and bearer token (masked, with copy button).
- **D-06:** SSE from Go API to browser for real-time updates — room detail (agents joining/leaving) and explore page (room activity updates). Lightweight events, not full data payloads.
- **D-07:** OAuth only — Google and GitHub buttons on login page. No email/password forms. Redirect to dashboard after login.
- **D-08:** Room creation flow: logged-in users from dashboard, anonymous users from explore or home CTA. Both get room URL + bearer token on success.

### Claude's Discretion

- Exact explore page card layout and stats counter design (reference e2b.dev for inspiration)
- Dashboard layout and section ordering
- SSE event granularity for frontend (full data vs notification-to-refetch)
- Vercel deployment configuration
- API client/fetch patterns in Next.js (server components vs client-side)

### Deferred Ideas (OUT OF SCOPE)

- CLI tool for room management (`npx quorum create`) — v2 (CLI-01)
- Advanced room analytics dashboard — not in v1
- Agent marketplace / featured rooms — future enhancement
- Dark/light theme toggle — v0 frontend is dark-first, keep it
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOME-01 | Home page displays existing hero, features, how-it-works, comparison, pricing, CTA sections | Preserve existing v0.app-generated layout; only add activity widget |
| HOME-02 | Home page includes a live activity widget showing public room activity (active rooms, agents online, messages relayed) | Server component initial fetch + SWR for refresh OR SSE subscription; shadcn Skeleton on load |
| HOME-03 | Activity widget links to the full explore/public rooms page with strong CTA | Static link; no data dependency |
| EXPL-01 | Explore page displays a grid of public room cards (name, description, agent count, tags, activity) | Server component initial fetch; SWR client-side polling or SSE for updates |
| EXPL-02 | Explore page shows e2b-style stats counters at top (total rooms, active agents, messages relayed) | Same data source as HOME-02; SSE for real-time counter updates |
| EXPL-03 | Explore page has search by room name and filter by tag/skill | Client component; useState for query + tag; debounced API fetch or client-side filter |
| EXPL-04 | Room detail page shows room info, connected agents, skills, and integration snippet | Server component for initial room data; client component for SSE-driven agent list |
| SNIP-01 | Room detail page shows one-liner integration code for Python | Tabbed shadcn Tabs panel; token masked by default |
| SNIP-02 | Room detail page shows one-liner integration code for JavaScript/TypeScript | Same tabs panel |
| SNIP-03 | Room detail page shows one-liner integration code for Go | Same tabs panel |
| WIRE-01 | Frontend room data fetched from Go API (replace mocked stubs) | Server component fetch from `NEXT_PUBLIC_API_URL`; replace all stub data |
| WIRE-02 | Room creation flow connected to Go API | Client component form → POST to Go API; response includes room URL + token |
| WIRE-03 | Login/signup forms connected to Go API auth endpoints | OAuth redirect: login page buttons → Go API `/auth/google` or `/auth/github` → Go callback sets httpOnly cookie → redirect back to `/dashboard` |
| WIRE-04 | Explore page stats and room list fetched from Go API | Server component for initial payload; SSE for live updates |
| INFRA-04 | Next.js frontend deployed on Vercel | Vercel project with Root Directory = `web`; `NEXT_PUBLIC_API_URL` env var set in Vercel dashboard |
</phase_requirements>

---

## Summary

Phase 4 is a frontend integration and deployment phase. The existing v0.app-generated Next.js frontend (imported into `/web` during Phase 1) has all pages stubbed with mock data. This phase replaces every mock with a real Go API call, adds SSE subscriptions for live updates, wires OAuth login through the Go backend, and deploys to Vercel.

The architecture is a hybrid of Next.js App Router server components (for initial data fetching — SEO-friendly, fast first paint) and client components (for interactivity: search, SSE subscriptions, copy-to-clipboard, forms). Static page data is fetched in async server components. Dynamic real-time data (agent presence, stats counters) uses the browser `EventSource` API inside `"use client"` components.

The hardest integration concern is OAuth: Google and GitHub flows are handled entirely by the Go backend. The Go callback sets a `session` JWT in an httpOnly, `SameSite=Lax`, `Secure` cookie, then HTTP-redirects to `/dashboard` on the Next.js Vercel domain. The Next.js middleware reads that cookie to protect dashboard routes. A second concern is SSE authentication: `EventSource` cannot send `Authorization` headers — the Go API's SSE endpoint must accept the session cookie via `withCredentials: true` instead, requiring the Go CORS config to allow credentials with the exact Vercel origin.

**Primary recommendation:** Use Next.js server components for all initial page data loads. Use SWR (`useSWR`) in client components for polling-based updates where SSE is not needed. Use `EventSource` + `useEffect` cleanup in client components for the two SSE-connected sections (explore stats bar, room detail agents panel). Store the OAuth session in an httpOnly cookie set by the Go backend — never in localStorage.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 | Frontend framework | Non-negotiable (project constraint). App Router with server components is default. |
| React | 19.x (bundled with Next.js 16) | UI library | Bundled; `use()` API and `useActionState` available. |
| Tailwind CSS | v4 | Utility CSS | Non-negotiable (project constraint). |
| shadcn/ui | current | Component library | Pre-existing, non-negotiable. Tabs, Dialog, Input, Card, Skeleton, Toast, Badge, Avatar, Separator, Button, Sheet. |
| lucide-react | bundled with shadcn | Icon library | shadcn default. Use `Clipboard`, `Check`, `Eye`, `EyeOff` icons. |
| SWR | 2.3.x | Client-side data fetching | Vercel-maintained. Best pairing with Next.js for refetch-on-focus, deduplication, error retry. Use in client components where SSE is not needed. |
| jose | 5.x | JWT verification in Next.js middleware | Edge-runtime compatible. Used to verify the session cookie from the Go backend. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/navigation` (useRouter, redirect) | Next.js 16.2.1 built-in | Client-side navigation after OAuth redirect | useRouter().push('/dashboard') in login success handler |
| `next/headers` (cookies) | Next.js 16.2.1 built-in | Read session cookie in server components and middleware | DAL pattern to verify session on server |
| `server-only` npm package | 0.0.1 | Prevents accidental import of server code in client bundle | Add to all DAL files that read cookies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SWR | React Query (TanStack Query) | React Query is slightly more powerful for mutations; SWR is simpler, smaller, Vercel-native. For read-heavy use case like Quorum's explore page, SWR is preferred. |
| SWR | native fetch + useEffect | No deduplication, no retry, no focus-refetch. SWR handles all of these. |
| EventSource (SSE) | SWR polling | SSE is correct for push events (agent joins). SWR polling would require short intervals and wastes requests. Use SSE for room detail and explore stats. |
| httpOnly cookie for session | localStorage for JWT | localStorage is XSS-vulnerable. httpOnly cookies are safe. The Go backend already issues the cookie — frontend just reads it in middleware. |

**Installation (in `/web` directory):**
```bash
npm install swr jose server-only
```

---

## Architecture Patterns

### Recommended Project Structure (additions to existing `/web`)
```
web/
├── app/
│   ├── (marketing)/          # Route group: home, pricing, blog, docs — server components
│   │   └── page.tsx          # Home page — add <ActivityWidget> server component
│   ├── explore/
│   │   ├── page.tsx          # Server component: initial rooms + stats fetch
│   │   ├── loading.tsx       # Skeleton fallback via Suspense
│   │   └── _components/
│   │       ├── StatsBar.tsx  # "use client" — SSE subscription for live counter updates
│   │       ├── RoomGrid.tsx  # "use client" — holds search state, renders RoomCard list
│   │       └── RoomCard.tsx  # Pure display component
│   ├── r/
│   │   └── [slug]/
│   │       ├── page.tsx      # Server component: fetch room + agents on load
│   │       ├── loading.tsx   # Skeleton
│   │       └── _components/
│   │           ├── AgentsPanel.tsx    # "use client" — SSE for join/leave
│   │           └── SnippetTabs.tsx    # "use client" — Tabs, copy-to-clipboard
│   ├── dashboard/
│   │   ├── page.tsx          # "use client" (auth-gated) — My Rooms, Create Room button
│   │   └── _components/
│   │       ├── RoomList.tsx  # SWR-based room list
│   │       └── CreateRoomDialog.tsx   # shadcn Dialog with form
│   ├── login/
│   │   └── page.tsx          # Two OAuth buttons: Google, GitHub — client component
│   └── api/
│       └── auth/
│           └── callback/
│               └── route.ts  # Next.js Route Handler — receives JWT from Go redirect, sets cookie, redirects to /dashboard
├── lib/
│   ├── api.ts                # Typed fetch wrapper for Go API — uses NEXT_PUBLIC_API_URL
│   ├── session.ts            # server-only: read/verify session cookie via jose
│   └── dal.ts                # server-only: verifySession() — used in all protected server components
├── middleware.ts              # Next.js middleware: protect /dashboard route, redirect to /login if no valid session
└── .env.local                # NEXT_PUBLIC_API_URL=http://localhost:8080 (dev)
```

### Pattern 1: Server Component for Initial Data Fetch
**What:** Async server component fetches data from Go API on the server. No loading flash. SEO-friendly.
**When to use:** Explore page initial room list and stats; room detail page header; any data needed for first paint.
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/getting-started/fetching-data (version 16.2.1, 2026-03-13)
// web/app/explore/page.tsx
export default async function ExplorePage() {
  const [rooms, stats] = await Promise.all([
    fetch(`${process.env.API_URL}/rooms?public=true`).then(r => r.json()),
    fetch(`${process.env.API_URL}/stats`).then(r => r.json()),
  ])
  return (
    <>
      <StatsBar initialStats={stats} />   {/* client component — subscribes to SSE */}
      <RoomGrid initialRooms={rooms} />   {/* client component — holds search state */}
    </>
  )
}
```
Note: `process.env.API_URL` (without `NEXT_PUBLIC_`) is server-only and safe. For client components, use `process.env.NEXT_PUBLIC_API_URL`.

### Pattern 2: SSE Client Hook
**What:** `useEffect` opens an `EventSource`, registers event listeners, returns cleanup that calls `eventSource.close()`.
**When to use:** Explore stats bar (global stats updates), room detail agents panel (join/leave events).

**Critical SSE constraint:** The browser `EventSource` API cannot send custom headers. The Go API's SSE endpoint MUST authenticate via the session cookie (`withCredentials: true`). The Go API's CORS config MUST allow the Vercel origin with `credentials: true`.

```typescript
// Source: https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view
// web/app/r/[slug]/_components/AgentsPanel.tsx
"use client"
import { useEffect, useRef, useState } from "react"

export function useRoomSSE(roomSlug: string) {
  const [agents, setAgents] = useState<Agent[]>([])
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    const es = new EventSource(`${apiUrl}/r/${roomSlug}/events`, {
      withCredentials: true,  // send session cookie for auth
    })
    esRef.current = es

    es.addEventListener("agent_joined", (e) => {
      const agent = JSON.parse(e.data)
      setAgents(prev => [...prev, agent])
    })
    es.addEventListener("agent_left", (e) => {
      const { agentId } = JSON.parse(e.data)
      setAgents(prev => prev.filter(a => a.id !== agentId))
    })
    es.onerror = () => {
      // Browser auto-reconnects for transient errors
      // Show inline "Reconnecting..." badge — do not toast-spam
    }

    return () => { es.close() }
  }, [roomSlug])

  return agents
}
```

### Pattern 3: OAuth Session Flow (Go Backend → Next.js Cookie)
**What:** Go backend handles the full OAuth dance. After callback from Google/GitHub, Go mints a JWT, sets it as an httpOnly cookie in the HTTP response, then HTTP-redirects to `https://quorum.vercel.app/dashboard`. Next.js middleware reads the cookie to protect routes.
**When to use:** Login page (WIRE-03), middleware.ts, DAL.

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication (version 16.2.1, 2026-03-03)
// web/middleware.ts
import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const secret = new TextEncoder().encode(process.env.SESSION_SECRET)
const protectedRoutes = ["/dashboard"]

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (!protectedRoutes.some(r => path.startsWith(r))) return NextResponse.next()

  const cookie = req.cookies.get("session")?.value
  try {
    await jwtVerify(cookie ?? "", secret)
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
}
```

**Go backend must set the cookie with these exact attributes:**
- `HttpOnly: true` — no JS access
- `Secure: true` — HTTPS only (both Vercel and VPS are HTTPS)
- `SameSite: Lax` — allows top-level GET redirects (OAuth callback redirect) to send the cookie; blocks cross-site POST requests
- `Domain: quorum.vercel.app` — set explicitly so cookie is sent to Vercel domain from Go VPS redirect
- `Path: /`
- `MaxAge: 30 * 24 * 60 * 60` — 30-day session per Phase 1 D-09

**Important:** SameSite=Lax is correct here. SameSite=Strict would block the cookie from being sent on the OAuth redirect (which is a cross-site navigation). SameSite=None requires Secure and sets cookies on all cross-site requests — overkill and less safe.

### Pattern 4: SWR for Client-Side Data Refresh
**What:** `useSWR` hook fetches data on mount, refetches on tab focus, deduplicated across components.
**When to use:** Dashboard room list (user's rooms), anywhere server-side SSE is too heavy.

```typescript
// Source: https://swr.vercel.app/docs/with-nextjs
"use client"
import useSWR from "swr"

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(r => r.json())

export function RoomList() {
  const { data: rooms, error, isLoading } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/users/me/rooms`,
    fetcher
  )
  if (isLoading) return <RoomListSkeleton />
  if (error) return <ErrorMessage message="Could not reach the Quorum API. Check your connection and refresh." />
  return <ul>{rooms.map(r => <RoomCard key={r.id} room={r} />)}</ul>
}
```

### Pattern 5: Copy-to-Clipboard (shadcn hook)
**What:** `useCopyToClipboard` from shadcn returns `[copy, isCopied]`. `isCopied` auto-resets after 2 seconds.
**When to use:** Integration snippet tabs (SNIP-01–03), bearer token display (D-05).

```typescript
// Source: https://www.shadcn.io/hooks/use-copy-to-clipboard
"use client"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Clipboard, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CopyButton({ text }: { text: string }) {
  const [copy, isCopied] = useCopyToClipboard()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Copy snippet"
      onClick={() => copy(text)}
    >
      {isCopied ? <Check className="text-primary" /> : <Clipboard className="text-muted-foreground hover:text-primary" />}
    </Button>
  )
}
```

### Pattern 6: Vercel Monorepo Deploy from `/web` Subdirectory
**What:** Vercel project configured with Root Directory = `web`. Build command remains `next build`. All env vars set in Vercel dashboard.
**When to use:** INFRA-04. One-time setup.

Configuration in Vercel dashboard:
- **Root Directory:** `web`
- **Framework Preset:** Next.js (auto-detected)
- **Build Command:** `next build` (default)
- **Environment Variables:**
  - `NEXT_PUBLIC_API_URL` = `https://api.quorum.dev` (Go VPS domain)
  - `SESSION_SECRET` = (same secret used by Go backend to sign JWTs)

`vercel.json` is optional. No workspace config needed since `/web` is self-contained.

### Anti-Patterns to Avoid
- **Passing bearer tokens in SSE URL query string:** Explicitly forbidden by project constraint (STATE.md: "Never accept bearer tokens in URL query strings — reject with 400 from day one"). Use session cookie with `withCredentials: true` instead.
- **`"use client"` on page.tsx:** Mark leaf components as client only. Keep page.tsx as server component for initial data fetch.
- **NEXT_PUBLIC_ for server-side secrets:** SESSION_SECRET must NOT have NEXT_PUBLIC_ prefix. Only use NEXT_PUBLIC_ for values safe in the browser bundle.
- **Polling for agent presence:** SSE is wired by Phase 3. Use EventSource, not setInterval.
- **`use cache` directive for room-detail data:** Room agent lists change per-request (SSE-driven). Do not cache. Use `{cache: 'no-store'}` on fetch calls that return live presence data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Copy-to-clipboard with "Copied!" feedback | Custom useState + setTimeout | `useCopyToClipboard` from shadcn | Auto-reset, error handling, clipboard API fallback — already solved. |
| Tab navigation for code snippets | Custom tab state machine | shadcn `Tabs` component | Keyboard navigation, accessibility, ARIA roles — Radix-backed. |
| Form validation state | Custom error map | `useActionState` with Server Actions or `useState` + inline messages | React 19 pattern; built-in pending/error/state management. |
| Session JWT verification in middleware | Custom JWT parser | `jose` (`jwtVerify`) | Edge-runtime compatible, handles expiry, handles algorithm validation. Hand-rolling JWT parsing is a security risk. |
| Skeleton loading shapes | CSS shimmer animations | shadcn `Skeleton` component | Consistent with design system; one line per section. |
| Modal for create-room form | Custom overlay | shadcn `Dialog` | Focus trap, `aria-modal`, ESC key close — required for accessibility. |
| Toast notifications | Custom toaster | shadcn `Toast` / `useToast` | Already in project. "Copied!" feedback, API error notifications. |
| SSE reconnect logic | Exponential backoff loop | Native `EventSource` auto-reconnect | Browser handles transient reconnect automatically. Only manual close when component unmounts. |

**Key insight:** shadcn/ui is already initialized. All listed components are available without additional installation. Run `npx shadcn@latest add [component]` only if a specific component was not yet added.

---

## Common Pitfalls

### Pitfall 1: NEXT_PUBLIC_ Variable Frozen at Build Time
**What goes wrong:** Developer updates `NEXT_PUBLIC_API_URL` in Vercel dashboard but does not redeploy. The old value remains embedded in the JS bundle.
**Why it happens:** `NEXT_PUBLIC_` variables are inlined at `next build` time, not read at runtime.
**How to avoid:** After changing any `NEXT_PUBLIC_` env var in Vercel, trigger a manual redeploy.
**Warning signs:** API calls going to old URL in production despite Vercel showing the new value.

### Pitfall 2: SSE Connection Not Authenticated (401 on EventSource)
**What goes wrong:** `EventSource` connects to Go API SSE endpoint but receives 401. Agent panel shows permanent "Reconnecting..." state.
**Why it happens:** `EventSource` does not send `Authorization: Bearer` headers. The Go backend rejects the request.
**How to avoid:**
1. Pass `{ withCredentials: true }` to `EventSource` constructor.
2. Go API CORS config must have `Access-Control-Allow-Origin: https://quorum.vercel.app` (exact origin, NOT `*`) and `Access-Control-Allow-Credentials: true`.
3. Session cookie must be set with `SameSite=Lax` or `SameSite=None; Secure` (Lax is sufficient for same top-level navigation; None is needed only if SSE is embedded in cross-site iframes).
**Warning signs:** Network tab shows EventSource request with no `cookie` header; Go API logs show missing/invalid auth.

### Pitfall 3: OAuth Cookie Not Received on Vercel Domain (Cross-Domain Cookie Issue)
**What goes wrong:** Go backend (api.quorum.dev) redirects to Next.js (quorum.vercel.app) after OAuth. Cookie set in Go's HTTP response is not received by the browser on the Vercel domain.
**Why it happens:** The cookie is set by `api.quorum.dev` but the browser is navigating to `quorum.vercel.app`. Browsers associate cookies with the domain that SET them, not the redirect destination. The session cookie will only be sent back to `api.quorum.dev` — it will not appear at `quorum.vercel.app`.
**How to avoid:**
- The Go backend must NOT set the cookie on itself. Instead: after exchanging OAuth tokens, Go constructs a redirect URL to `quorum.vercel.app/api/auth/callback?token=<short-lived-opaque-code>` (or a signed JWT in query param — acceptable ONLY for this one-time short-lived redirect token, NOT the bearer token). The Next.js Route Handler at `/api/auth/callback` receives the token, verifies it by calling back to the Go API, then sets the session cookie on the Vercel domain.
- Alternatively: Go backend sets the cookie with `Domain=.quorum.dev` IF both frontend and backend share the same apex domain. If Vercel is on `quorum.vercel.app` and Go is on `api.quorum.dev`, they do NOT share an apex domain — this approach fails.
- **Recommended pattern for Quorum v1:** Go callback redirects to `https://quorum.vercel.app/api/auth/callback?code=<short-lived-opaque-code>` (code expires in 60s). Next.js Route Handler POSTs the code to Go API to exchange for a JWT. Next.js then sets the `session` httpOnly cookie on `quorum.vercel.app` and redirects to `/dashboard`.
**Warning signs:** Middleware always redirects to `/login` despite successful OAuth; no `session` cookie visible in browser dev tools on the Vercel domain.

### Pitfall 4: Server Component Importing Client Hook
**What goes wrong:** Build error: "You're importing a component that needs useState. It only works in a Client Component but none of its parents are marked with 'use client'."
**Why it happens:** `useSWR`, `useState`, `useEffect`, `useCopyToClipboard` are React hooks — they cannot run in server components.
**How to avoid:** Any component that uses hooks must have `"use client"` at the top. Page-level server components pass initial data as props to client-component children.
**Warning signs:** Build fails with the hook error message above.

### Pitfall 5: `SameSite=Strict` Breaks OAuth Redirect
**What goes wrong:** OAuth callback succeeds on Go backend, Go redirects to Next.js, but session cookie is not sent on the redirect GET request, so middleware thinks user is not authenticated.
**Why it happens:** `SameSite=Strict` cookies are NOT sent on cross-site navigations — including the final redirect hop from the OAuth provider back to your site. The cookie is set but stripped on the incoming request.
**How to avoid:** Set `SameSite=Lax` (not Strict) on the session cookie. Lax allows cookies on top-level GET navigations (like OAuth redirects) while still blocking cross-site POST requests.
**Warning signs:** Middleware redirects to `/login` immediately after OAuth despite the callback completing.

### Pitfall 6: Missing `credentials: "include"` on fetch() for Protected Endpoints
**What goes wrong:** `useSWR` or plain `fetch()` calls to Go API from client components return 401 even though the session cookie is set.
**Why it happens:** By default, `fetch()` does not send cookies on cross-origin requests. The `credentials: "include"` option must be explicitly set.
**How to avoid:** All `fetch()` calls from Next.js client components to the Go API must use `credentials: "include"`. Build a central `apiFetch` wrapper that sets this by default.
**Warning signs:** Network tab shows requests without `cookie` header to Go API; 401 responses on authenticated endpoints.

---

## Code Examples

Verified patterns from official sources:

### API Fetch Wrapper (client-side)
```typescript
// web/lib/api.ts
// For use in "use client" components only
const API_URL = process.env.NEXT_PUBLIC_API_URL

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",  // always send session cookie
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}
```

### Server-Side Fetch (no `credentials` needed — cookie read from server)
```typescript
// web/lib/session.ts — server-only
import "server-only"
import { cookies } from "next/headers"
import { jwtVerify } from "jose"

const secret = new TextEncoder().encode(process.env.SESSION_SECRET)

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}
```

### Next.js Route Handler for OAuth Callback
```typescript
// web/app/api/auth/callback/route.ts
// Source: https://nextjs.org/docs/app/guides/authentication (version 16.2.1)
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", req.nextUrl))

  // Exchange code for JWT with Go API
  const res = await fetch(`${process.env.API_URL}/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) return NextResponse.redirect(new URL("/login?error=exchange_failed", req.nextUrl))

  const { token, expiresAt } = await res.json()
  const cookieStore = await cookies()
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  })
  return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
}
```

### Anonymous Room Creation Flow
```typescript
// web/app/explore/_components/CreateRoomDialog.tsx
"use client"
import { useState } from "react"
import { apiFetch } from "@/lib/api"

export function CreateRoomDialog() {
  const [roomName, setRoomName] = useState("")
  const [result, setResult] = useState<{ url: string; token: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const room = await apiFetch<{ url: string; token: string }>("/rooms", {
        method: "POST",
        body: JSON.stringify({ name: roomName, public: true }),
      })
      setResult(room)
    } catch {
      setError("Room could not be created. The name may already be taken or invalid.")
    }
  }
  // render form or result...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getServerSideProps` / `getStaticProps` (Pages Router) | Async server components + `fetch` (App Router) | Next.js 13 (2022), stable in 13.4 | No special data-fetching functions needed; just `async/await` in components |
| `useEffect` + `setState` for client fetching | `useSWR` or `use()` + Suspense | SWR 2.0 (2022), React 19 (2024) | Deduplication, error retry, focus-refetch out of the box |
| Pages Router middleware for auth | `middleware.ts` with `jose.jwtVerify` in App Router | Next.js 12+ (middleware), stable pattern in 13+ | Edge-compatible; runs before page render |
| `SameSite=Strict` for session cookies | `SameSite=Lax` | Modern browsers enforced Lax as default ~2020 | Strict breaks OAuth redirect flows; Lax is the correct default |
| CORS wildcard `*` with credentials | Exact origin + `credentials: true` | Browser spec (always) | `*` + credentials is disallowed by browsers |

**Deprecated/outdated:**
- `getServerSideProps`: Only for Pages Router. Not used in App Router.
- `next/router` (`useRouter` from `next/router`): Use `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) in App Router.
- `next-auth` v3/v4 for custom backend OAuth: Not used here. Go backend owns the OAuth dance; Next.js only receives the resulting token.

---

## Open Questions

1. **SSE endpoint path for browser clients (not A2A agents)**
   - What we know: Phase 3 adds SSE transport for A2A `message/stream`. The Go server has SSE infrastructure.
   - What's unclear: Phase 3's SSE may be A2A-specific (requires `A2A-Version: 1.0` header and bearer token). Browser clients need a separate SSE endpoint for room presence events and global stats that authenticates via session cookie, not agent bearer token.
   - Recommendation: Confirm with Phase 3 plan that Go API exposes a browser-facing SSE endpoint (e.g., `GET /r/{slug}/events` and `GET /stats/stream`) separate from the A2A `message/stream` endpoint. If not, plan a new endpoint in the Phase 4 wave.

2. **OAuth code exchange endpoint on Go API**
   - What we know: Go backend handles `/auth/google` and `/auth/github` initiation. Phase 1 delivers OAuth login.
   - What's unclear: Whether Phase 1 plans a short-lived code exchange endpoint (`POST /auth/exchange`) or assumes a different redirect pattern. The cross-domain cookie pitfall makes a code exchange endpoint the safest approach.
   - Recommendation: Planner should include a task to verify Phase 1's OAuth callback design and, if needed, add a `POST /auth/exchange` endpoint that accepts a short-lived opaque code and returns a signed JWT.

3. **`SESSION_SECRET` sharing between Go and Next.js**
   - What we know: Go backend signs the JWT. Next.js middleware verifies it with `jose.jwtVerify`.
   - What's unclear: Whether the JWT algorithm and secret format match between Go's `golang-jwt/jwt/v5` (uses HMAC-SHA256 by default) and jose (supports HS256).
   - Recommendation: Both must use HS256 with the same secret. Confirm in the implementation task. Go uses `jwt.SigningMethodHS256`; jose verifies with `algorithms: ["HS256"]`.

---

## Sources

### Primary (HIGH confidence)
- [Next.js Fetching Data docs](https://nextjs.org/docs/app/getting-started/fetching-data) — version 16.2.1, 2026-03-13. Server components, `use()`, SWR pattern, Suspense/loading.js
- [Next.js Authentication guide](https://nextjs.org/docs/app/guides/authentication) — version 16.2.1, 2026-03-03. Session cookies, middleware pattern, DAL, `jose` usage
- [shadcn/ui useCopyToClipboard hook](https://www.shadcn.io/hooks/use-copy-to-clipboard) — official shadcn docs. Returns `[copy, isCopied]`, auto-resets after 2s
- [Vercel Monorepos guide](https://vercel.com/docs/monorepos) — official Vercel docs. Root Directory setting, no workspace config needed for self-contained `/web`
- [SWR with Next.js](https://swr.vercel.app/docs/with-nextjs) — official SWR docs. App Router patterns, server prefetch + client SWR
- [EventSource withCredentials — MDN](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/withCredentials) — browser spec. Cannot send Authorization headers; must use cookies with withCredentials

### Secondary (MEDIUM confidence)
- [Google OAuth 2.0 in Go + React](https://dev.to/arcadebuilds/google-oauth-20-flow-in-golang-and-reactjs-536a) — Go sets httpOnly cookie in callback, redirects to frontend. Pattern verified against Next.js auth guide.
- [SSE in React with useEffect cleanup](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view) — Jan 2026. EventSource creation in useEffect, cleanup on unmount.
- [Next.js environment variables on Vercel](https://www.wisp.blog/blog/managing-nextjs-environment-variables-from-development-to-production-vercel) — NEXT_PUBLIC_ frozen at build time, must redeploy after change.

### Tertiary (LOW confidence — single source, verify during implementation)
- Cross-domain cookie pattern (Go redirects to Next.js with short-lived code, Next.js sets cookie): derived from multiple sources but no single authoritative reference for this exact Quorum topology. Verify during OAuth wiring task.
- `SameSite=Lax` allows OAuth redirect to send cookie on subsequent requests: consistent across sources but verify in actual browser testing with cross-domain Go VPS + Vercel setup.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against Next.js 16.2.1 docs (2026-03-13), SWR official docs, shadcn official
- Architecture patterns: HIGH for data-fetching and SSE; MEDIUM for cross-domain OAuth cookie (derived from patterns, verify in implementation)
- Pitfalls: HIGH — cross-origin SSE auth and cross-domain cookie are well-documented gotchas; confirmed by multiple sources

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (Next.js 16.x stable; SWR 2.3.x stable; OAuth patterns stable)
