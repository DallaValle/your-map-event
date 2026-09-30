import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { MAX_ACTIVITY_DAYS, parseWallClock, toLocalInputValue } from "@/lib/schedule-time";
import { mapViewSchema, NEW_EVENT_MAP_DEFAULTS, poiSchema, uniqueMapSlug } from "@/lib/event-schemas";
import type { McpContext } from "./auth";
import { ToolError } from "./errors";
import {
  crossCheck,
  distanceMeters,
  fitTransform,
  metersPerPixel,
  photoOrientation,
  pixelToLatLng,
  residuals,
  round,
  type Anchor,
  type ImageTransform,
} from "./georef";
import { findStreet, placeAlongPolyline } from "./osm";
import type {
  AddActivitiesInput,
  AddPointsInput,
  CreateEventInput,
  DeletePointsInput,
  EventRefInput,
  PlaceAlongStreetInput,
  Position,
  SetImageAnchorsInput,
  UpdateEventInput,
  UpdatePointInput,
} from "./tools";

export { ToolError };

// Points further than this from the event center are probably misplaced.
const FAR_FROM_CENTER_M = 5_000;
// Leave one out error above this means a landmark was misread.
const ANCHOR_CHECK_LIMIT_M = 15;
const MAX_SPAN_MS = MAX_ACTIVITY_DAYS * 24 * 60 * 60 * 1000;

const coord = (v: number) => Math.round(v * 1e7) / 1e7;
// A 200 point batch is 200 sequential writes; the 5 s default is too tight.
const TX_TIMEOUT_MS = 30_000;

/**
 * Serializes writes per event until the transaction ends, so parallel tool
 * calls or a client retry racing the first call cannot both insert a title.
 */
async function lockEvent(tx: Prisma.TransactionClient, eventId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string } | null)?.code === "P2002";
}

function links(ctx: McpContext, teamSlug: string, event: { id: string; slug: string }) {
  return {
    editorUrl: `${ctx.origin}/dashboard/events/${event.id}`,
    publicUrl: `${ctx.origin}/${teamSlug}/${event.slug}`,
  };
}

/** Team scoping replaces requireAdmin: a token only reaches its own team. */
async function loadEvent(ctx: McpContext, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, teamId: ctx.teamId },
    include: { team: { select: { slug: true } } },
  });
  if (!event) throw new ToolError(`Event ${eventId} not found for this team. Call get_team to list event ids.`);
  return event;
}

function revalidateEvent(teamSlug: string, event: { id: string; slug: string }) {
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/events/${event.id}`);
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/board");
  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/${event.slug}`);
}

function parseWindow(start: string | null | undefined, end: string | null | undefined) {
  const startTime = start ? parseWallClock(start) : null;
  const endTime = end ? parseWallClock(end) : null;
  if (start && !startTime) throw new ToolError(`startTime "${start}" is invalid, use YYYY-MM-DDTHH:mm.`);
  if (end && !endTime) throw new ToolError(`endTime "${end}" is invalid, use YYYY-MM-DDTHH:mm.`);
  if (!!startTime !== !!endTime) throw new ToolError("Set both startTime and endTime, or neither.");
  if (startTime && endTime && endTime <= startTime) throw new ToolError("endTime must be after startTime.");
  return { startTime, endTime };
}

function firstIssue(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const issue = error.issues[0];
  return issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message;
}

async function loadTransform(eventId: string, importId: string | undefined) {
  if (!importId) return null;
  const row = await prisma.mapImport.findFirst({ where: { id: importId, eventId } });
  if (!row) throw new ToolError(`importId ${importId} not found on this event. Call set_image_anchors first.`);
  return row.transform as unknown as ImageTransform;
}

function resolvePosition(p: Position, transform: ImageTransform | null, what: string) {
  if (p.lat !== undefined && p.lng !== undefined) return { lat: p.lat, lng: p.lng };
  if (p.x !== undefined && p.y !== undefined) {
    if (!transform) throw new ToolError(`${what} uses pixel x/y but no importId was given.`);
    const ll = pixelToLatLng(transform, p.x, p.y);
    return { lat: coord(ll.lat), lng: coord(ll.lng) };
  }
  throw new ToolError(`${what} needs either lat and lng, or x and y with an importId.`);
}

// Tools

