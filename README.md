# Your Map Event

**A desktop web app for running live events in cities.** A team creates an
event, curates its interactive map (central location + points of interest with
photos), and publishes it. Attendees open `https://your-domain/<team-slug>` on
their phone to see the map, browse points of interest, and track their own live
position. The organizer works from a desktop dashboard; attendees get a
mobile-first PWA. One event, one map, one link.

## What you manage

The dashboard is the operations console for a live event, and it operates on
**one selected event at a time**. The management chrome is constant on every
screen: a slim **header** (the `your map event` wordmark top-left, sign in /
sign out top-right), a **footer** with the same wordmark, and a **left
sidebar**. At the top of the sidebar sits the **event switcher** - a compact
dropdown to change the selected event (rare, but a team may run two events or
keep a draft next to the live edition) and to create a new one. Below it, the
selected event's sections, then the workspace pages:

| Section | What it's for |
|---|---|
| **Event** | The selected event's home: basic info (name, public address, description), publish toggle, share tools, and the door into the map editor. Built today. |
| **Notifications** | Broadcast live announcements to attendees during the event (schedule changes, weather, "gates closing in 10 min"). *Planned.* |
| **Board** | A shared program / agenda board - line-ups, session times, the running order the whole team edits together. *Planned.* |
| **Social campaign** | Plan and schedule the event's social posts, and generate share assets (QR codes, cards) from the published map. *Planned.* |
| **History** | Post-event archive and analytics - attendance, most-visited points of interest, past editions. *Planned.* |
| **Team** | Team profile (name, logo, public address) and collaboration: invite teammates by email as Admin or Viewer via a shareable invite link. Admins only. Built today. |
| **Settings** | Personal user settings. *Planned.* |

The planned sections are placeholders for now: each renders a short
description of what will live there, so the shape of the product is visible
before the features exist.

Two screens intentionally escape the console chrome: the **map editor** (a
full-screen immersive surface with its own header) and the **new event** flow.

## The business - user flow

**Who it's for:** anyone running a physical event on a site attendees don't
know by heart - festivals, fairs, conferences, sports events, campuses. The
organizer curates one interactive map per event; attendees need nothing but the
link.

### 1. Organizer (Admin) sets up

1. **Sign up & create a team** - the team gets a public address
   (`/your-team-slug`) and a profile (name + logo) shown on the map.
2. **Create an event** - search for the venue by name/address (OpenStreetMap
   search), click the map to pin the exact event center, and name it (e.g.
   "Landiwiese, Zürich"). The event owns this map and all the information
   attached to it.
3. **Frame the map** - optionally capture the current view as the map's
   *borders* (fine-tuned by dragging corner handles): attendees can't pan
   outside the event area. Rotate the map and save the angle so "up" matches
   the venue layout.
4. **Add points of interest** - click anywhere on the editor map to drop a
   point (or use the ＋ button to type exact coordinates). Each point has a
   title, optional description and photo. Everything is editable and deletable
   from the map or the points list.
5. **Publish** - one click flips the event's map live at `/your-team-slug`.

### 2. Team members (Viewers)

Invited teammates with the Viewer role can sign in and see the published events
exactly as attendees do - but can't change anything. Only Admins edit.

### 3. Attendees (no account)

1. Open `https://your-domain/your-team-slug` on their phone - during the
   event typically via a QR code on posters/badges.
2. See the full-screen event map with all points of interest (clustered when
   dense), the team's branding, and, after accepting the browser prompt,
   their **own live position** with an accuracy circle.
3. Tap the always-visible **points list** to browse everything; picking a
   point flies the map there and opens its details (photo + description).
4. Install it as an app (PWA) if they like; map areas they've viewed keep
   working even when the venue Wi-Fi drops.

## Data model

The core relation is deliberately simple:

```
Team ──< Event ──< PointOfInterest
             │
             └── one map (center, zoom, bearing, viewing borders) inlined on the event
```

- A **Team** is the public-facing profile of a Better Auth organization (name,
  logo, `/team-slug`). It owns many events.
- An **Event** is the top-level unit of work. It owns exactly **one map** - the
  map fields (center, zoom, bearing, optional borders) live directly on the
  event row, since it's a 1:1 relationship - plus all the information attached
  to the event (points of interest today; notifications, board, campaign
  later). Publishing an event puts its map online.
