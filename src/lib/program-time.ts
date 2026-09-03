/**
 * Session times are floating venue wall clocks: the hours an organizer types
 * are the hours every reader gets back, on any host, in any browser.
 *
 * They are anchored to UTC and only ever read through the getUTC* accessors.
 * getHours()/toLocaleDateString() would resolve against the *process*
 * timezone, so a client component would format one string during SSR and a
 * different one on hydration, and Board (client) would disagree with Schedule
 * (server) by the host's UTC offset.
 */

const HOUR_MS = 3_600_000;

/**
 * Cap on how far one session is expanded across the grid. Validation rejects
 * longer sessions, so this only bounds rows already in the database - a
 * mistyped year would otherwise render thousands of hours server-side.
 */
export const MAX_SESSION_DAYS = 14;

const DAY_HEADING = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Reads an `<input type="datetime-local">` value as a venue wall clock.
 * Returns null for anything unparseable, including a missing field, so the
 * caller reports it rather than coercing: `new Date(null)` is the epoch, and
 * `new Date("2026-07-18T17:00")` silently means "17:00 in the server's zone".
 */
export function parseWallClock(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(+year, +month - 1, +day, +hour, +minute, second ? +second : 0),
  );
  // Date.UTC rolls impossible dates over (Feb 31 -> Mar 3); reject instead.
  if (date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day) return null;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Clock label, 24h, identical on the server and in the browser. */
export function formatClock(value: string | Date): string {
  const date = toDate(value);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDayHeading(value: string | Date): string {
  return DAY_HEADING.format(toDate(value));
}

/** Value for `<input type="datetime-local">`. */
export function toLocalInputValue(value: string | Date): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function dayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function hourStart(time: number): number {
  return Math.floor(time / HOUR_MS) * HOUR_MS;
}

export type ScheduleHour<T> = {
  key: string;
  hour: Date;
  label: string;
  sessions: T[];
};

export type ScheduleDay<T> = {
  key: string;
  heading: string;
  hours: ScheduleHour<T>[];
};

/** A session with its instants parsed once, not per hour row. */
type Span<T> = { session: T; start: number; end: number };

type DayBucket<T> = {
  /** First and last hour to render, both clamped inside this calendar day. */
  from: number;
  to: number;
  spans: Span<T>[];
};

/**
 * Build a contiguous hour grid per day, from the earliest start through the
 * last occupied hour, so empty slots stay visible between sessions.
 *
 * A session is listed in every hour it actually runs, not just the hour it
 * starts, and one that crosses midnight appears under both days - clamped to
 * each, so an hour label never escapes the heading it sits under.
 */
export function buildScheduleDays<T extends { startsAt: string; endsAt: string }>(
  sessions: T[],
): ScheduleDay<T>[] {
  const byDay = new Map<string, DayBucket<T>>();

  for (const session of sessions) {
    const start = new Date(session.startsAt).getTime();
    const end = new Date(session.endsAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) continue;

    // The hour containing the final instant: a 10:00-11:00 session occupies
    // 10:00 only, not 11:00.
    const lastOccupied = Math.max(end - 1, start);
    const firstDay = dayStart(new Date(start));
    const lastDay = Math.min(
      dayStart(new Date(lastOccupied)),
      firstDay + (MAX_SESSION_DAYS - 1) * 24 * HOUR_MS,
    );
    const span: Span<T> = { session, start, end };

    for (let day = firstDay; day <= lastDay; day += 24 * HOUR_MS) {
      const from = Math.max(hourStart(start), day);
      const to = Math.min(hourStart(lastOccupied), day + 23 * HOUR_MS);
      const key = dayKey(new Date(day));
      const bucket = byDay.get(key);
      if (bucket) {
        bucket.from = Math.min(bucket.from, from);
        bucket.to = Math.max(bucket.to, to);
        bucket.spans.push(span);
      } else {
        byDay.set(key, { from, to, spans: [span] });
      }
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, bucket]) => {
      const hours: ScheduleHour<T>[] = [];
      for (let cursor = bucket.from; cursor <= bucket.to; cursor += HOUR_MS) {
        const hourEnd = cursor + HOUR_MS;
        hours.push({
          key: `${key}T${String(new Date(cursor).getUTCHours()).padStart(2, "0")}`,
          hour: new Date(cursor),
          label: formatClock(new Date(cursor)),
          sessions: bucket.spans
            .filter((span) => span.start < hourEnd && span.end > cursor)
            .map((span) => span.session),
        });
      }
      return { key, heading: formatDayHeading(new Date(bucket.from)), hours };
    });
}
