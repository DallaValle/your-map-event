"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMyTeam, isAdminRole, requireAdmin } from "@/lib/session";
import { setSeenAt } from "@/lib/notifications";
import type { ActionState } from "./types";

const announcementSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(80),
  body: z.string().trim().min(1, "Write a short message").max(280),
});

async function revalidateAnnouncement(teamSlug: string, eventSlug: string) {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/notifications");
  revalidatePath(`/${teamSlug}/${eventSlug}`);
}

export async function sendAnnouncementAction(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { team: { select: { slug: true } } },
  });
  if (!event) return { ok: false, error: "Event not found" };

  const { session } = await requireAdmin(event.teamId);

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const authorName = session.user.name?.trim() || session.user.email;
  const notification = await prisma.notification.create({
    data: {
      eventId: event.id,
      title: parsed.data.title,
      body: parsed.data.body,
      authorName,
    },
  });

  // Sender is already on the list page, so their own send is not unread.
  await setSeenAt(event.id, notification.createdAt);
  await revalidateAnnouncement(event.team.slug, event.slug);
  return { ok: true };
}

export async function markAnnouncementsSeenAction(eventId: string): Promise<void> {
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

  const latest = await prisma.notification.findFirst({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!latest) return;

  await setSeenAt(event.id, latest.createdAt);
  revalidatePath("/dashboard", "layout");
}
