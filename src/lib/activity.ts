import { Music, Pin, Presentation, type LucideIcon, UtensilsCrossed, Wrench } from "lucide-react";

export const ACTIVITY_TYPE_IDS = ["performance", "food", "talk", "workshop", "other"] as const;
export type ActivityTypeId = (typeof ACTIVITY_TYPE_IDS)[number];

export function isActivityType(value: string): value is ActivityTypeId {
  return (ACTIVITY_TYPE_IDS as readonly string[]).includes(value);
}

export const ACTIVITY_TYPES: {
  id: ActivityTypeId;
  label: string;
  icon: LucideIcon;
  card: string;
  chip: string;
}[] = [
  {
    id: "performance",
    label: "Performance",
    icon: Music,
    card: "typed border-violet-400 bg-violet-50 text-violet-950 dark:border-violet-400/70 dark:bg-violet-950/60 dark:text-violet-50",
    chip: "typed bg-violet-100 text-violet-800 dark:bg-violet-900/70 dark:text-violet-100",
  },
  {
    id: "food",
    label: "Food",
    icon: UtensilsCrossed,
    card: "typed border-orange-400 bg-orange-50 text-orange-950 dark:border-orange-400/70 dark:bg-orange-950/60 dark:text-orange-50",
    chip: "typed bg-orange-100 text-orange-800 dark:bg-orange-900/70 dark:text-orange-100",
  },
  {
    id: "talk",
    label: "Talk",
    icon: Presentation,
    card: "typed border-sky-400 bg-sky-50 text-sky-950 dark:border-sky-400/70 dark:bg-sky-950/50 dark:text-sky-50",
    chip: "typed bg-sky-100 text-sky-800 dark:bg-sky-900/70 dark:text-sky-100",
  },
  {
    id: "workshop",
    label: "Workshop",
    icon: Wrench,
    card: "typed border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-400/70 dark:bg-emerald-950/50 dark:text-emerald-50",
    chip: "typed bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-100",
  },
  {
    id: "other",
    label: "Other",
    icon: Pin,
    card: "typed border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-500 dark:bg-slate-900/70 dark:text-slate-50",
    chip: "typed bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  },
];

const TYPE_BY_ID = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.id, t]));

export function activityTypeMeta(type: string) {
  return TYPE_BY_ID[type] ?? TYPE_BY_ID.other;
}

export type ActivityDTO = {
  id: string;
  name: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  poiId: string | null;
  poiTitle: string | null;
  poiIcon: string | null;
};

export type SchedulePoi = {
  id: string;
  title: string;
  icon: string | null;
};

export type ScheduleEvent = {
  id: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  published: boolean;
};

export function isScheduled(activity: Pick<ActivityDTO, "startTime" | "endTime">) {
  return !!activity.startTime && !!activity.endTime;
}

export function activityDurationMs(activity: Pick<ActivityDTO, "startTime" | "endTime">) {
  if (!activity.startTime || !activity.endTime) return null;
  return new Date(activity.endTime).getTime() - new Date(activity.startTime).getTime();
}

export type ActivityConflict = {
  id: string;
  left: ActivityDTO;
  right: ActivityDTO;
};

/** Two placed activities on the same location whose times overlap. */
export function findConflicts(activities: ActivityDTO[]): ActivityConflict[] {
  const placed = activities.filter((a) => isScheduled(a) && a.poiId);
  const conflicts: ActivityConflict[] = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const left = placed[i];
      const right = placed[j];
      if (left.poiId !== right.poiId) continue;
      const a0 = new Date(left.startTime!).getTime();
      const a1 = new Date(left.endTime!).getTime();
      const b0 = new Date(right.startTime!).getTime();
      const b1 = new Date(right.endTime!).getTime();
      if (a0 < b1 && b0 < a1) {
        conflicts.push({ id: `${left.id}:${right.id}`, left, right });
      }
    }
  }
  return conflicts;
}

export function isLiveNow(activity: ActivityDTO, now = Date.now()) {
  if (!activity.startTime || !activity.endTime) return false;
  const start = new Date(activity.startTime).getTime();
  const end = new Date(activity.endTime).getTime();
  return now >= start && now < end;
}

export type SuggestedSlot = {
  poiId: string;
  poiTitle: string;
  startTime: Date;
  endTime: Date;
};

/** First empty window on a location that fits `durationMs`. */
export function suggestSlot(
  activities: ActivityDTO[],
  pois: SchedulePoi[],
  windowStart: Date,
  windowEnd: Date,
  durationMs: number,
): SuggestedSlot | null {
  if (pois.length === 0) return null;
  const placed = activities.filter((a) => isScheduled(a) && a.poiId);
  for (const poi of pois) {
    const busy = placed
      .filter((a) => a.poiId === poi.id)
      .map((a) => ({
        start: new Date(a.startTime!).getTime(),
        end: new Date(a.endTime!).getTime(),
      }))
      .sort((a, b) => a.start - b.start);

    let cursor = windowStart.getTime();
    const close = windowEnd.getTime();
    for (const block of busy) {
      if (block.start - cursor >= durationMs) {
        return {
          poiId: poi.id,
          poiTitle: poi.title,
          startTime: new Date(cursor),
          endTime: new Date(cursor + durationMs),
        };
      }
      cursor = Math.max(cursor, block.end);
    }
    if (close - cursor >= durationMs) {
      return {
        poiId: poi.id,
        poiTitle: poi.title,
        startTime: new Date(cursor),
        endTime: new Date(cursor + durationMs),
      };
    }
  }
  return null;
}

export const ROW_DOTS = [
  "hue bg-violet-500",
  "hue bg-sky-500",
  "hue bg-emerald-500",
  "hue bg-amber-500",
  "hue bg-rose-500",
  "hue bg-brand",
];
