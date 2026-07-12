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
 * POI form as a TOP overlay so the marker being placed/edited stays visible
 * on the map below (also plays nicer with the on-screen keyboard). The
 * coordinates are editable — tap position is just the starting value — and
 * every change is reported so the map's draft marker follows live.
 */
export function PoiSheet({
  mapId,
  mode,
  uploadsEnabled,
  onClose,
  onPositionChange,
}: {
  mapId: string;
  mode: PoiSheetMode;
  uploadsEnabled: boolean;
  onClose: () => void;
  onPositionChange?: (position: LatLng) => void;
}) {
  const router = useRouter();
  const isEdit = mode.type === "edit";
  const initial = isEdit
    ? { lat: mode.poi.lat, lng: mode.poi.lng }
    : mode.position;

  const [lat, setLat] = useState(initial.lat.toFixed(6));
  const [lng, setLng] = useState(initial.lng.toFixed(6));

  function updateCoord(which: "lat" | "lng", raw: string) {
    if (which === "lat") setLat(raw);
    else setLng(raw);
    const parsedLat = parseFloat(which === "lat" ? raw : lat);
    const parsedLng = parseFloat(which === "lng" ? raw : lng);
    if (
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      Math.abs(parsedLat) <= 90 &&
      Math.abs(parsedLng) <= 180
    ) {
      onPositionChange?.({ lat: parsedLat, lng: parsedLng });
    }
  }

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
    <div className="fixed inset-0 z-[1100] flex flex-col">
      <div className="relative max-h-[70dvh] overflow-y-auto rounded-b-3xl bg-white px-5 pb-5 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-2xl dark:bg-neutral-950">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {isEdit ? "Edit point" : "New point"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full bg-black/5 text-lg dark:bg-white/10"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title
            <input
              name="title"
              required
              maxLength={80}
              defaultValue={isEdit ? mode.poi.title : ""}
              placeholder="Main Stage"
              autoFocus={!isEdit}
              className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Description <span className="font-normal opacity-50">(optional)</span>
            <textarea
              name="description"
              rows={2}
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

          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-medium">
              Position{" "}
              <span className="font-normal opacity-50">
                (from map tap — or type exact coordinates)
              </span>
            </legend>
            <div className="flex gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs opacity-70">
                Latitude
                <input
                  name="lat"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  required
                  value={lat}
                  onChange={(e) => updateCoord("lat", e.target.value)}
                  className="rounded-xl border border-black/15 px-3 py-2.5 text-base text-black outline-teal-700 dark:border-white/20 dark:bg-white/5 dark:text-white"
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs opacity-70">
                Longitude
                <input
                  name="lng"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  required
                  value={lng}
                  onChange={(e) => updateCoord("lng", e.target.value)}
                  className="rounded-xl border border-black/15 px-3 py-2.5 text-base text-black outline-teal-700 dark:border-white/20 dark:bg-white/5 dark:text-white"
                />
              </label>
            </div>
          </fieldset>

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

      {/* The rest of the screen stays transparent so the draft marker is
          visible; tapping it closes the sheet. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1"
      />
    </div>
  );
}
