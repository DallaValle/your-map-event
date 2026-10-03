"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import { updateAutoAnnouncementsAction } from "@/actions/announcements";
import type { ActionState } from "@/actions/types";
import { LEAD_MINUTES, wallClockNow, type UpcomingDTO } from "@/lib/announcement-feed";
import { formatClock, formatShortDay, MINUTE_MS } from "@/lib/schedule-time";
import { Icon } from "@/components/ui/Icon";
import { PendingLabel } from "@/components/ui/Spinner";

const PREVIEW_COUNT = 3;
const noop = () => () => {};

/**
 * Schedule driven "starting soon" announcements. Nothing is stored per
 * activity: the live map derives them from the schedule, so moving an act
 * moves its announcement too.
 */
export function AutoAnnouncementsForm({
  eventId,
  autoUpcoming,
  leadMinutes,
  activities,
  canEdit,
  locale,
}: {
  eventId: string;
  autoUpcoming: boolean;
  leadMinutes: number;
  activities: UpcomingDTO[];
  canEdit: boolean;
  locale: string;
}) {
  const t = useTranslations("announcements.auto");
  const [on, setOn] = useState(autoUpcoming);
  const [lead, setLead] = useState(leadMinutes);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateAutoAnnouncementsAction.bind(null, eventId),
    null,
  );
  // The schedule is in venue wall clocks: only this device's clock can tell what is next.
  const wallNow = useSyncExternalStore(noop, () => Math.floor(wallClockNow() / MINUTE_MS), () => null);
  const next =
    wallNow == null
      ? []
      : activities.filter((a) => Date.parse(a.startTime) > wallNow * MINUTE_MS).slice(0, PREVIEW_COUNT);
  const dirty = on !== autoUpcoming || lead !== leadMinutes;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/15">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="autoUpcoming"
            checked={on}
            disabled={!canEdit}
            onChange={(e) => setOn(e.target.checked)}
            className="mt-0.5 size-5 accent-brand"
          />
          <span>
            <span className="block font-medium">{t("label")}</span>
            <span className="block text-sm opacity-60">{t("hint")}</span>
          </span>
        </label>

        <label className="flex flex-wrap items-center gap-2 pl-8 text-sm">
          {t("leadBefore")}
          <select
            name="leadMinutes"
            value={lead}
            disabled={!canEdit || !on}
            onChange={(e) => setLead(Number(e.target.value))}
            className="rounded-lg border border-black/15 px-3 py-1.5 disabled:opacity-50 dark:border-white/20 dark:bg-white/5"
          >
            {LEAD_MINUTES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {t("minutes", { count: minutes })}
              </option>
            ))}
          </select>
          {t("leadAfter")}
        </label>

        {/* A disabled select is not submitted: keep the saved lead time when turning off. */}
        {!on && <input type="hidden" name="leadMinutes" value={lead} />}
      </div>

      {on && wallNow != null && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide opacity-60">{t("next")}</h3>
          {next.length === 0 ? (
            <p className="text-sm opacity-60">{t("noneNext")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {next.map((activity) => {
                const goesOut = new Date(Date.parse(activity.startTime) - lead * MINUTE_MS);
                return (
                  <li key={activity.id} className="flex items-center gap-3 text-sm">
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
                    >
                      <Icon icon={CalendarClock} size="sm" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{activity.name}</span>
                      <span className="block truncate text-xs opacity-60">
                        {t("previewLine", {
                          day: formatShortDay(goesOut, locale),
                          time: formatClock(goesOut),
                          start: formatClock(activity.startTime),
                        })}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && !dirty && (
        <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          {t("saved")}
        </p>
      )}

      {canEdit && (
        <button
          type="submit"
          disabled={pending || !dirty}
          aria-busy={pending}
          className="self-start rounded-xl border border-black/15 px-5 py-2.5 text-sm font-semibold disabled:opacity-50 active:scale-[.98] dark:border-white/20"
        >
          <PendingLabel pending={pending} label={t("save")} pendingLabel={t("saving")} />
        </button>
      )}
    </form>
  );
}
