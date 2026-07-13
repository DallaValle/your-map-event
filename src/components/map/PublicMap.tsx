"use client";

import { useEffect, useRef, useState } from "react";
import type L from "leaflet";
import { useMap } from "react-leaflet";
import { LeafletMap, type MapBounds } from "./LeafletMap";
import { PoiMarkers } from "./PoiMarkers";
import { GeolocateControl } from "./GeolocateControl";
import { CompassControl } from "./CompassControl";
import type { LatLng, PoiData } from "./types";

/** Hands the Leaflet map instance to overlays living outside the container. */
function MapRefCapture({ onMap }: { onMap: (map: L.Map | null) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
    return () => onMap(null);
  }, [map, onMap]);
  return null;
}

/**
 * Attendee screen: full-screen rotatable map with the team identity and a
 * single-item menu on top, plus an always-visible collapsed list of all
 * points that expands into a bottom sheet. Selecting a point flies the map
 * there and opens its popup.
 */
export default function PublicMap({
  center,
  zoom,
  pois,
  maxBounds,
  team,
}: {
  center: LatLng;
  zoom: number;
  pois: PoiData[];
  maxBounds?: MapBounds | null;
  team: { name: string; logoUrl: string | null };
}) {
  const [map, setMap] = useState<L.Map | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const [menuOpen, setMenuOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  function goToPoi(poi: PoiData) {
    setListOpen(false);
    setMenuOpen(false);
    if (!map) return;
    map.flyTo([poi.lat, poi.lng], Math.max(map.getZoom(), 18));
    // The marker may still be inside a cluster mid-flight; opening after the
    // fly-in (~0.8s) is reliable at popup zoom levels.
    window.setTimeout(() => markerRefs.current.get(poi.id)?.openPopup(), 900);
  }

  return (
    <div className="relative h-dvh w-full">
      <LeafletMap
        center={center}
        zoom={zoom}
        maxBounds={maxBounds}
        rotatable
        className="h-full w-full"
      >
        <MapRefCapture onMap={setMap} />
        <PoiMarkers
          pois={pois}
          registerMarker={(id, marker) => {
            if (marker) markerRefs.current.set(id, marker);
            else markerRefs.current.delete(id);
          }}
        />
        <GeolocateControl />
        <CompassControl />
      </LeafletMap>

      {/* Top bar: team identity + menu. */}
      <div className="absolute inset-x-0 top-0 z-[1000] flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-white/95 py-1.5 pl-1.5 pr-4 shadow-lg backdrop-blur dark:bg-neutral-900/95">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-teal-700/10 text-sm">📍</span>
          )}
          <span className="truncate text-sm font-semibold">{team.name}</span>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex size-11 items-center justify-center rounded-full bg-white/95 text-xl shadow-lg backdrop-blur dark:bg-neutral-900/95"
          >
            ☰
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-13 w-48 overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-neutral-900">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setListOpen(true);
                }}
                className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-sm font-medium active:bg-black/5 dark:active:bg-white/10"
              >
                📌 All points
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Collapsed points list: always visible, expands into a sheet. */}
      {pois.length > 0 && !listOpen && (
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-20 z-[1000] flex items-center justify-between rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:bg-neutral-900/95"
        >
          <span className="text-sm font-semibold">
            Points of interest ({pois.length})
          </span>
          <span aria-hidden className="opacity-50">
            ▲
          </span>
        </button>
      )}

      {listOpen && (
        <div className="absolute inset-0 z-[1100] flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close list"
            onClick={() => setListOpen(false)}
            className="flex-1 bg-black/30"
          />
          <div className="max-h-[65dvh] overflow-y-auto rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-neutral-950">
            <div className="sticky top-0 bg-white/95 px-5 pb-2 pt-3 backdrop-blur dark:bg-neutral-950/95">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/20 dark:bg-white/25" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  Points of interest ({pois.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setListOpen(false)}
                  aria-label="Collapse list"
                  className="flex size-9 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                >
                  ▼
                </button>
              </div>
            </div>
            <ul className="divide-y divide-black/10 px-5 dark:divide-white/15">
              {pois.map((poi) => (
                <li key={poi.id}>
                  <button
                    type="button"
                    onClick={() => goToPoi(poi)}
                    className="flex w-full items-center gap-3 py-3 text-left active:bg-black/5 dark:active:bg-white/10"
                  >
                    {poi.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poi.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-700/10">📌</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{poi.title}</p>
                      {poi.description && (
                        <p className="truncate text-xs opacity-60">{poi.description}</p>
                      )}
                    </div>
                    <span aria-hidden className="text-sm opacity-40">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
