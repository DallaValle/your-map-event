"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import type { ActionState } from "./types";

const poiSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(80),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.union([z.url(), z.literal("")]).nullish(),
  // Emoji for the marker; a couple of code points at most.
  icon: z.string().trim().max(8).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

function parsePoiForm(formData: FormData) {
  return poiSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    imageUrl: formData.get("imageUrl"),
    icon: formData.get("icon") || undefined,
    lat: formData.get("lat"),
    lng: formData.get("lng"),
  });
}

/** Resolve the POI's map and verify the caller administers its team. */
async function requirePoiAdmin(mapId: string) {
  const map = await prisma.eventMap.findUnique({ where: { id: mapId } });
  if (!map) throw new Error("Map not found");
  const { team } = await requireAdmin(map.teamId);
  return { map, team };
}

function revalidatePoi(teamSlug: string, mapId: string, mapSlug: string) {
  revalidatePath(`/dashboard/maps/${mapId}`);
  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/${mapSlug}`);
}

export async function createPoiAction(
  mapId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let team, map;
  try {
    ({ team, map } = await requirePoiAdmin(mapId));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" };
  }

  const parsed = parsePoiForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { imageUrl, icon, ...rest } = parsed.data;

  await prisma.pointOfInterest.create({
    data: { mapId, ...rest, imageUrl: imageUrl || null, icon: icon || null },
  });

  revalidatePoi(team.slug, mapId, map.slug);
  return { ok: true };
}

export async function updatePoiAction(
  poiId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poi = await prisma.pointOfInterest.findUnique({ where: { id: poiId } });
  if (!poi) return { ok: false, error: "Point of interest not found" };

  let team, map;
  try {
    ({ team, map } = await requirePoiAdmin(poi.mapId));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" };
  }

  const parsed = parsePoiForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { imageUrl, icon, ...rest } = parsed.data;

  await prisma.pointOfInterest.update({
    where: { id: poiId },
    data: { ...rest, imageUrl: imageUrl || null, icon: icon || null },
  });

  revalidatePoi(team.slug, poi.mapId, map.slug);
  return { ok: true };
}

export async function deletePoiAction(poiId: string): Promise<ActionState> {
  const poi = await prisma.pointOfInterest.findUnique({ where: { id: poiId } });
  if (!poi) return { ok: false, error: "Point of interest not found" };

  let team, map;
  try {
    ({ team, map } = await requirePoiAdmin(poi.mapId));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" };
  }

  await prisma.pointOfInterest.delete({ where: { id: poiId } });

  revalidatePoi(team.slug, poi.mapId, map.slug);
  return { ok: true };
}
