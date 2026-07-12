"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import type { ActionState } from "./types";

const mapSchema = z.object({
  name: z.string().trim().min(2, "Map name must be at least 2 characters").max(80),
  description: z.string().trim().max(500).optional(),
  centerName: z.string().trim().min(1, "Give the event location a name").max(80),
  centerLat: z.coerce.number().min(-90).max(90),
  centerLng: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().int().min(3).max(19).default(16),
});

function parseMapForm(formData: FormData) {
  return mapSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    centerName: formData.get("centerName"),
    centerLat: formData.get("centerLat"),
    centerLng: formData.get("centerLng"),
    zoom: formData.get("zoom") || undefined,
  });
}

/** Revalidate every view a map change can affect. */
async function revalidateMap(teamSlug: string, mapId?: string) {
  revalidatePath("/dashboard");
  if (mapId) revalidatePath(`/dashboard/maps/${mapId}`);
  revalidatePath(`/${teamSlug}`);
}

export async function createMapAction(
  teamId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { team } = await requireAdmin(teamId);

  const parsed = parseMapForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const map = await prisma.eventMap.create({
    data: { teamId: team.id, ...parsed.data },
  });

  await revalidateMap(team.slug);
  redirect(`/dashboard/maps/${map.id}`);
}

export async function updateMapAction(
  mapId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const map = await prisma.eventMap.findUnique({ where: { id: mapId } });
  if (!map) return { ok: false, error: "Map not found" };
  const { team } = await requireAdmin(map.teamId);

  const parsed = parseMapForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.eventMap.update({ where: { id: mapId }, data: parsed.data });

  await revalidateMap(team.slug, mapId);
  return { ok: true };
}

export async function setMapPublishedAction(
  mapId: string,
  published: boolean,
): Promise<ActionState> {
  const map = await prisma.eventMap.findUnique({ where: { id: mapId } });
  if (!map) return { ok: false, error: "Map not found" };
  const { team } = await requireAdmin(map.teamId);

  await prisma.eventMap.update({ where: { id: mapId }, data: { published } });

  await revalidateMap(team.slug, mapId);
  return { ok: true };
}

export async function deleteMapAction(mapId: string): Promise<ActionState> {
  const map = await prisma.eventMap.findUnique({ where: { id: mapId } });
  if (!map) return { ok: false, error: "Map not found" };
  const { team } = await requireAdmin(map.teamId);

  // POIs cascade via the schema's onDelete: Cascade.
  await prisma.eventMap.delete({ where: { id: mapId } });

  await revalidateMap(team.slug);
  redirect("/dashboard");
}
