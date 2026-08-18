import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Last time this browser saw each event's announcements. Cookie (not a row)
 * because attendees have no account, and the dashboard bell is per-session.
 */
export const NOTIF_SEEN_COOKIE = "notifSeenAt";

const COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

function parseSeenMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, string>;
  } catch {
    return {};
  }
}

export async function getSeenAt(eventId: string): Promise<Date | null> {
  const raw = (await cookies()).get(NOTIF_SEEN_COOKIE)?.value;
  const iso = parseSeenMap(raw)[eventId];
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function setSeenAt(eventId: string, at: Date) {
  const store = await cookies();
  const map = parseSeenMap(store.get(NOTIF_SEEN_COOKIE)?.value);
  map[eventId] = at.toISOString();
  store.set(NOTIF_SEEN_COOKIE, JSON.stringify(map), COOKIE_OPTS);
}

export async function listAnnouncements(eventId: string) {
  return prisma.notification.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLatestAnnouncement(eventId: string) {
  return prisma.notification.findFirst({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUnreadCount(eventId: string) {
  const seenAt = await getSeenAt(eventId);
  return prisma.notification.count({
    where: {
      eventId,
      ...(seenAt ? { createdAt: { gt: seenAt } } : {}),
    },
  });
}
