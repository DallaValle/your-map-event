"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import {
  createActivityAction,
  deleteActivityAction,
  updateActivityAction,
} from "@/actions/activities";
import { ACTIVITY_TYPES, type ActivityDTO, type SchedulePoi } from "@/lib/activity";
import { toLocalInputValue } from "@/lib/schedule-time";
import type { ActionState } from "@/actions/types";
import { PendingLabel } from "@/components/ui/Spinner";

const inputClass =
  "rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-brand dark:border-white/20 dark:bg-white/5";

export type ActivityDialogState =
  | { mode: "create"; poiId?: string | null; startTime?: Date | null; endTime?: Date | null }
  | { mode: "edit"; activity: ActivityDTO };

export function ActivityDialog({
  eventId,
  pois,
  state,
  onClose,
}: {
  eventId: string;
  pois: SchedulePoi[];
  state: ActivityDialogState;
  onClose: () => void;
}) {
  const t = useTranslations("activityDialog");
  const typeLabel = useTranslations("activityTypes");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = state.mode === "edit";
  const activity = isEdit ? state.activity : null;

  const bound = isEdit
    ? updateActivityAction.bind(null, activity!.id)
    : createActivityAction.bind(null, eventId);

  const [formState, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await bound(prev, formData);
      if (result?.ok) {
        router.refresh();
        onClose();
      }
      return result;
    },
    null,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const defaultStart =
    isEdit ? activity!.startTime : state.startTime ? state.startTime.toISOString() : null;
  const defaultEnd =
    isEdit ? activity!.endTime : state.endTime ? state.endTime.toISOString() : null;
  const defaultPoi = isEdit ? activity!.poiId : (state.poiId ?? "");

  async function handleDelete() {
    if (!activity) return;
    if (!confirm(t("confirmDelete", { name: activity.name }))) return;
    await deleteActivityAction(activity.id);
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-dialog-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-950"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="activity-dialog-title" className="text-lg font-bold">
            {isEdit ? t("editTitle") : t("addTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex size-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("name")}
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={activity?.name ?? ""}
              placeholder={t("namePlaceholder")}
              autoFocus
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("type")}
            <select
              name="type"
              defaultValue={activity?.type ?? "performance"}
              className={inputClass}
            >
              {ACTIVITY_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {typeLabel(type.id)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("location")}
            <select name="poiId" defaultValue={defaultPoi ?? ""} className={inputClass}>
              <option value="">{t("unassigned")}</option>
              {pois.map((poi) => (
                <option key={poi.id} value={poi.id}>
                  {poi.icon ? `${poi.icon} ` : ""}
                  {poi.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("start")}
              <input
                name="startTime"
                type="datetime-local"
                defaultValue={toLocalInputValue(defaultStart)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("end")}
              <input
                name="endTime"
                type="datetime-local"
                defaultValue={toLocalInputValue(defaultEnd)}
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-xs opacity-60">
            {t("hint")}
          </p>

          {formState && !formState.ok && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {formState.error}
            </p>
          )}

          <div className="mt-1 flex gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 dark:border-red-900 dark:text-red-400"
              >
                {t("delete")}
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="ml-auto rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg disabled:opacity-60"
            >
              <PendingLabel
                pending={pending}
                label={isEdit ? t("save") : t("addTitle")}
                pendingLabel={t("saving")}
              />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
