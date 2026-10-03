"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { LEAD_MINUTES } from "@/lib/announcement-feed";
import { fail } from "@/i18n/action-errors";
import type { ActionState } from "./types";

const announcementSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(80),
  body: z.string().trim().min(1, "Write a short message").max(280),
});

// Clock skew between the organizer's device and the server.
const PAST_TOLERANCE_MS = 60_000;

async function loadAdminEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { team: { select: { slug: true } } },
  });
  if (!event) return null;
  const { session } = await requireAdmin(event.teamId);
  return { event, session };
}

function revalidateAnnouncements(teamSlug: string, eventSlug: string) {
  revalidatePath("/dashboard/announcements");
  revalidatePath(`/${teamSlug}/${eventSlug}`);
}

export async function sendAnnouncementAction(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const loaded = await loadAdminEvent(eventId);
  if (!loaded) return fail("Event not found");
  const { event, session } = loaded;

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  // The browser converts its datetime-local into a real instant before sending.
  let publishAt = new Date();
  if (formData.get("when") === "later") {
    const raw = formData.get("publishAt");
    const at = typeof raw === "string" && raw ? new Date(raw) : null;
    if (!at || Number.isNaN(at.getTime())) return fail("Pick a date and time");
    if (at.getTime() < Date.now() - PAST_TOLERANCE_MS) return fail("Pick a time in the future");
    publishAt = at;
  }

  await prisma.announcement.create({
    data: {
      eventId: event.id,
      title: parsed.data.title,
      body: parsed.data.body,
      authorName: session.user.name?.trim() || session.user.email,
      publishAt,
    },
  });

  revalidateAnnouncements(event.team.slug, event.slug);
  return { ok: true };
}

export async function deleteAnnouncementAction(announcementId: string): Promise<ActionState> {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { eventId: true },
  });
  if (!announcement) return fail("Announcement not found");
  const loaded = await loadAdminEvent(announcement.eventId);
  if (!loaded) return fail("Event not found");

  await prisma.announcement.delete({ where: { id: announcementId } });
  revalidateAnnouncements(loaded.event.team.slug, loaded.event.slug);
  return { ok: true };
}

const autoSchema = z.object({
  autoUpcoming: z.boolean(),
  leadMinutes: z.coerce
    .number()
    .int()
    .refine((value) => (LEAD_MINUTES as readonly number[]).includes(value)),
});

export async function updateAutoAnnouncementsAction(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const loaded = await loadAdminEvent(eventId);
  if (!loaded) return fail("Event not found");

  const parsed = autoSchema.safeParse({
    autoUpcoming: formData.get("autoUpcoming") === "on",
    leadMinutes: formData.get("leadMinutes"),
  });
  if (!parsed.success) return fail("Something went wrong. Check the form and try again.");

  await prisma.announcementSettings.upsert({
    where: { eventId },
    create: { eventId, ...parsed.data },
    update: parsed.data,
  });

  revalidateAnnouncements(loaded.event.team.slug, loaded.event.slug);
  return { ok: true };
}
