"use client";

import { Marker, useMapEvents } from "react-leaflet";
import type { LatLng } from "./types";

/**
 * Tap-to-pick position control: reports every map click to the parent and
 * previews the currently picked spot with a marker.
 */
export function LocationPicker({
  value,
  onPick,
}: {
  value: LatLng | null;
  onPick: (position: LatLng) => void;
}) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return value ? <Marker position={[value.lat, value.lng]} /> : null;
}
