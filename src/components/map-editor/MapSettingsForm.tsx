"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMapAction, deleteMapAction } from "@/actions/maps";
import { PickerMapCanvas } from "@/components/map/MapCanvas";
import type { LatLng } from "@/components/map/types";
import type { EditorMapData } from "./MapEditor";

export function MapSettingsForm({ map }: { map: EditorMapData }) {
  const router = useRouter();
  const [center, setCenter] = useState<LatLng>({
    lat: map.centerLat,
    lng: map.centerLng,
  });
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

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Event location</span>
        <span className="text-xs opacity-60">Tap to move the center.</span>
        <PickerMapCanvas center={center} zoom={map.zoom} value={center} onPick={setCenter} />
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
