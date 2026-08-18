/** Clock label in the organizer's local timezone, 24h, so Board and Schedule match. */
export function formatClock(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDayHeading(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Value for `<input type="datetime-local">`. */
export function toLocalInputValue(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hourStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
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

/**
 * Build a contiguous hour grid from the earliest start through the last
 * occupied hour so empty slots stay visible between sessions.
 */
export function buildScheduleDays<T extends { startsAt: string; endsAt: string }>(
  sessions: T[],
): ScheduleDay<T>[] {
  if (sessions.length === 0) return [];

  const byDay = new Map<string, T[]>();
  for (const session of sessions) {
    const key = dayKey(new Date(session.startsAt));
    const list = byDay.get(key);
    if (list) list.push(session);
    else byDay.set(key, [session]);
  }

  const days: ScheduleDay<T>[] = [];
  const dayKeys = [...byDay.keys()].sort();

  for (const key of dayKeys) {
    const daySessions = byDay.get(key)!;
    const starts = daySessions.map((s) => new Date(s.startsAt));
    const ends = daySessions.map((s) => new Date(s.endsAt));
    const first = hourStart(new Date(Math.min(...starts.map((d) => d.getTime()))));
    const lastEnd = new Date(Math.max(...ends.map((d) => d.getTime())));
    const lastOccupied = new Date(lastEnd.getTime() - 1);
    const last = hourStart(lastOccupied.getTime() < first.getTime() ? first : lastOccupied);

    const hours: ScheduleHour<T>[] = [];
    for (
      let cursor = new Date(first);
      cursor.getTime() <= last.getTime();
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), cursor.getHours() + 1)
    ) {
      const hourEnd = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
        cursor.getHours() + 1,
      );
      hours.push({
        key: `${key}T${String(cursor.getHours()).padStart(2, "0")}`,
        hour: new Date(cursor),
        label: formatClock(cursor),
        sessions: daySessions.filter((session) => {
          const start = new Date(session.startsAt);
          return start >= cursor && start < hourEnd;
        }),
      });
    }

    days.push({
      key,
      heading: formatDayHeading(first),
      hours,
    });
  }

  return days;
}
