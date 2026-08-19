"use client";

import { useEffect, useState } from "react";
import { Circle, CircleMarker } from "react-leaflet";
import type { MapBounds } from "./LeafletMap";

export type GeoStatus = "idle" | "denied" | "unavailable" | "active";

export interface GeoState {
  status: GeoStatus;
  lat?: number;
  lng?: number;
  accuracy?: number;
}

export function isInsideBounds(lat: number, lng: number, bounds: MapBounds): boolean {
  const south = Math.min(bounds.swLat, bounds.neLat);
  const north = Math.max(bounds.swLat, bounds.neLat);
  const west = Math.min(bounds.swLng, bounds.neLng);
  const east = Math.max(bounds.swLng, bounds.neLng);
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

/**
 * Live user position layer: blue dot + accuracy circle. It watches the
 * device location and reports state up via `onChange` so the bottom nav's
 * "Locate" action can recenter the map. Geolocation needs HTTPS (or
 * localhost) and consent; every failure mode degrades to a quiet status.
 *
 * The marker is only drawn when the user is inside the event borders. Drawing
 * it while they are outside would clamp to the edge and look like they are in.
 */
export function GeolocateLayer({
  onChange,
  maxBounds,
}: {
  onChange?: (state: GeoState) => void;
  maxBounds?: MapBounds | null;
}) {
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeo({ status: "unavailable" });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) =>
        setGeo({
          status: "active",
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        }),
      (error) =>
        setGeo({
          status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        }),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    onChange?.(geo);
  }, [geo, onChange]);

  if (geo.status !== "active" || geo.lat == null || geo.lng == null) return null;
  if (maxBounds && !isInsideBounds(geo.lat, geo.lng, maxBounds)) return null;

  return (
    <>
      <Circle
        center={[geo.lat, geo.lng]}
        radius={geo.accuracy ?? 0}
        pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.08 }}
      />
      <CircleMarker
        center={[geo.lat, geo.lng]}
        radius={7}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}
      />
    </>
  );
}