export async function getTeam(ctx: McpContext) {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: ctx.teamId },
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { pois: true, activities: true } } },
      },
    },
  });
  return {
    team: { name: team.name, slug: team.slug, publicUrl: `${ctx.origin}/${team.slug}` },
    events: team.events.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      published: e.published,
      venue: e.centerName,
      startTime: e.startTime ? toLocalInputValue(e.startTime) : null,
      endTime: e.endTime ? toLocalInputValue(e.endTime) : null,
      points: e._count.pois,
      activities: e._count.activities,
      ...links(ctx, team.slug, e),
    })),
  };
}

export async function createEvent(ctx: McpContext, input: CreateEventInput) {
  const team = await prisma.team.findUniqueOrThrow({ where: { id: ctx.teamId } });
  const view = mapViewSchema.safeParse({
    ...NEW_EVENT_MAP_DEFAULTS,
    centerName: input.venueName,
    centerLat: input.lat,
    centerLng: input.lng,
    zoom: input.zoom,
    mapLayout: input.mapLayout,
  });
  if (!view.success) throw new ToolError(firstIssue(view.error));
  const window = parseWindow(input.startTime, input.endTime);

  // Drafts only: publishing (and the paid checkout, milestone 8) stays a dashboard click.
  const create = async () =>
    prisma.event.create({
      data: {
        teamId: team.id,
        slug: await uniqueMapSlug(team.id, slugify(input.name)),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        ...view.data,
        bearing: view.data.bearing ?? 0,
        ...window,
        published: false,
      },
    });
  // Two parallel creates can pick the same free slug; the loser retries.
  const event = await create().catch((error) => {
    if (isUniqueViolation(error)) return create();
    throw error;
  });
  revalidateEvent(team.slug, event);
  return {
    eventId: event.id,
    slug: event.slug,
    published: false,
    ...links(ctx, team.slug, event),
    next: "Pick 2 to 4 landmarks visible on the photo and call set_image_anchors.",
  };
}

export async function updateEvent(ctx: McpContext, input: UpdateEventInput) {
  const event = await loadEvent(ctx, input.eventId);
  const bounds =
    input.bounds === undefined
      ? {
          boundsSWLat: event.boundsSWLat,
          boundsSWLng: event.boundsSWLng,
          boundsNELat: event.boundsNELat,
          boundsNELng: event.boundsNELng,
        }
      : {
          boundsSWLat: input.bounds?.swLat,
          boundsSWLng: input.bounds?.swLng,
          boundsNELat: input.bounds?.neLat,
          boundsNELng: input.bounds?.neLng,
        };
  const view = mapViewSchema.safeParse({
    centerName: input.centerName ?? event.centerName,
    centerLat: input.centerLat ?? event.centerLat,
    centerLng: input.centerLng ?? event.centerLng,
    zoom: input.zoom ?? event.zoom,
    mapLayout: input.mapLayout ?? event.mapLayout,
    bearing: input.bearing ?? event.bearing,
    ...bounds,
  });
  if (!view.success) throw new ToolError(firstIssue(view.error));

  const window =
    input.startTime === undefined && input.endTime === undefined
      ? {}
      : parseWindow(
          input.startTime === undefined ? toLocalInputValue(event.startTime) : input.startTime,
          input.endTime === undefined ? toLocalInputValue(event.endTime) : input.endTime,
        );

  const name = input.name?.trim();
  if (name !== undefined && (name.length < 2 || name.length > 80)) {
    throw new ToolError("name must be 2 to 80 characters.");
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: {
      ...(name ? { name } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...view.data,
      ...window,
    },
  });
  revalidateEvent(event.team.slug, updated);
  return {
    eventId: updated.id,
    name: updated.name,
    venue: updated.centerName,
    center: { lat: updated.centerLat, lng: updated.centerLng },
    zoom: updated.zoom,
    bearing: updated.bearing,
    mapLayout: updated.mapLayout,
    bounds:
      updated.boundsSWLat === null
        ? null
        : {
            swLat: updated.boundsSWLat,
            swLng: updated.boundsSWLng,
            neLat: updated.boundsNELat,
            neLng: updated.boundsNELng,
          },
    startTime: updated.startTime ? toLocalInputValue(updated.startTime) : null,
    endTime: updated.endTime ? toLocalInputValue(updated.endTime) : null,
    ...links(ctx, event.team.slug, updated),
  };
}

