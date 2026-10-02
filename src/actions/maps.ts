"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ACTIVE_EVENT_COOKIE } from "@/lib/active-event";
import { slugify, validateMapSlug } from "@/lib/slug";
import {
  mapViewSchema,
  NEW_EVENT_MAP_DEFAULTS,
  uniqueMapSlug,
} from "@/lib/event-schemas";
import { parseWallClock } from "@/lib/schedule-time";
import { fail } from "@/i18n/action-errors";
import type { ActionState } from "./types";

const eventInfoSchema = z.object({
  name: z.string().trim().min(2, "Event name must be at least 2 characters").max(80),
  subtitle: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  logoUrl: z.union([z.url(), z.literal("")]).nullish(),
});

function parseMapViewForm(formData: FormData) {
  return mapViewSchema.safeParse({
    centerName: formData.get("centerName"),
    centerLat: formData.get("centerLat"),
    centerLng: formData.get("centerLng"),
    zoom: formData.get("zoom") || undefined,
    mapLayout: formData.get("mapLayout") || undefined,
    bearing: formData.get("bearing"),
    boundsSWLat: formData.get("boundsSWLat"),
    boundsSWLng: formData.get("boundsSWLng"),
    boundsNELat: formData.get("boundsNELat"),
    boundsNELng: formData.get("boundsNELng"),
  });
}

/** Revalidate every view a map change can affect. */
async function revalidateMap(teamSlug: string, mapId?: string, mapSlug?: string) {
  revalidatePath("/dashboard");
  if (mapId) revalidatePath(`/dashboard/events/${mapId}`);
  revalidatePath(`/${teamSlug}`);
  if (mapSlug) revalidatePath(`/${teamSlug}/${mapSlug}`);
}

/**
 * Create an event after the (currently mock) checkout step.
 * Only the name is collected at create time; location/zoom/POIs come later
 * in the map editor. Lands on the dashboard overview with this event active.
 */
export async function createMapAction(
  teamId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { team } = await requireAdmin(teamId);

  // Mock checkout gate: the client only submits this after the pay step.
  // Swap for a real Stripe session / webhook check when payments go live.
  if (formData.get("paymentConfirmed") !== "1") {
    return fail("Payment is required before creating an event.");
  }

  const info = eventInfoSchema.safeParse({
    name: formData.get("name"),
  });
  if (!info.success) {
    return fail(info.error.issues[0].message);
  }

  const map = await prisma.event.create({
    data: {
      teamId: team.id,
      slug: await uniqueMapSlug(team.id, slugify(info.data.name)),
      name: info.data.name,
      ...NEW_EVENT_MAP_DEFAULTS,
    },
  });

  // Newly created event becomes the dashboard's selected event.
  (await cookies()).set(ACTIVE_EVENT_COOKIE, map.id, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  await revalidateMap(team.slug);
  redirect("/dashboard");
}

/**
 * Basic event info (name, subtitle, logo, public address, description) — edited on the
 * dashboard's Event page, not in the map editor.
 */
export async function updateEventInfoAction(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return fail("Event not found");
  const { team } = await requireAdmin(event.teamId);

  const parsed = eventInfoSchema.safeParse({
    name: formData.get("name"),
    subtitle: formData.get("subtitle") || undefined,
    description: formData.get("description") || undefined,
    logoUrl: formData.get("logoUrl"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0].message);
  }

  // Optional public-address change (URL segment under the team).
  let slug = event.slug;
  const requestedSlug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (requestedSlug && requestedSlug !== event.slug) {
    const slugError = validateMapSlug(requestedSlug);
    if (slugError) return fail(slugError);
    const clash = await prisma.event.findUnique({
      where: { teamId_slug: { teamId: team.id, slug: requestedSlug } },
    });
    if (clash && clash.id !== eventId) {
      return fail(`"/${team.slug}/${requestedSlug}" is already taken.`);
    }
    slug = requestedSlug;
  }

  const startRaw = formData.get("startTime");
  const endRaw = formData.get("endTime");
  const startTime = startRaw ? parseWallClock(startRaw) : null;
  const endTime = endRaw ? parseWallClock(endRaw) : null;
  if (startRaw && !startTime) return fail("Event start is invalid");
  if (endRaw && !endTime) return fail("Event end is invalid");
  if ((startTime && !endTime) || (!startTime && endTime)) {
    return fail("Set both event start and end, or leave both empty.");
  }
  if (startTime && endTime && endTime.getTime() <= startTime.getTime()) {
    return fail("Event end must be after start");
  }

  const { name, subtitle, description, logoUrl } = parsed.data;
  await prisma.event.update({
    where: { id: eventId },
    data: {
      name,
      subtitle: subtitle || null,
      description: description ?? null,
      logoUrl: logoUrl || null,
      slug,
      startTime,
      endTime,
    },
  });

  await revalidateMap(team.slug, eventId);
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/board");
  revalidatePath(`/${team.slug}/${event.slug}`);
  revalidatePath(`/${team.slug}/${slug}`);
  return { ok: true };
}

/**
 * The event's map view (location, zoom, rotation, borders) — auto-saved by
 * the map editor.
 */
export async function updateMapViewAction(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return fail("Event not found");
  const { team } = await requireAdmin(event.teamId);

  const parsed = parseMapViewForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0].message);
  }

  await prisma.event.update({
    where: { id: eventId },
    data: parsed.data,
  });

  await revalidateMap(team.slug, eventId, event.slug);
  return { ok: true };
}

export async function setMapPublishedAction(
  mapId: string,
  published: boolean,
): Promise<ActionState> {
  const map = await prisma.event.findUnique({ where: { id: mapId } });
  if (!map) return fail("Map not found");
  const { team } = await requireAdmin(map.teamId);

  await prisma.event.update({ where: { id: mapId }, data: { published } });

  await revalidateMap(team.slug, mapId, map.slug);
  return { ok: true };
}

export async function deleteMapAction(mapId: string): Promise<ActionState> {
  const map = await prisma.event.findUnique({ where: { id: mapId } });
  if (!map) return fail("Map not found");
  const { team } = await requireAdmin(map.teamId);

  // POIs cascade via the schema's onDelete: Cascade.
  await prisma.event.delete({ where: { id: mapId } });

  await revalidateMap(team.slug, undefined, map.slug);
  redirect("/dashboard");
}
