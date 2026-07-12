"use client";

import { useActionState, useState } from "react";
import { createMapAction } from "@/actions/maps";
import { PickerMapCanvas } from "@/components/map/MapCanvas";
import type { LatLng } from "@/components/map/types";

// Neutral default viewport (central Europe) until the admin taps a location.
const FALLBACK_CENTER: LatLng = { lat: 47.3769, lng: 8.5417 };

export function NewMapForm({ teamId }: { teamId: string }) {
  const [state, formAction, pending] = useActionState(
    createMapAction.bind(null, teamId),
    null,
  );
  const [center, setCenter] = useState<LatLng | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Map name
        <input
          name="name"
          required
          minLength={2}
          placeholder="Summer Festival 2026"
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Description <span className="font-normal opacity-50">(optional)</span>
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Event location</span>
        <span className="text-xs opacity-60">
          Tap the map to set the central point of your event.
        </span>
        <PickerMapCanvas
          center={center ?? FALLBACK_CENTER}
          zoom={center ? 15 : 5}
          value={center}
          onPick={setCenter}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Location name
        <input
          name="centerName"
          required
          placeholder="Lakeside Park, Main Entrance"
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <input type="hidden" name="centerLat" value={center?.lat ?? ""} />
      <input type="hidden" name="centerLng" value={center?.lng ?? ""} />

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !center}
        className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
      >
        {pending ? "Creating…" : center ? "Create map" : "Pick a location first"}
      </button>
    </form>
  );
}