export async function setImageAnchors(ctx: McpContext, input: SetImageAnchorsInput) {
  const event = await loadEvent(ctx, input.eventId);
  const anchors: Anchor[] = input.anchors;
  for (const a of anchors) {
    if (a.x > input.imageWidth || a.y > input.imageHeight) {
      throw new ToolError(`Anchor ${a.label ?? `${a.x},${a.y}`} lies outside the ${input.imageWidth}x${input.imageHeight} image.`);
    }
  }

  let transform: ImageTransform;
  try {
    transform = fitTransform(anchors);
  } catch (error) {
    throw new ToolError(error instanceof Error ? error.message : String(error));
  }

  const row = await prisma.mapImport.create({
    data: {
      eventId: event.id,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
      anchors: anchors as unknown as Prisma.InputJsonValue,
      transform: transform as unknown as Prisma.InputJsonValue,
    },
  });

  const checks = crossCheck(anchors);
  const res = residuals(transform, anchors).map((r, i) => ({
    ...r,
    meters: round(r.meters, 1),
    ...(checks ? { checkMeters: Number.isFinite(checks[i]) ? round(checks[i], 1) : null } : {}),
  }));
  const worstCheck = checks ? Math.max(...checks) : null;
  const suspect = checks && worstCheck! > ANCHOR_CHECK_LIMIT_M ? res[checks.indexOf(worstCheck!)] : null;
  const corners = [
    [0, 0],
    [input.imageWidth, 0],
    [0, input.imageHeight],
    [input.imageWidth, input.imageHeight],
  ].map(([x, y]) => pixelToLatLng(transform, x, y));

  return {
    importId: row.id,
    fit: transform.kind,
    metersPerPixel: round(metersPerPixel(transform), 3),
    residuals: res,
    maxResidualMeters: Math.max(...res.map((r) => r.meters)),
    maxCheckMeters: worstCheck === null ? null : Number.isFinite(worstCheck) ? round(worstCheck, 1) : null,
    quality: checks === null ? "unchecked" : suspect ? "check_anchors" : "good",
    ...photoOrientation(transform),
    photoBounds: {
      swLat: coord(Math.min(...corners.map((c) => c.lat))),
      swLng: coord(Math.min(...corners.map((c) => c.lng))),
      neLat: coord(Math.max(...corners.map((c) => c.lat))),
      neLng: coord(Math.max(...corners.map((c) => c.lng))),
    },
    note:
      checks === null
        ? "Two anchors always fit exactly, so nothing is measured. Add a third anchor far from the others."
        : suspect
          ? `An anchor lands more than ${ANCHOR_CHECK_LIMIT_M} m from where the others predict it (checkMeters). The largest is "${suspect.label ?? "unlabeled"}": re-read or replace it. If every check is high, the anchors are too close together or on one line: spread them out.`
          : `Every anchor lands within ${ANCHOR_CHECK_LIMIT_M} m of where the others predict it.`,
  };
}

export async function addPoints(ctx: McpContext, input: AddPointsInput) {
  const event = await loadEvent(ctx, input.eventId);
  const transform = await loadTransform(event.id, input.importId);

  const rows = input.points.map((p, i) => {
    const pos = resolvePosition(p, transform, `points[${i}]`);
    const parsed = poiSchema.safeParse({ ...p, ...pos, icon: p.icon ?? input.icon });
    if (!parsed.success) throw new ToolError(`points[${i}] ${firstIssue(parsed.error)}`);
    return parsed.data;
  });
  return upsertPoints(event, rows, ctx);
}

type PoiRow = { title: string; description?: string; icon?: string; lat: number; lng: number };

