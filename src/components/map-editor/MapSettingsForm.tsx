"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMapAction, deleteMapAction } from "@/actions/maps";
import { PickerMapCanvas } from "@/components/map/MapCanvas";
import { GeocodeSearch } from "@/components/map/GeocodeSearch";
import type { MapFocus } from "@/components/map/PickerMap";
import type { MapBounds } from "@/components/map/LeafletMap";
import type { LatLng } from "@/components/map/types";
import type { EditorMapData } from "./MapEditor";

export function MapSettingsForm({ map }: { map: EditorMapData }) {
  const router = useRouter();
  const [center, setCenter] = useState<LatLng>({
    lat: map.centerLat,
    lng: map.centerLng,
  });
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(
    map.boundsSWLat != null
      ? {
          swLat: map.boundsSWLat,
          swLng: map.boundsSWLng!,
          neLat: map.boundsNELat!,
          neLng: map.boundsNELng!,
        }
      : null,
  );
  const [deletePending, startDelete] = useTransition();

  const [state, formAction, pending] = useActionState(
    async (prev: Parameters<typeof updateMapAction>[1], formData: FormData) => {
      const result = await updateMapAction(map.id, prev, formData);
      if (result?.ok) router.refresh();
      return result;
    },
    null,
  );

  function handleDelete() {
    if (!confirm(`Delete the map "${map.name}" and all its points? This cannot be undone.`)) {
      return;
    }
    startDelete(async () => {
      await deleteMapAction(map.id); // redirects to /dashboard on success
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Map name
        <input
          name="name"
          required
          minLength={2}
          defaultValue={map.name}
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Description
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={map.description ?? ""}
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Event location</span>
        <GeocodeSearch
          onSelect={(result) => {
            setFocus(result.bounds ? { ...result, bounds: result.bounds } : result);
            setCenter({ lat: result.lat, lng: result.lng });
          }}
        />
        <span className="text-xs opacity-60">
          Tap the map to move the center. Use the in-map button to set the
          borders attendees are limited to, then drag the round corner handles
          to fine-tune them.
        </span>
        <PickerMapCanvas
          center={center}
          zoom={map.zoom}
          value={center}
          onPick={setCenter}
          focus={focus}
          bounds={bounds}
          onCaptureBounds={setBounds}
        />
        {bounds ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-teal-700/10 px-3 py-2 text-sm">
            <span className="text-teal-700 dark:text-teal-400">✓ Borders set</span>
            <button
              type="button"
              onClick={() => setBounds(null)}
              className="font-semibold text-red-600 dark:text-red-400"
            >
              Clear borders
            </button>
          </div>
        ) : (
          <p className="text-sm opacity-60">No borders — attendees can pan freely.</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Location name
        <input
          name="centerName"
          required
          defaultValue={map.centerName}
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Default zoom ({map.zoom})
        <input
          name="zoom"
          type="range"
          min={12}
          max={19}
          defaultValue={map.zoom}
          className="accent-teal-700"
        />
      </label>

      <input type="hidden" name="centerLat" value={center.lat} />
      <input type="hidden" name="centerLng" value={center.lng} />
      <input type="hidden" name="boundsSWLat" value={bounds?.swLat ?? ""} />
      <input type="hidden" name="boundsSWLng" value={bounds?.swLng ?? ""} />
      <input type="hidden" name="boundsNELat" value={bounds?.neLat ?? ""} />
      <input type="hidden" name="boundsNELng" value={bounds?.neLng ?? ""} />

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-teal-700/10 px-3 py-2 text-sm text-teal-700 dark:text-teal-400">
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={deletePending}
        className="rounded-xl border border-red-300 px-6 py-3.5 font-semibold text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
      >
        {deletePending ? "Deleting…" : "Delete this map"}
      </button>
    </form>
  );
}
