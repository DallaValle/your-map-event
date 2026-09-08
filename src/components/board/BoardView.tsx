"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteActivityAction } from "@/actions/activities";
import { activityTypeMeta, isScheduled, type ActivityDTO, type SchedulePoi } from "@/lib/activity";
import { formatRange } from "@/lib/schedule-time";
import { ActivityDialog, type ActivityDialogState } from "@/components/schedule/ActivityDialog";

export function BoardView({
  eventId,
  eventName,
  activities,
  pois,
  isAdmin,
}: {
  eventId: string;
  eventName: string;
  activities: ActivityDTO[];
  pois: SchedulePoi[];
  isAdmin: boolean;
}) {
  const [dialog, setDialog] = useState<ActivityDialogState | null>(null);
  const ordered = [...activities].sort((a, b) => {
    if (isScheduled(a) && isScheduled(b)) {
      return new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime();
    }
    if (isScheduled(a)) return -1;
    if (isScheduled(b)) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Board</h1>
          <p className="text-sm opacity-70">
            Running order for {eventName}. The timeline is the same activities,
            laid out on the map locations.
          </p>
        </div>
        <Link
          href="/dashboard/schedule"
          className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Open timeline
        </Link>
      </header>

      {isAdmin && (
        <button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className="self-start rounded-xl border border-dashed border-black/20 px-4 py-3 text-sm font-semibold dark:border-white/20"
        >
          + Add activity
        </button>
      )}

      {ordered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 px-5 py-10 text-center text-sm opacity-60 dark:border-white/15">
          {isAdmin ? "No activities yet. Add the first one above." : "No activities on the board yet."}
        </p>
      ) : (
        <ul aria-label="Running order" className="divide-y divide-black/10 overflow-hidden rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
          {ordered.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              isAdmin={isAdmin}
              onEdit={() => setDialog({ mode: "edit", activity })}
            />
          ))}
        </ul>
      )}

      {isAdmin && dialog && (
        <ActivityDialog
          eventId={eventId}
          pois={pois}
          state={dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function ActivityRow({
  activity,
  isAdmin,
  onEdit,
}: {
  activity: ActivityDTO;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const meta = activityTypeMeta(activity.type);

  async function remove() {
    if (!confirm(`Delete "${activity.name}"? This cannot be undone.`)) return;
    await deleteActivityAction(activity.id);
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{activity.name}</h3>
        <p className="mt-0.5 text-sm opacity-60">
          <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>
            {meta.label}
          </span>
          {isScheduled(activity)
            ? `${formatRange(activity.startTime!, activity.endTime!)}${activity.poiTitle ? ` · ${activity.poiTitle}` : ""}`
            : "Unscheduled"}
        </p>
      </div>
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold dark:border-white/20"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 dark:border-red-900 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
