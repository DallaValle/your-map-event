"use client";

import { useEffect } from "react";
import { PublicMapCanvas } from "@/components/map/MapCanvas";
import type { MapBounds } from "@/components/map/LeafletMap";
import type { LatLng, PoiData } from "@/components/map/types";

/**
 * Full-screen modal that drops the live attendee view inside an iPhone
 * frame, so an admin can see exactly how the map will look on a phone
 * without publishing or leaving the editor. It renders the real
 * PublicMap with the editor's current (possibly unsaved) framing.
 */
export function PhonePreview({
  center,
  zoom,
  bearing,
  pois,
  bounds,
  team,
  onClose,
}: {
  center: LatLng;
  zoom: number;
  bearing: number;
  pois: PoiData[];
  bounds: MapBounds | null;
  team: { name: string; logoUrl: string | null };
  onClose: () => void;
}) {
  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Attendee preview"
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-4 bg-black/70 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/15 text-xl text-white backdrop-blur transition hover:bg-white/25"
      >
        ✕
      </button>

      <p className="text-sm font-medium text-white/80">
        How attendees will see it on their phone
      </p>

      {/* iPhone frame. Tapping inside must not bubble up and close the modal. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative aspect-[390/844] h-[min(80dvh,760px)] rounded-[3rem] border-[11px] border-neutral-800 bg-neutral-800 shadow-2xl ring-1 ring-black/40"
      >
        {/* Dynamic Island */}
        <div className="pointer-events-none absolute left-1/2 top-2 z-[10] h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        {/* Screen */}
        <div className="h-full w-full overflow-hidden rounded-[2.15rem] bg-neutral-100 dark:bg-neutral-900">
          <PublicMapCanvas
            center={center}
            zoom={zoom}
            bearing={bearing}
            pois={pois}
            maxBounds={bounds}
            team={team}
          />
        </div>
      </div>
    </div>
  );
}
