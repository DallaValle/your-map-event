import { MINUTE_MS } from "@/lib/schedule-time";

export const LEAD_MINUTES = [5, 10, 15, 30, 60] as const;
export const DEFAULT_LEAD_MINUTES = 15;

/** Activities starting this far around the server clock cover every venue timezone. */
export const UPCOMING_WINDOW_MS = 15 * 60 * MINUTE_MS;

export type AnnouncementDTO = {
  id: string;
  title: string;
  body: string;
  /** Real instant, ISO. */
  publishAt: string;
};

export type UpcomingDTO = {
  id: string;
  name: string;
  place: string | null;
  icon: string | null;
  /** Venue wall clock anchored to UTC, ISO (see schedule-time). */
  startTime: string;
};

export type LiveFeedDTO = {
  announcements: AnnouncementDTO[];
  upcoming: UpcomingDTO[];
  /** Null when automatic announcements are off. */
  leadMinutes: number | null;
};

export type FeedItem =
  | { kind: "manual"; id: string; at: number; title: string; body: string }
  | { kind: "upcoming"; id: string; at: number; activity: UpcomingDTO };

/**
 * The device clock read as a venue wall clock. Attendees stand at the venue,
 * so their phone's timezone is the venue's, which the schedule never stores.
 */
export function wallClockNow(now = Date.now()): number {
  return now - new Date(now).getTimezoneOffset() * MINUTE_MS;
}

/** Manual announcements plus activities starting within the lead time, newest first. */
export function buildFeed(feed: LiveFeedDTO, now = Date.now()): FeedItem[] {
  const items: FeedItem[] = feed.announcements
    .filter((a) => Date.parse(a.publishAt) <= now)
    .map((a) => ({ kind: "manual", id: a.id, at: Date.parse(a.publishAt), title: a.title, body: a.body }));

  if (feed.leadMinutes != null) {
    const lead = feed.leadMinutes * MINUTE_MS;
    const wallNow = wallClockNow(now);
    const shift = now - wallNow;
    for (const activity of feed.upcoming) {
      const start = Date.parse(activity.startTime);
      if (wallNow >= start - lead && wallNow < start) {
        items.push({ kind: "upcoming", id: `upcoming:${activity.id}`, at: start - lead + shift, activity });
      }
    }
  }

  return items.sort((a, b) => b.at - a.at);
}
