"use client";

import { useEffect, useState } from "react";
import { Circle, CircleMarker, useMap } from "react-leaflet";
import { useMapControlRef } from "./control-utils";

type GeoState =
  | { status: "idle" | "denied" | "unavailable" }
  | { status: "active"; lat: number; lng: number; accuracy: number };

/**
 * Live user position: blue dot + accuracy circle, with a recenter button.
 * Geolocation needs HTTPS (or localhost) and user consent; every failure
 * mode degrades to a quiet hint instead of breaking the map.
 */
export function GeolocateControl() {
  const map = useMap();
  const controlRef = useMapControlRef();
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

  return (
    <>
      {geo.status === "active" && (
        <>
          <Circle
            center={[geo.lat, geo.lng]}
            radius={geo.accuracy}
            pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.08 }}
          />
          <CircleMarker
            center={[geo.lat, geo.lng]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: "#2563eb",
              fillOpacity: 1,
            }}
          />
        </>
      )}

      {/* Floating recenter button; kept inside the map so it can use flyTo. */}
      <div className="leaflet-bottom leaflet-right">
        <div ref={controlRef} className="leaflet-control m-3 mb-6">
          <button
            type="button"
            aria-label="Show my location"
            onClick={() => {
              if (geo.status === "active") {
                map.flyTo([geo.lat, geo.lng], Math.max(map.getZoom(), 17));
              }
            }}
            className={`flex size-12 items-center justify-center rounded-full bg-white text-xl shadow-lg dark:bg-neutral-900 ${
              geo.status === "active" ? "" : "opacity-50"
            }`}
          >
            🧭
          </button>
          {(geo.status === "denied" || geo.status === "unavailable") && (
            <p className="mt-1 max-w-32 rounded-lg bg-white/90 px-2 py-1 text-center text-[10px] leading-tight shadow dark:bg-neutral-900/90">
              {geo.status === "denied"
                ? "Location access denied"
                : "Location unavailable"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
