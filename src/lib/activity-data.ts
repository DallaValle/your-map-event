import "server-only";

import { prisma } from "@/lib/prisma";
import type { ActivityDTO, SchedulePoi } from "@/lib/activity";

export type { ActivityDTO, SchedulePoi };

function toDTO(row: {
  id: string;
  name: string;
  type: string;
  startTime: Date | null;
  endTime: Date | null;
  poiId: string | null;
  poi: { title: string; icon: string | null } | null;
}): ActivityDTO {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    startTime: row.startTime?.toISOString() ?? null,
    endTime: row.endTime?.toISOString() ?? null,
    poiId: row.poiId,
    poiTitle: row.poi?.title ?? null,
    poiIcon: row.poi?.icon ?? null,
  };
}

export async function getEventActivities(eventId: string): Promise<ActivityDTO[]> {
  const rows = await prisma.activity.findMany({
    where: { eventId },
    include: { poi: { select: { title: true, icon: true } } },
    orderBy: [{ startTime: "asc" }, { name: "asc" }],
  });
  return rows.map(toDTO);
}

export async function getEventSchedulePois(eventId: string): Promise<SchedulePoi[]> {
  const rows = await prisma.pointOfInterest.findMany({
    where: { mapId: eventId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, icon: true },
  });
  return rows;
}
