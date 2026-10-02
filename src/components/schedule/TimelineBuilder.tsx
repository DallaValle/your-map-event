"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  placeActivityAction,
  unscheduleActivityAction,
  updateEventWindowAction,
} from "@/actions/activities";
import {
  ROW_DOTS,
  activityDurationMs,
  activityTypeMeta,
  findConflicts,
  isLiveNow,
  isScheduled,
  suggestSlot,
  type ActivityDTO,
  type ScheduleEvent,
  type SchedulePoi,
} from "@/lib/activity";
import { PendingLabel } from "@/components/ui/Spinner";
import {
  DEFAULT_DURATION_MS,
  HOUR_MS,
  MINUTE_MS,
  dayKey,
  eachUtcDay,
  formatClock,
  formatHourTick,
  formatRange,
  formatShortDay,
  snapMs,
  toLocalInputValue,
  utcDayStart,
} from "@/lib/schedule-time";
import { ActivityDialog, type ActivityDialogState } from "./ActivityDialog";

const STAGE_COL = 176;
const ROW_H = 92;
const UNASSIGNED_ID = "__unassigned__";
const VENUE_ICONS = new Set(["🎤", "🎪", "🍔", "🍺", "☕", "🚪", "🎡", "🧸"]);

const ZOOM = [
  { id: "30m", hourWidth: 160, snap: 30 * MINUTE_MS },
  { id: "1h", hourWidth: 112, snap: HOUR_MS },
  { id: "2h", hourWidth: 72, snap: HOUR_MS },
] as const;

type ZoomId = (typeof ZOOM)[number]["id"];
type UndoSnap = {
  activityId: string;
  poiId: string | null;
  startTime: string | null;
  endTime: string | null;
};

function hoursOfDay(day: Date, startHour: number, endHour: number): Date[] {
  const hours: Date[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push(new Date(utcDayStart(day) + h * HOUR_MS));
  }
  return hours;
}

function firstGap(
  activities: ActivityDTO[],
  poiId: string | null,
  dayStart: number,
  dayEnd: number,
  durationMs: number,
): { start: Date; end: Date } | null {
  const busy = activities
    .filter((a) => isScheduled(a) && (a.poiId ?? UNASSIGNED_ID) === (poiId ?? UNASSIGNED_ID))
    .map((a) => ({
      start: new Date(a.startTime!).getTime(),
      end: new Date(a.endTime!).getTime(),
    }))
    .filter((b) => b.start < dayEnd && b.end > dayStart)
    .sort((a, b) => a.start - b.start);

  let cursor = dayStart;
  for (const block of busy) {
    if (block.start - cursor >= durationMs) {
      return { start: new Date(cursor), end: new Date(cursor + durationMs) };
    }
    cursor = Math.max(cursor, block.end);
  }
  if (dayEnd - cursor >= durationMs) {
    return { start: new Date(cursor), end: new Date(cursor + durationMs) };
  }
  return null;
}

