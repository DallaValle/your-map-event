"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPoiAction, updatePoiAction, deletePoiAction } from "@/actions/pois";
import { ImageField } from "@/components/upload/ImageField";
import { POI_ICONS, type LatLng, type PoiData } from "@/components/map/types";
import type { ActionState } from "@/actions/types";

export type PoiSheetMode =
  | { type: "create" }
  | { type: "edit"; poi: PoiData };

/**
 * Compact floating POI form. It deliberately does NOT cover the map: while
 * it's open the admin can keep tapping the map to reposition the point
 * (the parent feeds taps back in through the controlled `position` prop),
 * or type exact coordinates here.
 */
export function PoiSheet({
  mapId,
  mode,
  position,
  uploadsEnabled,
  onClose,
  onPositionChange,
}: {
  mapId: string;
  mode: PoiSheetMode;
  position: LatLng;
  uploadsEnabled: boolean;
  onClose: () => void;
  onPositionChange: (position: LatLng) => void;
}) {
  const router = useRouter();
  const isEdit = mode.type === "edit";

  const [lat, setLat] = useState(position.lat.toFixed(6));
  const [lng, setLng] = useState(position.lng.toFixed(6));
  const [icon, setIcon] = useState(isEdit ? (mode.poi.icon ?? "📍") : "📍");

  // Map taps update `position` from outside — mirror them into the inputs.
  // Manual typing round-trips through onPositionChange to the same value,
  // so this only rewrites the fields when the map actually moved the point.
  useEffect(() => {
    if (parseFloat(lat) !== position.lat) setLat(position.lat.toFixed(6));
    if (parseFloat(lng) !== position.lng) setLng(position.lng.toFixed(6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

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
      onPositionChange({ lat: parsedLat, lng: parsedLng });
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
  // The description is always shown (every point should have one); the photo
  // stays optional behind a toggle, pre-opened when the point already has one.
  const [showPhoto, setShowPhoto] = useState(isEdit && !!mode.poi.imageUrl);

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

  const inputClass =
    "rounded-xl border border-black/15 px-3 py-2.5 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5";

  return (
    <div className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[1100] mx-auto max-w-md">
      <div className="max-h-[82dvh] overflow-y-auto rounded-2xl bg-white/97 p-4 shadow-2xl backdrop-blur dark:bg-neutral-950/97">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold">
            {isEdit ? "Edit point" : "New point"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-xs opacity-60">
          Tap the map to move the point, or type exact coordinates.
        </p>

        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="title"
            required
            maxLength={80}
            defaultValue={isEdit ? mode.poi.title : ""}
            placeholder="Title (e.g. Main Stage)"
            aria-label="Title"
            autoFocus={!isEdit}
            className={inputClass}
          />

          {/* Marker icon */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium opacity-70">Marker icon</span>
            <div className="flex flex-wrap gap-1">
              {POI_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Use ${emoji} as marker icon`}
                  aria-pressed={icon === emoji}
                  onClick={() => setIcon(emoji)}
                  className={`flex size-9 items-center justify-center rounded-full border text-lg ${
                    icon === emoji
                      ? "border-teal-700 bg-teal-700/15"
                      : "border-black/10 dark:border-white/15"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input type="hidden" name="icon" value={icon} />
          </div>

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
                className={`${inputClass} text-black dark:text-white`}
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
                className={`${inputClass} text-black dark:text-white`}
              />
            </label>
          </div>

          {/* Description: always shown so every point gets one. */}
          <label className="flex flex-col gap-1 text-xs font-medium opacity-70">
            Description
            <textarea
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={isEdit ? (mode.poi.description ?? "") : ""}
              placeholder="What is this point? Shown to attendees on the map."
              aria-label="Description"
              className={`${inputClass} font-normal`}
            />
          </label>

          {/* Photo stays optional to keep the card compact. */}
          {showPhoto ? (
            <ImageField
              name="imageUrl"
              label="Photo (optional)"
              endpoint="poiImage"
              uploadsEnabled={uploadsEnabled}
              defaultValue={isEdit ? mode.poi.imageUrl : null}
            />
          ) : (
            <>
              {/* Keep the value submitted even while the field is collapsed. */}
              <input
                type="hidden"
                name="imageUrl"
                value={isEdit ? (mode.poi.imageUrl ?? "") : ""}
                readOnly
              />
              <button
                type="button"
                onClick={() => setShowPhoto(true)}
                className="self-start text-sm font-semibold text-teal-700 dark:text-teal-400"
              >
                + Add photo
              </button>
            </>
          )}

          {state && !state.ok && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          )}

          <div className="flex gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl border border-red-300 px-4 py-3 font-semibold text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
              >
                {deleting ? "…" : "Delete"}
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
            >
              {pending ? "Saving…" : isEdit ? "Save" : "Add point"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
