"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { ACTIVE_EVENT_COOKIE } from "@/lib/active-event";

/**
 * Select which of the team's events the dashboard works on. Any member may
 * switch; viewers can only select published events (matching what they see).
 */
export async function setActiveEventAction(eventId: string): Promise<void> {
  const membership = await getMyTeam();
  if (!membership) return;

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      teamId: membership.team.id,
      ...(isAdminRole(membership.role) ? {} : { published: true }),
    },
  });
  if (!event) return;

  const store = await cookies();
  store.set(ACTIVE_EVENT_COOKIE, event.id, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  // The switcher lives in the console layout — refresh the whole subtree.
  revalidatePath("/dashboard", "layout");
}
