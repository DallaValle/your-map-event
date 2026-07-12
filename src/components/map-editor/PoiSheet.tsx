"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createPoiAction, updatePoiAction, deletePoiAction } from "@/actions/pois";
import { ImageField } from "@/components/upload/ImageField";
import type { LatLng, PoiData } from "@/components/map/types";
import type { ActionState } from "@/actions/types";

export type PoiSheetMode =
  | { type: "create"; position: LatLng }
  | { type: "edit"; poi: PoiData };

/**
 * Bottom sheet for creating/editing a POI. The position comes from the map
 * (tap location or existing POI) and travels as hidden inputs so the whole
 * thing is a regular form posting to a server action.
 */
export function PoiSheet({
  mapId,
  mode,
  uploadsEnabled,
  onClose,
}: {
  mapId: string;
  mode: PoiSheetMode;
  uploadsEnabled: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = mode.type === "edit";
  const position = isEdit ? { lat: mode.poi.lat, lng: mode.poi.lng } : mode.position;

  const action = isEdit
    ? updatePoiAction.bind(null, mode.poi.id)
    : createPoiAction.bind(null, mapId);

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result?.ok) {
        router.refresh();
        onClose();
      }
      return result;
    },
    null,
  );

  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm(`Delete "${mode.poi.title}"?`)) return;
    setDeleting(true);
    const result = await deletePoiAction(mode.poi.id);
    setDeleting(false);
    if (result?.ok) {
      router.refresh();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div className="relative max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:bg-neutral-950">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/20 dark:bg-white/25" />

        <h2 className="mb-4 text-lg font-bold">
          {isEdit ? "Edit point of interest" : "New point of interest"}
        </h2>

        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title
            <input
              name="title"
              required
              maxLength={80}
              defaultValue={isEdit ? mode.poi.title : ""}
              placeholder="Main Stage"
              className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Description <span className="font-normal opacity-50">(optional)</span>
            <textarea
              name="description"
              rows={3}
              maxLength={500}
              defaultValue={isEdit ? (mode.poi.description ?? "") : ""}
              className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
            />
          </label>

          <ImageField
            name="imageUrl"
            label="Photo (optional)"
            endpoint="poiImage"
            uploadsEnabled={uploadsEnabled}
            defaultValue={isEdit ? mode.poi.imageUrl : null}
          />

          <p className="text-xs opacity-60">
            Position: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </p>
          <input type="hidden" name="lat" value={position.lat} />
          <input type="hidden" name="lng" value={position.lng} />

          {state && !state.ok && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          )}

          <div className="flex gap-3">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl border border-red-300 px-4 py-3.5 font-semibold text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
              >
                {deleting ? "…" : "Delete"}
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
            >
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add point"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
