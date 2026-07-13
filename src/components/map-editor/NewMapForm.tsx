"use client";

import { useActionState, useState } from "react";
import { createMapAction } from "@/actions/maps";
import { PickerMapCanvas } from "@/components/map/MapCanvas";
import { GeocodeSearch } from "@/components/map/GeocodeSearch";
import type { MapFocus } from "@/components/map/PickerMap";
import type { MapBounds } from "@/components/map/LeafletMap";
import type { LatLng } from "@/components/map/types";

// Neutral default viewport (central Europe) until a place is chosen.
const FALLBACK_CENTER: LatLng = { lat: 47.3769, lng: 8.5417 };

export function NewMapForm({ teamId }: { teamId: string }) {
  const [state, formAction, pending] = useActionState(
    createMapAction.bind(null, teamId),
    null,
  );
  const [center, setCenter] = useState<LatLng | null>(null);
  const [centerName, setCenterName] = useState("");
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [showBorders, setShowBorders] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5">
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

      {/* 1. Find the place, 2. fine-tune with a tap. */}
      <section className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-semibold">Event location</h2>
        <GeocodeSearch
          onSelect={(result) => {
            setFocus(result.bounds ? { ...result, bounds: result.bounds } : result);
            setCenter({ lat: result.lat, lng: result.lng });
            // Prefill a friendly name from the first segment of the address.
            if (!centerName) setCenterName(result.label.split(",")[0] ?? "");
          }}
        />
        <p className="text-xs opacity-60">
          Then tap the map to place the exact center of your event.
        </p>
        <PickerMapCanvas
          center={center ?? FALLBACK_CENTER}
          zoom={center ? 15 : 5}
          value={center}
          onPick={setCenter}
          focus={focus}
          bounds={bounds}
          onCaptureBounds={showBorders ? setBounds : undefined}
        />
        {center && (
          <p className="text-xs opacity-60">
            Center: {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Location name
          <input
            name="centerName"
            required
            value={centerName}
            onChange={(e) => setCenterName(e.target.value)}
            placeholder="Lakeside Park, Main Entrance"
            className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
          />
        </label>
      </section>

      {/* 3. Optionally restrict how far attendees can pan. */}
      <section className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 dark:border-white/15">
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          Map borders <span className="font-normal opacity-50">(optional)</span>
          <input
            type="checkbox"
            checked={showBorders}
            onChange={(e) => {
              setShowBorders(e.target.checked);
              if (!e.target.checked) setBounds(null);
            }}
            className="size-5 accent-teal-700"
          />
        </label>
        {showBorders && (
          <>
            <p className="text-xs opacity-60">
              Pan and zoom the map above until the whole event area is visible,
              then tap <strong>“Use current view as borders”</strong> on the
              map. Drag the round corner handles to fine-tune the box —
              attendees won’t be able to pan outside it.
            </p>
            {bounds ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-teal-700/10 px-3 py-2 text-sm">
                <span className="text-teal-700 dark:text-teal-400">
                  ✓ Borders set
                </span>
                <button
                  type="button"
                  onClick={() => setBounds(null)}
                  className="font-semibold text-red-600 dark:text-red-400"
                >
                  Clear
                </button>
              </div>
            ) : (
              <p className="text-sm opacity-60">No borders set yet.</p>
            )}
          </>
        )}
      </section>

      <input type="hidden" name="centerLat" value={center?.lat ?? ""} />
      <input type="hidden" name="centerLng" value={center?.lng ?? ""} />
      <input type="hidden" name="boundsSWLat" value={bounds?.swLat ?? ""} />
      <input type="hidden" name="boundsSWLng" value={bounds?.swLng ?? ""} />
      <input type="hidden" name="boundsNELat" value={bounds?.neLat ?? ""} />
      <input type="hidden" name="boundsNELng" value={bounds?.neLng ?? ""} />

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
