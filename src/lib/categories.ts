import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { suggestCategories, suggestedColor } from "@/components/map/poi-badge";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * The quick start: turn the suggested icon groups into categories (or join an
 * existing one of the same name) and file every uncategorized point under them.
 */
export async function createSuggestedCategories(
  eventId: string,
  keys: string[],
  db: Db = prisma,
  nameOf?: (english: string) => string,
) {
  const pois = await db.pointOfInterest.findMany({
    where: { mapId: eventId, categoryId: null },
    select: { icon: true, categoryId: true },
  });
  const wanted = suggestCategories(pois, nameOf).filter((s) => keys.includes(s.key));
  for (const suggestion of wanted) {
    const existing = await db.poiCategory.findFirst({
      where: { eventId, name: { equals: suggestion.name, mode: "insensitive" } },
    });
    const category =
      existing ??
      (await db.poiCategory.create({
        data: {
          eventId,
          name: suggestion.name,
          icon: suggestion.icon,
          color: suggestion.color,
          position: await nextPosition(eventId, db),
        },
      }));
    await db.pointOfInterest.updateMany({
      where: { mapId: eventId, categoryId: null, icon: { in: suggestion.icons } },
      data: { categoryId: category.id },
    });
  }
  return wanted.length;
}

async function nextPosition(eventId: string, db: Db) {
  const last = await db.poiCategory.aggregate({ where: { eventId }, _max: { position: true } });
  return (last._max.position ?? -1) + 1;
}

/** Category by name (case insensitive), created with this icon when missing. */
export async function findOrCreateCategory(eventId: string, name: string, icon: string | null, db: Db = prisma) {
  const existing = await db.poiCategory.findFirst({
    where: { eventId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;
  return db.poiCategory.create({
    data: {
      eventId,
      name,
      icon: icon || "📍",
      color: suggestedColor(icon),
      position: await nextPosition(eventId, db),
    },
  });
}
