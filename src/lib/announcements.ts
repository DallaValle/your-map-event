import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LEAD_MINUTES,
  UPCOMING_WINDOW_MS,
  type LiveFeedDTO,
} from "@/lib/announcement-feed";

export async function listAnnouncements(eventId: string) {
  return prisma.announcement.findMany({
    where: { eventId },
    orderBy: { publishAt: "desc" },
  });
}

export async function getAnnouncementSettings(eventId: string) {
  const row = await prisma.announcementSettings.findUnique({ where: { eventId } });
  return {
    autoUpcoming: row?.autoUpcoming ?? true,
    leadMinutes: row?.leadMinutes ?? DEFAULT_LEAD_MINUTES,
  };
}

/** Scheduled activities around now; the device clock picks the ones due. */
export async function listUpcomingActivities(eventId: string, now = Date.now(), aheadMs = 0) {
  const activities = await prisma.activity.findMany({
    where: {
      eventId,
      endTime: { not: null },
      startTime: {
        gte: new Date(now - UPCOMING_WINDOW_MS),
        lte: new Date(now + UPCOMING_WINDOW_MS + aheadMs),
      },
    },
    orderBy: { startTime: "asc" },
    include: { poi: { select: { title: true, icon: true } } },
  });
  return activities.map((a) => ({
    id: a.id,
    name: a.name,
    place: a.poi?.title ?? null,
    icon: a.poi?.icon ?? null,
    startTime: a.startTime!.toISOString(),
  }));
}

/** What attendees of a published event may see right now. */
export async function getLiveFeed(eventId: string): Promise<LiveFeedDTO> {
  const now = Date.now();
  const [announcements, settings] = await Promise.all([
    prisma.announcement.findMany({
      where: { eventId, publishAt: { lte: new Date(now) } },
      orderBy: { publishAt: "desc" },
      take: 30,
    }),
    getAnnouncementSettings(eventId),
  ]);
  const upcoming = settings.autoUpcoming
    ? await listUpcomingActivities(eventId, now, settings.leadMinutes * 60_000)
    : [];
  return {
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      publishAt: a.publishAt.toISOString(),
    })),
    upcoming,
    leadMinutes: settings.autoUpcoming ? settings.leadMinutes : null,
  };
}