export function TimelineBuilder({
  event,
  activities,
  pois,
  isAdmin,
  editorHref,
}: {
  event: ScheduleEvent;
  activities: ActivityDTO[];
  pois: SchedulePoi[];
  isAdmin: boolean;
  editorHref: string | null;
}) {
  const t = useTranslations("schedule");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [dayIndex, setDayIndex] = useState(0);
  const [zoomId, setZoomId] = useState<ZoomId>("1h");
  const [preview, setPreview] = useState(false);
  const [dialog, setDialog] = useState<ActivityDialogState | null>(null);
  const [undo, setUndo] = useState<UndoSnap[]>([]);
  const [dragOverRow, setDragOverRow] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [windowOpen, setWindowOpen] = useState(!event.startTime || !event.endTime);

  const canEdit = isAdmin && !preview;
  const zoom = ZOOM.find((z) => z.id === zoomId) ?? ZOOM[1];

  const days = useMemo(() => {
    if (event.startTime && event.endTime) {
      return eachUtcDay(new Date(event.startTime), new Date(event.endTime));
    }
    const timed = activities.filter(isScheduled);
    if (timed.length === 0) return [];
    const starts = timed.map((a) => new Date(a.startTime!).getTime());
    const ends = timed.map((a) => new Date(a.endTime!).getTime());
    return eachUtcDay(new Date(Math.min(...starts)), new Date(Math.max(...ends)));
  }, [event.startTime, event.endTime, activities]);

  const selectedDay = days[Math.min(dayIndex, Math.max(days.length - 1, 0))] ?? null;

  const startHour = event.startTime ? new Date(event.startTime).getUTCHours() : 10;
  const rawEndHour = event.endTime ? new Date(event.endTime).getUTCHours() : 23;
  const endHour = Math.max(startHour, rawEndHour === 0 ? 23 : rawEndHour);

  const hours = selectedDay ? hoursOfDay(selectedDay, startHour, endHour) : [];
  const dayStart = hours[0]?.getTime() ?? 0;
  const dayEnd = dayStart + hours.length * HOUR_MS;
  const canvasWidth = hours.length * zoom.hourWidth;

  const conflicts = useMemo(() => findConflicts(activities), [activities]);
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of conflicts) {
      ids.add(c.left.id);
      ids.add(c.right.id);
    }
    return ids;
  }, [conflicts]);

  const unscheduled = activities.filter((a) => !isScheduled(a));
  const scheduled = activities.filter(isScheduled);

  const filteredUnscheduled = unscheduled.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredScheduled = scheduled.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase()),
  );

  const rows: { id: string; title: string; icon: string | null; hint?: string }[] = [
    ...pois
      .filter((poi) => {
        const hasAct = activities.some((a) => a.poiId === poi.id);
        return hasAct || VENUE_ICONS.has(poi.icon ?? "");
      })
      .sort((a, b) => {
        const aN = activities.filter((act) => act.poiId === a.id).length;
        const bN = activities.filter((act) => act.poiId === b.id).length;
        return bN - aN;
      })
      .map((poi) => ({ id: poi.id, title: poi.title, icon: poi.icon })),
    { id: UNASSIGNED_ID, title: t("unassigned"), icon: "📍", hint: t("noLocation") },
  ];

  const suggestion = unscheduled[0]
    ? suggestSlot(
        activities,
        pois,
        selectedDay ? new Date(dayStart) : new Date(),
        selectedDay ? new Date(dayEnd) : new Date(),
        DEFAULT_DURATION_MS,
      )
    : null;

  function pushUndo(activity: ActivityDTO) {
    setUndo((stack) => [
      ...stack,
      {
        activityId: activity.id,
        poiId: activity.poiId,
        startTime: activity.startTime,
        endTime: activity.endTime,
      },
    ]);
  }

  function run(work: () => Promise<{ ok: boolean; error?: string } | null>) {
    setSaveError(null);
    startTransition(async () => {
      const result = await work();
      if (result && !result.ok) setSaveError(result.error ?? t("saveFailed"));
      router.refresh();
    });
  }

  function place(activity: ActivityDTO, poiId: string | null, start: Date, end: Date) {
    pushUndo(activity);
    run(() =>
      placeActivityAction(activity.id, {
        poiId,
        startTime: toLocalInputValue(start),
        endTime: toLocalInputValue(end),
      }),
    );
  }

  function handleDrop(rowId: string, clientX: number, target: HTMLElement, activityId: string) {
    const activity = activities.find((a) => a.id === activityId);
    if (!activity || !canEdit) return;
    const hoursEl = target.closest("[data-hours]") as HTMLElement | null;
    if (!hoursEl) return;
    const rect = hoursEl.getBoundingClientRect();
    const x = Math.max(0, clientX - rect.left);
    const raw = dayStart + (x / zoom.hourWidth) * HOUR_MS;
    const start = snapMs(raw, zoom.snap);
    const duration = activityDurationMs(activity) ?? DEFAULT_DURATION_MS;
    const end = start + duration;
    const poiId = rowId === UNASSIGNED_ID ? null : rowId;
    place(activity, poiId, new Date(start), new Date(end));
    setDragOverRow(null);
  }

  function handleUndo() {
    const last = undo[undo.length - 1];
    if (!last) return;
    setUndo((stack) => stack.slice(0, -1));
    run(async () => {
      if (!last.startTime || !last.endTime) {
        return unscheduleActivityAction(last.activityId);
      }
      return placeActivityAction(last.activityId, {
        poiId: last.poiId,
        startTime: toLocalInputValue(last.startTime),
        endTime: toLocalInputValue(last.endTime),
      });
    });
  }

  function autoResolve() {
    const first = unscheduled[0];
    if (!first || !suggestion) return;
    place(first, suggestion.poiId, suggestion.startTime, suggestion.endTime);
  }

  const now = Date.now();
  const nowLeft =
    selectedDay && now >= dayStart && now < dayEnd
      ? ((now - dayStart) / HOUR_MS) * zoom.hourWidth
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("eyebrow")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold">{t("title")}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                event.published
                  ? "typed bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "bg-brand-soft text-muted"
              }`}
            >
              {event.published ? t("live") : t("draft")}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canEdit || undo.length === 0 || pending}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {t("undo")}
          </button>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            aria-pressed={preview}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              preview
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-surface"
            }`}
          >
            {t("preview")}
          </button>
          <span
            className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-fg"
            aria-live="polite"
            aria-busy={pending}
          >
            <PendingLabel
              pending={pending}
              label={saveError ? t("saveFailed") : t("saved")}
              pendingLabel={t("saving")}
            />
          </span>
        </div>
      </header>

      {saveError && (
        <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {saveError}
        </p>
      )}

      {isAdmin && windowOpen && (
        <EventWindowBar event={event} onClose={() => setWindowOpen(false)} />
      )}

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label={t("library")}
          className="flex w-72 shrink-0 flex-col border-r border-line bg-surface"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {t("library")}
            </p>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="mt-2 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-brand"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <LibraryGroup
              label={t("unscheduledCount", { count: filteredUnscheduled.length })}
              empty={t("unscheduledEmpty")}
            >
              {filteredUnscheduled.map((activity) => (
                <LibraryCard
                  key={activity.id}
                  activity={activity}
                  draggable={canEdit}
                  onOpen={() => canEdit && setDialog({ mode: "edit", activity })}
                />
              ))}
            </LibraryGroup>

            <LibraryGroup
              label={t("scheduledCount", { count: filteredScheduled.length })}
              empty={t("scheduledEmpty")}
            >
              {filteredScheduled.map((activity) => (
                <LibraryCard
                  key={activity.id}
                  activity={activity}
                  draggable={canEdit}
                  onOpen={() => canEdit && setDialog({ mode: "edit", activity })}
                />
              ))}
            </LibraryGroup>
          </div>

          {canEdit && (
            <div className="border-t border-line p-3">
              <button
                type="button"
                onClick={() => setDialog({ mode: "create" })}
                className="w-full rounded-xl border border-dashed border-line px-3 py-2.5 text-sm font-semibold text-muted hover:border-brand hover:text-brand"
              >
                {t("addActivity")}
              </button>
            </div>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col" aria-label={t("timeline")}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
            <div role="tablist" aria-label={t("days")} className="flex flex-wrap gap-1">
              {days.map((day, index) => {
                const selected = day === selectedDay || dayKey(day) === (selectedDay ? dayKey(selectedDay) : "");
                return (
                  <button
                    key={dayKey(day)}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setDayIndex(index)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                      selected
                        ? "bg-brand text-brand-fg"
                        : "bg-brand-soft text-muted hover:text-foreground"
                    }`}
                  >
                    {t("dayTab", { n: index + 1, day: formatShortDay(day, locale) })}
                  </button>
                );
              })}
              {days.length === 0 && (
                <span className="text-sm text-muted">{t("noDays")}</span>
              )}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-3">
              <ul className="hue hidden items-center gap-3 text-[11px] font-medium text-muted sm:flex">
                <li className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-400" /> {t("legendConflict")}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-red-500" /> {t("legendLive")}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-zinc-300" /> {t("legendEmpty")}
                </li>
              </ul>
              <div className="flex items-center rounded-lg border border-line">
                {ZOOM.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={zoomId === option.id}
                    onClick={() => setZoomId(option.id)}
                    className={`px-2.5 py-1 text-xs font-semibold ${
                      zoomId === option.id
                        ? "bg-foreground text-background"
                        : "text-muted"
                    }`}
                  >
                    {t(`zoom.${option.id}`)}
                  </button>
                ))}
              </div>
              {editorHref && canEdit && (
                <Link
                  href={editorHref}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold"
                >
                  {t("addLocation")}
                </Link>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setWindowOpen((v) => !v)}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold"
                >
                  {t("eventHours")}
                </button>
              )}
            </div>
          </div>

          {days.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted">
              {t("noTimeline")}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="min-w-max">
                <div
                  className="sticky top-0 z-20 flex border-b border-line bg-surface"
                  style={{ minWidth: STAGE_COL + canvasWidth }}
                >
                  <div
                    className="sticky left-0 z-30 shrink-0 border-r border-line bg-surface"
                    style={{ width: STAGE_COL }}
                  />
                  <div className="relative flex" style={{ width: canvasWidth }}>
                    {hours.map((hour) => (
                      <div
                        key={hour.toISOString()}
                        className="shrink-0 border-l border-line py-2 text-center text-[11px] font-semibold text-muted"
                        style={{ width: zoom.hourWidth }}
                      >
                        {formatHourTick(hour, locale)}
                      </div>
                    ))}
                    {nowLeft != null && (
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
                        style={{ left: nowLeft }}
                      />
                    )}
                  </div>
                </div>

                {rows.map((row, rowIndex) => {
                  const rowActs = scheduled.filter(
                    (a) => (a.poiId ?? UNASSIGNED_ID) === row.id,
                  );
                  const isOver = dragOverRow === row.id;
                  return (
                    <div
                      key={row.id}
                      className="flex border-b border-black/5 dark:border-white/10"
                      style={{ minWidth: STAGE_COL + canvasWidth, height: ROW_H }}
                    >
                      <div
                        className="sticky left-0 z-10 flex shrink-0 flex-col justify-center gap-1 border-r border-line bg-surface px-3"
                        style={{ width: STAGE_COL }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`size-2.5 shrink-0 rounded-full ${ROW_DOTS[rowIndex % ROW_DOTS.length]}`}
                          />
                          <p className="truncate text-sm font-semibold">{row.title}</p>
                        </div>
                        <p className="pl-4 text-[11px] text-muted">
                          {row.hint ?? t("actCount", { count: rowActs.length })}
                        </p>
                        {canEdit && row.id !== UNASSIGNED_ID && (
                          <button
                            type="button"
                            onClick={() => {
                              const gap = firstGap(activities, row.id, dayStart, dayEnd, DEFAULT_DURATION_MS);
                              setDialog({
                                mode: "create",
                                poiId: row.id,
                                startTime: gap?.start ?? new Date(dayStart),
                                endTime: gap?.end ?? new Date(dayStart + DEFAULT_DURATION_MS),
                              });
                            }}
                            className="pl-4 text-left text-[11px] font-semibold text-brand"
                          >
                            {t("addAct")}
                          </button>
                        )}
                      </div>

                      <div
                        data-hours
                        data-row={row.id}
                        onDragOver={(e) => {
                          if (!canEdit) return;
                          e.preventDefault();
                          setDragOverRow(row.id);
                        }}
                        onDragLeave={() => setDragOverRow((id) => (id === row.id ? null : id))}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData("text/activity-id");
                          if (id) handleDrop(row.id, e.clientX, e.currentTarget, id);
                        }}
                        className={`relative flex-none ${isOver ? "bg-brand-soft" : ""}`}
                        style={{ width: canvasWidth, height: ROW_H }}
                      >
                        {hours.map((hour, i) => (
                          <div
                            key={hour.toISOString()}
                            className="absolute top-0 bottom-0 border-l border-black/5 dark:border-white/10"
                            style={{ left: i * zoom.hourWidth, width: zoom.hourWidth }}
                          />
                        ))}

                        {rowActs.length === 0 && (
                          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted">
                            {canEdit ? t("dropHere") : t("empty")}
                          </p>
                        )}

                        {rowActs.map((activity) => {
                          const start = new Date(activity.startTime!).getTime();
                          const end = new Date(activity.endTime!).getTime();
                          if (end <= dayStart || start >= dayEnd) return null;
                          const left = ((Math.max(start, dayStart) - dayStart) / HOUR_MS) * zoom.hourWidth;
                          const width = Math.max(
                            56,
                            ((Math.min(end, dayEnd) - Math.max(start, dayStart)) / HOUR_MS) * zoom.hourWidth,
                          );
                          const live = isLiveNow(activity, now);
                          const conflict = conflictIds.has(activity.id);
                          const meta = activityTypeMeta(activity.type);
                          const range = formatRange(activity.startTime!, activity.endTime!);
                          const compact = width < 96;
                          return (
                            <article
                              key={activity.id}
                              draggable={canEdit}
                              title={`${activity.name} · ${range}`}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/activity-id", activity.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={() => canEdit && setDialog({ mode: "edit", activity })}
                              className={`absolute top-2 overflow-hidden rounded-xl border-2 px-2 py-1.5 shadow-sm ${meta.card} ${
                                conflict ? "ring-2 ring-rose-400" : ""
                              } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                              style={{ left, width, height: ROW_H - 16 }}
                            >
                              <h3 className="truncate text-sm font-semibold">{activity.name}</h3>
                              {/* Short acts keep their start time; the full range is in the title. */}
                              <p className="truncate text-[11px] tabular-nums opacity-70">
                                {compact ? formatClock(activity.startTime!) : range}
                              </p>
                              {live && (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                  {t("live")}
                                </span>
                              )}
                            </article>
                          );
                        })}

                        {nowLeft != null && (
                          <div
                            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
                            style={{ left: nowLeft }}
                          >
                            <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {pois.length === 0 && (
                  <div className="flex items-center gap-2 px-6 py-10 text-sm text-muted">
                    <span>{t("locationsFromMap")}</span>
                    {editorHref && (
                      <Link href={editorHref} className="font-semibold text-brand">
                        {t("openEditor")}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {(conflicts.length > 0 || (unscheduled.length > 0 && suggestion)) && (
        <div className="hue flex shrink-0 flex-wrap items-center gap-3 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <span aria-hidden>⚠️</span>
          <p className="min-w-0 flex-1">
            {conflicts.length > 0 ? (
              <>
                <strong>{t("conflicts", { count: conflicts.length })}</strong>{" "}
                {conflicts[0].left.poiTitle
                  ? t("overlapsOn", {
                      left: conflicts[0].left.name,
                      right: conflicts[0].right.name,
                      location: conflicts[0].left.poiTitle,
                    })
                  : t("overlaps", { left: conflicts[0].left.name, right: conflicts[0].right.name })}
              </>
            ) : (
              <>
                <strong>{t("conflicts", { count: 1 })}</strong>{" "}
                {suggestion
                  ? t("unscheduledSlot", {
                      name: unscheduled[0].name,
                      location: suggestion.poiTitle,
                      time: formatClock(suggestion.startTime),
                    })
                  : t("unscheduledNoSlot", { name: unscheduled[0].name })}
              </>
            )}
          </p>
          {canEdit && unscheduled.length > 0 && suggestion && (
            <button
              type="button"
              onClick={autoResolve}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-amber-950 shadow-sm dark:bg-amber-100"
            >
              {t("autoResolve")}
            </button>
          )}
        </div>
      )}

      {canEdit && dialog && (
        <ActivityDialog
          eventId={event.id}
          pois={pois}
          state={dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function LibraryGroup({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  const count = items.length;
  return (
    <section className="mb-4">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </h2>
      {count === 0 ? (
        <p className="px-1 text-xs text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">{children}</ul>
      )}
    </section>
  );
}

function LibraryCard({
  activity,
  draggable,
  onOpen,
}: {
  activity: ActivityDTO;
  draggable: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("schedule");
  const typeLabel = useTranslations("activityTypes");
  const meta = activityTypeMeta(activity.type);
  const scheduled = isScheduled(activity);
  return (
    <li>
      <button
        type="button"
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/activity-id", activity.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={onOpen}
        className={`flex w-full items-center gap-3 rounded-2xl border bg-surface px-3 py-2.5 text-left shadow-sm ${
          scheduled ? `border-l-4 ${meta.card}` : "border-line"
        }`}
      >
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-base ${meta.chip}`}>
          {meta.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{activity.name}</span>
          <span className="block truncate text-[11px] text-muted">
            {scheduled
              ? `${activity.poiTitle ?? t("unassigned")} · ${formatRange(activity.startTime!, activity.endTime!)}`
              : typeLabel(meta.id)}
          </span>
        </span>
        {scheduled && (
          <span className="text-brand" aria-hidden>
            ✓
          </span>
        )}
      </button>
    </li>
  );
}

function EventWindowBar({
  event,
  onClose,
}: {
  event: ScheduleEvent;
  onClose: () => void;
}) {
  const t = useTranslations("schedule");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-3 border-b border-line bg-surface px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await updateEventWindowAction(event.id, null, form);
          if (result && !result.ok) setError(result.error);
          else {
            router.refresh();
            onClose();
          }
        });
      }}
    >
      <p className="w-full text-xs font-semibold uppercase tracking-wide text-muted">
        {t("eventHours")}
      </p>
      <label className="flex flex-col gap-1 text-xs font-medium">
        {t("start")}
        <input
          name="startTime"
          type="datetime-local"
          required
          defaultValue={toLocalInputValue(event.startTime)}
          className="rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        {t("end")}
        <input
          name="endTime"
          type="datetime-local"
          required
          defaultValue={toLocalInputValue(event.endTime)}
          className="rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg disabled:opacity-60"
      >
        <PendingLabel pending={pending} label={t("apply")} pendingLabel={t("saving")} />
      </button>
      {event.startTime && event.endTime && (
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted">
          {t("close")}
        </button>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
