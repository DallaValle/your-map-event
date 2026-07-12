# Your Map Event

Mobile-first PWA for interactive event maps. Teams build a map of their event
(central location + points of interest with photos), publish it, and attendees
open `https://your-domain/<team-slug>` on their phone to see the map, search
points of interest, and track their own live position.

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

App data (teams, maps, POIs) always lives in Postgres; `Team.orgId` is a plain
string reference to the Better Auth organization (no DB-level foreign key, so
the two storages can be switched independently).

## Roles

| | Admin (`owner`/`admin`) | Viewer (`member`) |
|---|---|---|
| Open published maps | ✅ | ✅ |
| Create/edit maps & POIs | ✅ | ❌ |
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

1. Move Postgres to a managed provider (e.g. [Neon](https://neon.tech)) and
   set `DATABASE_URL` accordingly; run `npx prisma migrate deploy` in CI or
   locally against it.
2. Switch auth to Postgres (see "Auth storage") — in-memory auth on
   serverless would lose sessions on every cold start.
3. Set env vars in Vercel: `DATABASE_URL`, `AUTH_STORAGE=postgres`,
   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://your-domain`,
   `UPLOADTHING_TOKEN`, and (optionally) the Google OAuth pair with redirect
   URI `https://your-domain/api/auth/callback/google`.
4. `vercel deploy` (or connect the Git repo). The build command is the default
   `npm run build`, which also emits the service worker.
5. Custom domains per team: point the domain at Vercel and rewrite to
   `/<team-slug>` in `next.config.ts` or a middleware host check.

## Project layout

```
src/
├── app/
│   ├── [teamSlug]/          # public attendee map (SEO via generateMetadata)
│   ├── dashboard/           # admin/viewer area (maps list, editor, team)
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
