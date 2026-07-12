"use client";

import { useMemo, useState } from "react";
import { useMap } from "react-leaflet";
import type { PoiData } from "./types";

/**
 * Floating search box over the map. POI lists are event-scale (tens to a few
 * hundred entries), so filtering client-side is instant and works offline.
 */
export function PoiSearch({ pois }: { pois: PoiData[] }) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pois
      .filter(
        (poi) =>
          poi.title.toLowerCase().includes(q) ||
          poi.description?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, pois]);

  function select(poi: PoiData) {
    setQuery("");
    setOpen(false);
    map.flyTo([poi.lat, poi.lng], Math.max(map.getZoom(), 18));
  }

  return (
    <div className="leaflet-top leaflet-left w-full">
      <div
        className="leaflet-control m-3 w-[calc(100%-5.5rem)] max-w-sm"
        // Keep taps/gestures inside the search UI from panning the map.
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Search points of interest…"
          aria-label="Search points of interest"
          className="w-full rounded-xl border border-black/10 bg-white/95 px-4 py-3 text-base shadow-lg outline-teal-700 backdrop-blur dark:border-white/15 dark:bg-neutral-900/95"
        />
        {open && query && (
          <ul className="mt-1 overflow-hidden rounded-xl bg-white/95 shadow-lg backdrop-blur dark:bg-neutral-900/95">
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm opacity-60">No matches</li>
            ) : (
              results.map((poi) => (
                <li key={poi.id}>
                  <button
                    type="button"
                    onClick={() => select(poi)}
                    className="w-full px-4 py-3 text-left text-sm font-medium active:bg-black/5 dark:active:bg-white/10"
                  >
                    {poi.title}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
