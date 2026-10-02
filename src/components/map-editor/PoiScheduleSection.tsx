"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createActivityAction, deleteActivityAction } from "@/actions/activities";
import { ACTIVITY_TYPES, activityTypeMeta, isScheduled, type ActivityDTO } from "@/lib/activity";
import { formatRange, toLocalInputValue } from "@/lib/schedule-time";
import type { ActionState } from "@/actions/types";
import { PendingLabel } from "@/components/ui/Spinner";

const inputClass =
  "rounded-xl border border-black/15 px-3 py-2 text-sm outline-brand dark:border-white/20 dark:bg-white/5";

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
  const t = useTranslations("poiSchedule");
  const typeLabel = useTranslations("activityTypes");
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
        <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">{t("title")}</h3>
        <Link
          href="/dashboard/schedule"
          className="text-xs font-semibold text-brand"
        >
          {t("openTimeline")}
        </Link>
      </div>

      {mine.length === 0 ? (
        <p className="text-xs opacity-60">
          {t("empty", { location: poiTitle })}
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
                      : t("unscheduled")}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={t("remove", { name: activity.name })}
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

      <form action={formAction} aria-label={t("addAt", { location: poiTitle })} className="flex flex-col gap-2">
        <input type="hidden" name="poiId" value={poiId} />
        <input
          name="name"
          required
          maxLength={80}
          placeholder={t("name")}
          aria-label={t("name")}
          className={inputClass}
        />
        <select name="type" defaultValue="performance" aria-label={t("type")} className={inputClass}>
          {ACTIVITY_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.emoji} {typeLabel(type.id)}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5 text-[11px] font-medium opacity-70">
            {t("start")}
            <input
              name="startTime"
              type="datetime-local"
              defaultValue={toLocalInputValue(defaultStart)}
              className={`${inputClass} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] font-medium opacity-70">
            {t("end")}
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
          aria-busy={pending}
          className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand disabled:opacity-60"
        >
          <PendingLabel pending={pending} label={t("add")} pendingLabel={t("adding")} />
        </button>
      </form>
    </section>
  );
}
