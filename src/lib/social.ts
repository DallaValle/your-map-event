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
