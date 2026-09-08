export const POST_STATUSES = ["draft", "scheduled", "done"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_CHANNELS = [
  { value: "x", label: "X" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "stories", label: "Stories" },
  { value: "other", label: "Other" },
] as const;

export type PostChannel = (typeof POST_CHANNELS)[number]["value"];

export function isPostStatus(value: string): value is PostStatus {
  return (POST_STATUSES as readonly string[]).includes(value);
}

export function isPostChannel(value: string): value is PostChannel {
  return POST_CHANNELS.some((channel) => channel.value === value);
}

export function channelLabel(value: string) {
  return POST_CHANNELS.find((channel) => channel.value === value)?.label ?? value;
}

/**
 * datetime-local has no offset. Store it as UTC so a UTC host does not shift
 * 10:00 into the organizer's zone, and format it back with timeZone: "UTC".
 */
export function parseWallClock(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(+year, +month - 1, +day, +hour, +minute, second ? +second : 0),
  );
  if (date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day) return null;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatWallClock(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}
