"use client";

import { useEffect, useState } from "react";
import { Circle, CircleMarker } from "react-leaflet";

export type GeoStatus = "idle" | "denied" | "unavailable" | "active";

export interface GeoState {
  status: GeoStatus;
  lat?: number;
  lng?: number;
  accuracy?: number;
}

/**
 * Live user position layer: blue dot + accuracy circle. It watches the
 * device location and reports state up via `onChange` so the bottom nav's
 * "Locate" action can recenter the map. Geolocation needs HTTPS (or
 * localhost) and consent; every failure mode degrades to a quiet status.
 */
export function GeolocateLayer({ onChange }: { onChange?: (state: GeoState) => void }) {
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
