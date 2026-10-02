"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { categorySchema, markerStyleSchema } from "@/lib/event-schemas";
import { createSuggestedCategories } from "@/lib/categories";
import type { ActionState } from "./types";

/** Resolve the event and verify the caller administers its team. */
async function requireEventAdmin(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  const { team } = await requireAdmin(event.teamId);
  return { event, team };
}

function revalidateMap(teamSlug: string, event: { id: string; slug: string }) {
  revalidatePath(`/dashboard/events/${event.id}`);
  revalidatePath(`/${teamSlug}`);
  revalidatePath(`/${teamSlug}/${event.slug}`);
}

async function guarded(eventId: string, run: (ctx: Awaited<ReturnType<typeof requireEventAdmin>>) => Promise<ActionState>) {
  let ctx;
  try {
    ctx = await requireEventAdmin(eventId);
  } catch (error) {
    // A sign in redirect must reach the browser, not show up as an error message.
    unstable_rethrow(error);
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" } as ActionState;
  }
  const result = await run(ctx);
  if (result?.ok) revalidateMap(ctx.team.slug, ctx.event);
  return result;
}

export async function updateMarkerStyleAction(
  eventId: string,
  input: { markerLabel: string; markerColor: string | null },
): Promise<ActionState> {
  return guarded(eventId, async ({ event }) => {
    const parsed = markerStyleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    await prisma.event.update({ where: { id: event.id }, data: parsed.data });
    return { ok: true };
  });
}

export async function createCategoryAction(
  eventId: string,
  input: { name: string; icon: string; color: string },
): Promise<ActionState> {
  return guarded(eventId, async ({ event }) => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const last = await prisma.poiCategory.aggregate({
      where: { eventId: event.id },
      _max: { position: true },
    });
    await prisma.poiCategory.create({
      data: { eventId: event.id, ...parsed.data, position: (last._max.position ?? -1) + 1 },
    });
    return { ok: true };
  });
}

export async function updateCategoryAction(
  categoryId: string,
  input: { name: string; icon: string; color: string },
): Promise<ActionState> {
  const category = await prisma.poiCategory.findUnique({ where: { id: categoryId } });
  if (!category) return { ok: false, error: "Category not found" };
  return guarded(category.eventId, async () => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    await prisma.poiCategory.update({ where: { id: categoryId }, data: parsed.data });
    return { ok: true };
  });
}

/** Its points stay on the map, just without a category. */
export async function deleteCategoryAction(categoryId: string): Promise<ActionState> {
  const category = await prisma.poiCategory.findUnique({ where: { id: categoryId } });
  if (!category) return { ok: false, error: "Category not found" };
  return guarded(category.eventId, async () => {
    await prisma.poiCategory.delete({ where: { id: categoryId } });
    return { ok: true };
  });
}

/** Quick start from the icons on the map; `keys` come from suggestCategories. */
export async function createSuggestedCategoriesAction(eventId: string, keys: string[]): Promise<ActionState> {
  return guarded(eventId, async ({ event }) => {
    const created = await prisma.$transaction((tx) => createSuggestedCategories(event.id, keys, tx));
    return created ? { ok: true } : { ok: false, error: "These points already have a category" };
  });
}
