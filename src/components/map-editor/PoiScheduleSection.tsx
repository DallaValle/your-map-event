"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createActivityAction, deleteActivityAction } from "@/actions/activities";
import { ACTIVITY_TYPES, activityTypeMeta, isScheduled, type ActivityDTO } from "@/lib/activity";
import { formatRange, toLocalInputValue } from "@/lib/schedule-time";
import type { ActionState } from "@/actions/types";

const inputClass =
  "rounded-xl border border-black/15 px-3 py-2 text-sm outline-teal-700 dark:border-white/20 dark:bg-white/5";

/**
 * Schedule slot on a map point. Activities created here land on the event
 * timeline, on this location's row.
 */
export function PoiScheduleSection({
  eventId,
  poiId,
  poiTitle,
  activities,
  defaultStart,
  defaultEnd,
}: {
  eventId: string;
  poiId: string;
  poiTitle: string;
  activities: ActivityDTO[];
  defaultStart?: string | null;
  defaultEnd?: string | null;
}) {
  const router = useRouter();
  const mine = activities.filter((a) => a.poiId === poiId);

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await createActivityAction(eventId, prev, formData);
      if (result?.ok) router.refresh();
      return result;
    },
    null,
  );

  return (
    <section className="flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/15">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">On the schedule</h3>
        <Link
          href="/dashboard/schedule"
          className="text-xs font-semibold text-teal-700 dark:text-teal-400"
        >
          Open timeline
        </Link>
      </div>

      {mine.length === 0 ? (
        <p className="text-xs opacity-60">
          No acts at {poiTitle} yet. Add one below and it appears on the schedule.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {mine.map((activity) => {
            const meta = activityTypeMeta(activity.type);
            return (
              <li
                key={activity.id}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${meta.card}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{activity.name}</span>
                  <span className="block text-[11px] opacity-70">
                    {isScheduled(activity)
                      ? formatRange(activity.startTime!, activity.endTime!)
                      : "Unscheduled"}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${activity.name} from the schedule`}
                  onClick={async () => {
                    await deleteActivityAction(activity.id);
                    router.refresh();
                  }}
                  className="text-xs font-semibold opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form action={formAction} aria-label={`Add activity at ${poiTitle}`} className="flex flex-col gap-2">
        <input type="hidden" name="poiId" value={poiId} />
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Activity name"
          aria-label="Activity name"
          className={inputClass}
        />
        <select name="type" defaultValue="performance" aria-label="Activity type" className={inputClass}>
          {ACTIVITY_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.emoji} {type.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5 text-[11px] font-medium opacity-70">
            Start
            <input
              name="startTime"
              type="datetime-local"
              defaultValue={toLocalInputValue(defaultStart)}
              className={`${inputClass} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] font-medium opacity-70">
            End
            <input
              name="endTime"
              type="datetime-local"
              defaultValue={toLocalInputValue(defaultEnd)}
              className={`${inputClass} font-normal`}
            />
          </label>
        </div>
        {state && !state.ok && (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-teal-700/10 px-3 py-2 text-sm font-semibold text-teal-800 disabled:opacity-60 dark:text-teal-300"
        >
          {pending ? "Adding…" : "+ Add to schedule"}
        </button>
      </form>
    </section>
  );
}
