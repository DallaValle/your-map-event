import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * The dashboard works on ONE selected event at a time (teams rarely run more
 * than one, but it happens). The selection is a plain cookie so it survives
 * navigation and reloads without touching the data model.
 */
export const ACTIVE_EVENT_COOKIE = "activeEventId";

/**
 * Resolve the team's selected event: the cookie's event if it still exists and
 * belongs to this team, otherwise the most recently updated one. Viewers only
 * ever see published events, so the fallback respects that too.
 */
export async function getActiveEvent(teamId: string, isAdmin: boolean) {
  const visible = isAdmin ? {} : { published: true };

  const store = await cookies();
  const id = store.get(ACTIVE_EVENT_COOKIE)?.value;
  if (id) {
    const event = await prisma.event.findFirst({
      where: { id, teamId, ...visible },
    });
    if (event) return event;
  }

  return prisma.event.findFirst({
    where: { teamId, ...visible },
    orderBy: { updatedAt: "desc" },
  });
}

/** All events the caller may switch between, for the switcher dropdown. */
export async function getSwitchableEvents(teamId: string, isAdmin: boolean) {
  return prisma.event.findMany({
    where: { teamId, ...(isAdmin ? {} : { published: true }) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, published: true, centerName: true },
  });
}