- A **PointOfInterest** belongs to one event.

> Implementation note: the `Event` model is stored in the `EventMap` table
> (`@@map`) - the table predates the rename and the mapping keeps the migration
> non-destructive. Code always talks to `prisma.event`.

## Business model

**Pay per event.** Creating a team and exploring the dashboard is free;
publishing an event's map to a public link is the paid action (billed per
published event, with future tiers for attendee volume or add-on sections like
notifications and social campaigns). Nothing is wired to a payment provider
yet - this section records the intended model.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.5 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4 |
| Auth + teams | [Better Auth](https://better-auth.com) with the organization plugin (roles: Admin = `owner`/`admin`, Viewer = `member`) |
| Database | PostgreSQL (Docker locally) + Prisma 6 |
| Maps | Leaflet 1.9 + react-leaflet 5 + react-leaflet-cluster, OpenStreetMap tiles |
| Uploads | UploadThing v7 (optional — falls back to URL inputs without a token) |
| PWA | Serwist 9 (service worker, offline fallback, opportunistic tile caching) |

## Quick start

Requirements: Node 20.13+, Docker Desktop.

```bash
npm install
docker compose up -d          # local Postgres on :5432
cp .env.example .env          # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npx prisma migrate dev        # create tables
npx prisma db seed            # demo team + festival map with 10 POIs
npm run dev
```

Open http://localhost:3000:

- **Admin:** sign in with `admin@test.com` / `password`
- **Viewer:** `view@test.com` / `password`
- **Public map:** http://localhost:3000/demo-team (no login needed)

The dev accounts are re-created on every server start by
`src/instrumentation.ts` — see "Auth storage" below for why.

## Auth storage: in-memory now, Postgres later

`AUTH_STORAGE` in `.env` picks the Better Auth adapter in `src/lib/auth.ts`:

- `memory` (default): users, organizations and sessions live in-process and
  **reset on every restart**. Great for instant local hacking — the
  instrumentation hook re-seeds `admin@test.com`, recreates the demo
  organization, and re-links the `Team.orgId` column in Postgres on each boot.
- `postgres`: persist auth in the same database via Prisma. To switch:
  1. `npx @better-auth/cli generate` — appends the Better Auth models
     (User, Session, Account, Verification, Organization, Member, Invitation)
     to `prisma/schema.prisma`.
  2. `npx prisma migrate dev --name auth`
  3. Set `AUTH_STORAGE="postgres"` and restart.

App data (teams, events, POIs) always lives in Postgres; `Team.orgId` is a plain
string reference to the Better Auth organization (no DB-level foreign key, so
the two storages can be switched independently).

## Roles

| | Admin (`owner`/`admin`) | Viewer (`member`) |
|---|---|---|
| Open published events | ✅ | ✅ |
| Create/edit events, maps & POIs | ✅ | ❌ |
| Team profile, logo, slug | ✅ | ❌ |

Enforcement is layered: `src/middleware.ts` only checks cookie *presence*
(optimistic, edge-safe); `dashboard/layout.tsx` validates the session; and
every mutating server action calls `requireAdmin()` (`src/lib/session.ts`),
which verifies session → team → membership → role on the server.

## Leaflet in Next.js — the rules this repo follows

1. **Never import Leaflet into server-rendered code.** Leaflet touches
   `window` at import time. All map code lives in `src/components/map/`, and
   only `MapCanvas.tsx` — a client component — may `dynamic(() => import(...),
   { ssr: false })` it. (In Next 15, `ssr: false` is forbidden in Server
   Components, so the dynamic import *must* sit inside a client component.)
2. **Default marker icons** break under bundlers; `leaflet-icon-fix.ts`
   re-points them at bundler-resolved PNGs.
3. **Tiles:** the canonical `tile.openstreetmap.org` host (the `{s}.`
   subdomains are deprecated) with mandatory attribution.
4. **Popups use plain `<img>`** — `next/image` fights Leaflet's popup
   size measurement.
5. **Clustering** via `react-leaflet-cluster` with `chunkedLoading` to keep
   the main thread responsive with hundreds of markers.

## PWA & offline

- `src/app/manifest.ts` + icons in `public/icons/` make the app installable.
- `src/app/sw.ts` (Serwist) precaches app assets, serves `/~offline` for
  uncached navigations, and runtime-caches **map tiles the user actually
  viewed** (CacheFirst, max 250 tiles / 30 days) plus remote images.
- Serwist runs in the **webpack production build only** (`npm run build`);
  `next dev` uses Turbopack, where the SW is disabled by design. Don't change
  the build script to `next build --turbopack`.
- **OSM tile policy:** opportunistic caching like this is fine; bulk
  prefetching is not. If the app grows real traffic, switch the tile URL to a
  commercial provider (MapTiler, Thunderforest, …) — OSM's servers are
  donated infrastructure.

## Image uploads

Without `UPLOADTHING_TOKEN`, logo/POI image fields render as plain URL inputs
— the app is fully usable. To enable real uploads, create an app at
[uploadthing.com](https://uploadthing.com), put its token in `.env`, and the
same fields become upload buttons (routes: `teamLogo` 2 MB, `poiImage` 4 MB,
admins only — see `src/app/api/uploadthing/core.ts`).

## Deploying to Vercel

Two prerequisites make the deploy actually functional, then CI ships it.

### 1. Production database (Neon)

Create a Postgres database (e.g. [Neon](https://neon.tech)) and keep its
connection string — it becomes `DATABASE_URL` in Vercel and in GitHub secrets.

### 2. Switch auth to Postgres (required for serverless)

In-memory auth loses every session on cold start, so production must persist
auth in Postgres:

```bash
npx @better-auth/cli generate   # appends User/Session/Account/… models to schema.prisma
npx prisma migrate dev --name auth
```

Then set `AUTH_STORAGE=postgres` in the Vercel env (below). Local dev can stay
on `memory` — the adapter is chosen at runtime from `AUTH_STORAGE`.

### 3. Configure Vercel + deploy via GitHub Actions

The workflow at `.github/workflows/deploy-vercel.yml` deploys on every push to
`main` (production, runs `prisma migrate deploy` first) and on every PR
(preview URL). To wire it up:

1. Create the Vercel project once and link it locally to get its IDs:
   ```bash
   npm i -g vercel && vercel link      # writes .vercel/project.json
   cat .vercel/project.json            # -> orgId, projectId
   ```
2. In **Vercel → Project → Settings → Environment Variables**, set:
   `DATABASE_URL`, `AUTH_STORAGE=postgres`, `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL=https://your-domain`, `UPLOADTHING_TOKEN` (optional), and
   the Google OAuth pair (optional; redirect URI
   `https://your-domain/api/auth/callback/google`).
3. In **GitHub → repo → Settings → Secrets and variables → Actions**, add two
   secrets: `VERCEL_TOKEN` (Vercel → Account Settings → Tokens) and
   `DATABASE_URL` (your Neon string — the migration step uses it). The org and
   project IDs live in the workflow file (they're identifiers, not credentials).
4. Push to `main`. The Action builds (`prisma generate` runs via `postinstall`;
   `next build` emits the service worker), migrates, and deploys.

> This repo uses the GitHub Action (not Vercel's native Git integration) so
> deploys are gated on the build passing and `prisma migrate deploy` runs in
> the same pipeline. The Vercel Git connection is intentionally disconnected
> (`vercel git disconnect`) so only the Action deploys — no double deploys.

Custom domains per team: point the domain at Vercel and rewrite to
`/<team-slug>` in `next.config.ts` or a middleware host check.

## Project layout

```
src/
├── app/
│   ├── [teamSlug]/          # public attendee map (SEO via generateMetadata)
│   ├── dashboard/           # admin/viewer console (events + sections, editor, team)
│   ├── (auth)/              # sign-in / sign-up
│   ├── api/auth/[...all]/   # Better Auth handler
│   ├── api/uploadthing/     # upload routes
│   ├── manifest.ts | sw.ts | ~offline/
├── actions/                 # server actions (all mutations; zod + requireAdmin)
├── components/
│   ├── map/                 # ALL Leaflet code (client-only, behind MapCanvas)
│   ├── map-editor/          # editor UI (no Leaflet imports)
│   └── ...
├── lib/                     # auth, prisma, session helpers, slug rules
├── instrumentation.ts       # dev seed for in-memory auth
└── middleware.ts            # optimistic /dashboard gate
```
