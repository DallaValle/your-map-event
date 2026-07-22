"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type L from "leaflet";
import { useMap } from "react-leaflet";
import { LeafletMap, type MapBounds } from "./LeafletMap";
import { PoiMarkers } from "./PoiMarkers";
import { GeolocateLayer, type GeoState } from "./GeolocateLayer";
import { CompassControl } from "./CompassControl";
import { FrozenView } from "./FrozenView";
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
 * Attendee screen: a full-bleed rotatable map framed by a top navigation bar
 * (team identity) and a bottom navigation bar (points list, locate, recenter).
 * The points list expands into a sheet above the bottom bar; selecting a point
 * flies the map there and opens its popup — unless the view is locked, in
 * which case the map stays put and only the details open.
 */
export default function PublicMap({
  center,
  zoom,
  bearing = 0,
  pois,
  maxBounds,
  team,
  eventName,
  chromeInsets,
}: {
  center: LatLng;
  zoom: number;
  /** The admin's saved default orientation. */
  bearing?: number;
  pois: PoiData[];
  maxBounds?: MapBounds | null;
  team: { name: string; logoUrl: string | null };
  /** Shown in the top bar alongside the team icon. */
  eventName: string;
  /**
   * Extra clearance (in rem) for the top and bottom bars, on top of the device
   * safe-area insets. Real devices supply their own insets; this is for
   * simulated chrome like the phone-preview frame, whose Dynamic Island and
   * rounded corners would otherwise clip the bars. Defaults to none.
   */
  chromeInsets?: { top?: number; bottom?: number };
}) {
  const topInset = chromeInsets?.top ?? 0;
  const bottomInset = chromeInsets?.bottom ?? 0;
  // Locked = the admin froze the attendee view to a fixed box; selecting a
  // point must reveal its details without moving the map.
  const locked = !!maxBounds;

  const [map, setMap] = useState<L.Map | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const [listOpen, setListOpen] = useState(false);
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const onGeoChange = useCallback((state: GeoState) => setGeo(state), []);

  function goToPoi(poi: PoiData) {
    setListOpen(false);
    if (!map) return;
    // Locked view: the frame is fixed, so don't fly or zoom — just open the
    // point's details in place (auto-pan is off while locked).
    if (locked) {
      markerRefs.current.get(poi.id)?.openPopup();
      return;
    }
    map.flyTo([poi.lat, poi.lng], Math.max(map.getZoom(), 18));
    // The marker may still be inside a cluster mid-flight; opening after the
    // fly-in (~0.8s) is reliable at popup zoom levels.
    window.setTimeout(() => markerRefs.current.get(poi.id)?.openPopup(), 900);
  }

  function locateMe() {
    if (!map || geo.status !== "active" || geo.lat == null || geo.lng == null) return;
    map.flyTo([geo.lat, geo.lng], Math.max(map.getZoom(), 17));
  }

  function recenter() {
    if (!map) return;
    if (maxBounds) {
      map.flyToBounds([
        [maxBounds.swLat, maxBounds.swLng],
        [maxBounds.neLat, maxBounds.neLng],
      ]);
    } else {
      map.flyTo([center.lat, center.lng], zoom);
    }
  }

  const navButton =
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium active:bg-black/5 dark:active:bg-white/10 disabled:opacity-40";

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Top navigation bar: event icon + name. In normal flow (not overlaying
          the map) so points near the top edge stay clickable and readable. */}
      <div
        className="z-[1000] shrink-0 border-b border-black/10 bg-white/95 dark:border-white/10 dark:bg-neutral-900/95"
        style={{ paddingTop: `calc(max(0.5rem, env(safe-area-inset-top)) + ${topInset}rem)` }}
      >
        <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-0.5">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-700/10 text-sm">📍</span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{eventName}</p>
            <p className="truncate text-[11px] leading-tight opacity-60">{team.name}</p>
          </div>
        </div>
      </div>

      {/* Map fills the space between the bars. */}
      <div className="relative min-h-0 flex-1">
        <LeafletMap
          center={center}
          zoom={zoom}
          bearing={bearing}
          maxBounds={maxBounds}
          rotatable
          className="h-full w-full"
        >
          <MapRefCapture onMap={setMap} />
          <PoiMarkers
            pois={pois}
            locked={locked}
            registerMarker={(id, marker) => {
              if (marker) markerRefs.current.set(id, marker);
              else markerRefs.current.delete(id);
            }}
          />
          <GeolocateLayer onChange={onGeoChange} />
          <CompassControl className="m-3" />
          {/* A locked attendee view is fully frozen: nothing the visitor does
              moves the map, so selecting a point only reveals its details. */}
          <FrozenView active={locked} />
        </LeafletMap>
      </div>

      {/* Points list: expands into a sheet above the bottom bar. */}
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
                <h2 className="text-lg font-bold">Points of interest ({pois.length})</h2>
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
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-700/10">{poi.icon ?? "📌"}</span>
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
              {pois.length === 0 && (
                <li className="py-6 text-center text-sm opacity-60">No points of interest yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Bottom navigation bar: points list, locate, recenter. */}
      <div
        className="z-[1000] shrink-0 border-t border-black/10 bg-white/95 dark:border-white/10 dark:bg-neutral-900/95"
        style={{ paddingBottom: `calc(max(0rem, env(safe-area-inset-bottom)) + ${bottomInset}rem)` }}
      >
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => setListOpen((open) => !open)}
            aria-expanded={listOpen}
            className={`${navButton} ${listOpen ? "text-teal-700 dark:text-teal-400" : ""}`}
          >
            <span className="text-xl" aria-hidden>📍</span>
            Points ({pois.length})
          </button>
          <button
            type="button"
            onClick={locateMe}
            disabled={geo.status !== "active"}
            title={
              geo.status === "denied"
                ? "Location access denied"
                : geo.status === "unavailable"
                  ? "Location unavailable"
                  : "Show my location"
            }
            className={navButton}
          >
            <span className="text-xl" aria-hidden>🧭</span>
            Locate
          </button>
          <button type="button" onClick={recenter} className={navButton}>
            <span className="text-xl" aria-hidden>🎯</span>
            Recenter
          </button>
        </div>
      </div>
    </div>
  );
}