/** Upsert by title within the event so a retried batch never duplicates. */
async function upsertPoints(
  event: Awaited<ReturnType<typeof loadEvent>>,
  rows: PoiRow[],
  ctx: McpContext,
) {
  let created = 0;
  let updated = 0;
  const saved = await prisma.$transaction(
    async (tx) => {
      await lockEvent(tx, event.id);
      const existing = await tx.pointOfInterest.findMany({
        where: { mapId: event.id, title: { in: rows.map((r) => r.title) } },
        orderBy: { createdAt: "asc" },
      });
      const byTitle = new Map<string, string>();
      for (const poi of existing) if (!byTitle.has(poi.title)) byTitle.set(poi.title, poi.id);

      const out = [];
      for (const row of rows) {
        const position = { lat: coord(row.lat), lng: coord(row.lng) };
        const id = byTitle.get(row.title);
        // Updates only touch what was sent: a move keeps edits made in the editor.
        const poi = id
          ? await tx.pointOfInterest.update({
              where: { id },
              data: {
                ...position,
                ...(row.description ? { description: row.description } : {}),
                ...(row.icon ? { icon: row.icon } : {}),
              },
            })
          : await tx.pointOfInterest.create({
              data: {
                mapId: event.id,
                title: row.title,
                description: row.description || null,
                icon: row.icon || null,
                ...position,
              },
            });
        if (id) updated++;
        else created++;
        byTitle.set(row.title, poi.id);
        out.push(poi);
      }
      return out;
    },
    { timeout: TX_TIMEOUT_MS },
  );

  revalidateEvent(event.team.slug, event);
  const center = { lat: event.centerLat, lng: event.centerLng };
  const far = saved.filter((p) => distanceMeters(center, p) > FAR_FROM_CENTER_M).map((p) => p.title);
  return {
    created,
    updated,
    points: saved.map((p) => ({ id: p.id, title: p.title, icon: p.icon, lat: p.lat, lng: p.lng })),
    ...(far.length
      ? { warning: `${far.length} point(s) are more than 5 km from the event center: ${far.slice(0, 10).join(", ")}` }
      : {}),
    editorUrl: links(ctx, event.team.slug, event).editorUrl,
  };
}

export async function placePointsAlongStreet(ctx: McpContext, input: PlaceAlongStreetInput) {
  const event = await loadEvent(ctx, input.eventId);
  const transform = await loadTransform(event.id, input.importId);
  const start = resolvePosition(input.start, transform, "start");
  const end = resolvePosition(input.end, transform, "end");

  let polyline = input.polyline?.map(([lat, lng]) => ({ lat, lng }));
  let streetName = input.streetName ?? null;
  if (!polyline || polyline.length < 2) {
    if (!input.streetName) throw new ToolError("Give either polyline (from find_street) or streetName.");
    const mid = { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 };
    const street = await findStreet(input.streetName, mid, 1000);
    if (!street) {
      throw new ToolError(`No street named "${input.streetName}" within 1 km. Check the spelling or pass a polyline.`);
    }
    polyline = street.polyline.map(([lat, lng]) => ({ lat, lng }));
    streetName = street.name;
  }

  const placed = placeAlongPolyline(
    polyline,
    start,
    end,
    input.points.length,
    input.side,
    input.side === "center" ? 0 : input.offsetMeters,
  );

  const rows = input.points.map((p, i) => {
    const parsed = poiSchema.safeParse({ ...p, icon: p.icon ?? input.icon, ...placed.points[i] });
    if (!parsed.success) throw new ToolError(`points[${i}] ${firstIssue(parsed.error)}`);
    return parsed.data;
  });
  const result = await upsertPoints(event, rows, ctx);
  const snap = Math.max(placed.startSnapMeters, placed.endSnapMeters);
  return {
    street: streetName,
    spanMeters: Math.round(placed.spanMeters),
    spacingMeters: rows.length > 1 ? round(placed.spanMeters / (rows.length - 1), 1) : null,
    startSnapMeters: round(placed.startSnapMeters, 1),
    endSnapMeters: round(placed.endSnapMeters, 1),
    ...(snap > 40
      ? { snapWarning: "Start or end is more than 40 m from the street: check the street name or the anchors." }
      : {}),
    ...result,
  };
}

export async function listPoints(ctx: McpContext, input: EventRefInput) {
  const event = await loadEvent(ctx, input.eventId);
  const pois = await prisma.pointOfInterest.findMany({
    where: { mapId: event.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { activities: true } } },
  });
  return {
    eventId: event.id,
    count: pois.length,
    points: pois.map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      lat: p.lat,
      lng: p.lng,
      ...(p.description ? { description: p.description } : {}),
      ...(p._count.activities ? { activities: p._count.activities } : {}),
    })),
    ...links(ctx, event.team.slug, event),
  };
}

