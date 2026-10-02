/**
 * Activity times are floating venue wall clocks: the hours an organizer types
 * are the hours every reader gets back, on any host, in any browser.
 *
 * They are anchored to UTC and only ever read through the getUTC* accessors.
 * getHours()/toLocaleDateString() would resolve against the *process*
 * timezone, so a client component would format one string during SSR and a
 * different one on hydration.
 */

export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;
export const DEFAULT_DURATION_MS = HOUR_MS;
export const MAX_ACTIVITY_DAYS = 14;

const SHORT_DAY = new Map<string, Intl.DateTimeFormat>();

function shortDayFormat(locale: string) {
  let format = SHORT_DAY.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    SHORT_DAY.set(locale, format);
  }
  return format;
}

/**
 * "Sat 18 Jul", "sab 18 lug". Built from parts because Node and browsers ship
 * different locale data ("Sat, 18 Jul" vs "Sat 18 Jul"), which breaks hydration.
 */
export function formatShortDay(value: string | Date, locale = "en"): string {
  const date = toDate(value);
  const parts = shortDayFormat(locale).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Reads an `<input type="datetime-local">` value as a venue wall clock.
 * Returns null for anything unparseable, including a missing field.
 */
export function parseWallClock(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(+year, +month - 1, +day, +hour, +minute, second ? +second : 0),
  );
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

/** Timeline header tick: `10AM`, `3PM`, `3:30PM` in English, the 24h clock elsewhere. */
export function formatHourTick(value: string | Date, locale = "en"): string {
  if (locale !== "en") return formatClock(value);
  const date = toDate(value);
  const minutes = date.getUTCMinutes();
  let hours = date.getUTCHours();
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return minutes === 0 ? `${hours}${suffix}` : `${hours}:${String(minutes).padStart(2, "0")}${suffix}`;
}

export function formatRange(start: string | Date, end: string | Date): string {
  return `${formatClock(start)} - ${formatClock(end)}`;
}

/** Value for `<input type="datetime-local">`. */
export function toLocalInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function utcDayStart(value: string | Date): number {
  const date = toDate(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function dayKey(value: string | Date): string {
  const date = toDate(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function snapMs(time: number, snap: number): number {
  return Math.round(time / snap) * snap;
}

/** Inclusive calendar days from start through end, capped. */
export function eachUtcDay(start: Date, end: Date): Date[] {
  const first = utcDayStart(start);
  const last = utcDayStart(end);
  if (last < first) return [new Date(first)];
  const max = first + (MAX_ACTIVITY_DAYS - 1) * 24 * HOUR_MS;
  const stop = Math.min(last, max);
  const days: Date[] = [];
  for (let t = first; t <= stop; t += 24 * HOUR_MS) days.push(new Date(t));
  return days;
}
