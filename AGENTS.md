# Your Map Event - how we work

This file is the project memory.
Follow it on every change.

It overrides the global "do not branch / commit / push unless asked" rule for this repo.

## Loop

1. Pick one open [GitHub milestone](https://github.com/DallaValle/your-map-event/milestones).
2. Work on a branch off latest `main`. Never commit on `main`.
3. Push the branch and open a PR. Do not merge. Sergio reviews.
4. Every PR is tied to exactly one milestone.

If you find uncommitted work on `main`, move it onto that milestone's branch before touching anything else.

## Herdr

Parallel work follows the global Herdr rules.
Repo specifics:

- Workspace `your-map-event` (`w4`). The coordinator pane `w4:p1` stays on the main checkout.
- Worktrees live under `/Users/sergiodallavalle/Documents/code/.worktrees/your-map-event/`, one per milestone.
- Tab, agent, worktree and branch share the milestone name (`m2-settings`).
- Do not run the UI agent in parallel with feature agents that still need the token system.

## Branches

Name: `m<n>-<short-slug>` (example: `m0-map-layout`, `m1-ui-theme`).

One concern per branch.
If the work is not the current milestone, start a new branch from `main`.

## Parallelism

One milestone owns one dashboard page (or a tight pair that share a model) plus its Prisma models, server actions, components, and e2e file.

Two people can work at the same time only when their milestones do not share a page or a model.

| Milestone | Owns | Do not touch |
|---|---|---|
| 0 Map core | `src/components/map/`, `src/components/map-editor/`, Event map fields, public map, `src/app/sw.ts`, `e2e/map-*.spec.ts` | Feature sections |
| 1 UI theme | `src/app/globals.css`, root layout theme, shared visual primitives | Feature behavior, Prisma models |
| 2 Settings | `src/app/dashboard/(console)/settings/`, `src/components/settings/`, user prefs | Team or event models |
| 3 Schedule + Board | `board/` + `schedule/`, their program/session models and actions | Other sections' models |
| 4 Notifications | `notifications/`, Notification model, header bell badge | Rewriting the public map |
| 5 Social | `social/`, campaign models, share assets beyond `ShareCard` | Pricing, analytics |
| 6 Analytics | `analytics/`, metrics models | History archive UI |
| 7 History | `history/`, archive/snapshot models | Live event editing |
| 8 Pricing | `events/new/`, checkout | Map editor |
| 9 Production | Auth storage, deploy, env | Product features |
| 10 MCP | `src/app/api/mcp/`, `src/lib/mcp/`, `src/components/mcp/`, `dashboard/(console)/ai/`, McpToken + MapImport models, `e2e/mcp.spec.ts` | Map editor UI, public map |

New feature code lives under that section's app route and `src/components/<section>/`.
Do not add a feature's models as extra columns on `Event` unless the field is 1:1 map data (center, zoom, bearing, bounds, layout).

### Shared files

Edit these only when your milestone cannot land without them, and keep the diff additive:

- `prisma/schema.prisma` - append your models. Do not reformat or rewrite someone else's.
- `src/components/nav/SideNav.tsx` - point your item at the real page. Do not restyle the nav (that is milestone 1).
- Public map (`src/components/map/PublicMap.tsx`, `src/app/[teamSlug]/`) - add a slot or optional prop. Do not rewrite the map.
- `src/lib/session.ts`, `src/lib/auth.ts` - leave unless the milestone is auth.

Milestone 1 may change classes across the app, but not behavior.
Land it before parallel feature work when a visual system is still missing.

## PRs

Open with `gh pr create` against `main`.
Set the GitHub milestone on the PR.
Do not merge, rebase onto `main` unless asked, or add agent attribution.

### Description

Precise, short, important things only:

```md
## Summary
- What a reviewer must know (3-5 bullets). No walkthrough of the diff.

## Milestone
https://github.com/DallaValle/your-map-event/milestone/<n>

## Database
- Migration: yes (`prisma/migrations/<name>/`) | no
- Preview: works | will break

## Test plan
- e2e: `e2e/<name>.spec.ts`
- What to click on the preview
```

Every PR must say whether it includes a Prisma migration and whether the Vercel preview will work.
Preview deploys do **not** run `prisma migrate deploy`. Only a merge to `main` does.
Preview and production share the same Neon database, so a PR that reads a new column or table will break on the preview URL until that migration has already run in production.
If there is no migration, write `Migration: no` and `Preview: works`.
If there is a migration, name the folder and say `Preview: will break` unless the column/table already exists on Neon.

Commits stay Conventional Commits (`feat(map): …`, `fix(settings): …`, `test(board): …`).

## E2E

A PR that changes a user-visible flow must add or update Playwright coverage under `e2e/`.
One spec file per section (`e2e/settings.spec.ts`, `e2e/notifications.spec.ts`).
Reuse `e2e/helpers.ts`.
Do not make the suite parallel: tests share one database (`workers: 1`).

Run the specs that match the PR:

```bash
npm run test:e2e -- e2e/<name>.spec.ts
```

Cover the happy path the way an organizer or attendee actually clicks.
If the UI looks off while you are there, fix it in this PR only when it sits on files you already own.

## Product shape

README is the product spec.
Dashboard sections that are not built yet stay on `SectionPlaceholder` until their milestone starts.
The Leaflet rule in the README still holds: never import Leaflet from server code.
