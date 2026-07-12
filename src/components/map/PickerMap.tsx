"use client";

import { LeafletMap } from "./LeafletMap";
import { LocationPicker } from "./LocationPicker";
import type { LatLng } from "./types";

/** Small embedded map used in forms to pick a single position by tapping. */
export default function PickerMap({
  center,
  zoom,
  value,
  onPick,
}: {
  center: LatLng;
  zoom: number;
  value: LatLng | null;
  onPick: (position: LatLng) => void;
}) {
  return (
    <LeafletMap center={center} zoom={zoom} className="h-64 w-full rounded-2xl">
      <LocationPicker value={value} onPick={onPick} />
    </LeafletMap>
  );
}