export async function updatePoint(ctx: McpContext, input: UpdatePointInput) {
  const event = await loadEvent(ctx, input.eventId);
  const poi = await prisma.pointOfInterest.findFirst({ where: { id: input.poiId, mapId: event.id } });
  if (!poi) throw new ToolError(`Point ${input.poiId} not found on this event. Call list_points.`);

  const moved = input.lat !== undefined || input.lng !== undefined || input.x !== undefined || input.y !== undefined;
  const pos = moved
    ? resolvePosition(input, await loadTransform(event.id, input.importId), "point")
    : { lat: poi.lat, lng: poi.lng };
  const parsed = poiSchema.safeParse({
    title: input.title ?? poi.title,
    description: input.description ?? poi.description ?? undefined,
    icon: input.icon ?? poi.icon ?? undefined,
    ...pos,
  });
  if (!parsed.success) throw new ToolError(firstIssue(parsed.error));

  const saved = await prisma.pointOfInterest.update({
    where: { id: poi.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      icon: parsed.data.icon || null,
      lat: coord(parsed.data.lat),
      lng: coord(parsed.data.lng),
    },
  });
  revalidateEvent(event.team.slug, event);
  return { id: saved.id, title: saved.title, icon: saved.icon, lat: saved.lat, lng: saved.lng };
}

export async function deletePoints(ctx: McpContext, input: DeletePointsInput) {
  const event = await loadEvent(ctx, input.eventId);
  const { count } = await prisma.pointOfInterest.deleteMany({
    where: { mapId: event.id, id: { in: input.poiIds } },
  });
  revalidateEvent(event.team.slug, event);
  return { deleted: count, notFound: input.poiIds.length - count };
}

export async function addActivities(ctx: McpContext, input: AddActivitiesInput) {
  const event = await loadEvent(ctx, input.eventId);
  const pois = await prisma.pointOfInterest.findMany({
    where: { mapId: event.id },
    select: { id: true, title: true },
  });

  // Exact title first, then a unique prefix ("GS" matches "GS. Gara del Salame").
  const findPoi = (wanted: string) => {
    const w = wanted.trim().toLowerCase();
    const exact = pois.find((p) => p.title.toLowerCase() === w);
    if (exact) return exact;
    const prefixed = pois.filter((p) => p.title.toLowerCase().startsWith(w));
    return prefixed.length === 1 ? prefixed[0] : null;
  };

  const warnings: string[] = [];
  const rows = input.activities.map((a, i) => {
    const window = parseWindowFor(a.startTime, a.endTime, `activities[${i}]`);
    let poiId: string | null = null;
    if (a.poiTitle) {
      const poi = findPoi(a.poiTitle);
      if (poi) poiId = poi.id;
      else warnings.push(`activities[${i}] "${a.name}": no single point matches "${a.poiTitle}", saved without a location.`);
    }
    return { name: a.name.trim(), type: a.type, poiId, ...window };
  });

  let created = 0;
  let skipped = 0;
  const saved = await prisma.$transaction(
    async (tx) => {
      await lockEvent(tx, event.id);
      const out = [];
      for (const row of rows) {
        // Same name, time and place already there: a retry, not a new act.
        const dup = await tx.activity.findFirst({
          where: { eventId: event.id, name: row.name, startTime: row.startTime, poiId: row.poiId },
        });
        if (dup) {
          skipped++;
          out.push(dup);
          continue;
        }
        out.push(await tx.activity.create({ data: { eventId: event.id, ...row } }));
        created++;
      }
      return out;
    },
    { timeout: TX_TIMEOUT_MS },
  );

  revalidateEvent(event.team.slug, event);
  return {
    created,
    skipped,
    activities: saved.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      startTime: a.startTime ? toLocalInputValue(a.startTime) : null,
      endTime: a.endTime ? toLocalInputValue(a.endTime) : null,
      poiId: a.poiId,
    })),
    ...(warnings.length ? { warnings } : {}),
    scheduleUrl: `${ctx.origin}/dashboard/schedule`,
  };
}

function parseWindowFor(start: string | undefined, end: string | undefined, what: string) {
  try {
    const window = parseWindow(start, end);
    if (window.startTime && window.endTime && window.endTime.getTime() - window.startTime.getTime() > MAX_SPAN_MS) {
      throw new ToolError(`An activity cannot run longer than ${MAX_ACTIVITY_DAYS} days.`);
    }
    return window;
  } catch (error) {
    throw new ToolError(`${what}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
