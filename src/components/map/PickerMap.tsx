"use client";

import { useEffect } from "react";
import { Rectangle, useMap } from "react-leaflet";
import { LeafletMap, type MapBounds } from "./LeafletMap";
import { useMapControlRef } from "./control-utils";
import { LocationPicker } from "./LocationPicker";
import { BoundsEditor } from "./BoundsEditor";
import type { LatLng } from "./types";

export interface MapFocus {
  lat: number;
  lng: number;
  zoom?: number;
  bounds?: MapBounds;
}

/** Fly the map to a search result whenever `focus` changes. */
function FlyToFocus({ focus }: { focus: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    if (focus.bounds) {
      map.flyToBounds(
        [
          [focus.bounds.swLat, focus.bounds.swLng],
          [focus.bounds.neLat, focus.bounds.neLng],
        ],
        { maxZoom: 17 },
      );
    } else {
      map.flyTo([focus.lat, focus.lng], focus.zoom ?? 16);
    }
  }, [focus, map]);
  return null;
}

/** In-map button that captures the currently visible area as the borders. */
function CaptureBoundsControl({
  onCapture,
}: {
  onCapture: (bounds: MapBounds) => void;
}) {
  const map = useMap();
  const controlRef = useMapControlRef();
  return (
    <div className="leaflet-bottom leaflet-left">
      <div ref={controlRef} className="leaflet-control m-2">
        <button
          type="button"
          onClick={() => {
            const b = map.getBounds();
            onCapture({
              swLat: b.getSouthWest().lat,
              swLng: b.getSouthWest().lng,
              neLat: b.getNorthEast().lat,
              neLng: b.getNorthEast().lng,
            });
          }}
          className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-lg"
        >
          ⛶ Use current view as borders
        </button>
      </div>
    </div>
  );
}

/**
 * Embedded form map: tap to pick a position, fly to search results, and
 * optionally capture/preview the map borders.
 */
export default function PickerMap({
  center,
  zoom,
  value,
  onPick,
  focus = null,
  bounds = null,
  onCaptureBounds,
  className = "h-72 w-full rounded-2xl",
}: {
  center: LatLng;
  zoom: number;
  value: LatLng | null;
  onPick: (position: LatLng) => void;
  focus?: MapFocus | null;
  bounds?: MapBounds | null;
  onCaptureBounds?: (bounds: MapBounds) => void;
  className?: string;
}) {
  return (
    <LeafletMap center={center} zoom={zoom} className={className}>
      <FlyToFocus focus={focus} />
      <LocationPicker value={value} onPick={onPick} />
      {bounds &&
        (onCaptureBounds ? (
          // Editable: drag any corner handle to fine-tune the box.
          <BoundsEditor bounds={bounds} onChange={onCaptureBounds} />
        ) : (
          <Rectangle
            bounds={[
              [bounds.swLat, bounds.swLng],
              [bounds.neLat, bounds.neLng],
            ]}
            pathOptions={{ color: "#0f766e", weight: 2, dashArray: "6 6", fillOpacity: 0.05 }}
          />
        ))}
      {onCaptureBounds && !bounds && <CaptureBoundsControl onCapture={onCaptureBounds} />}
    </LeafletMap>
  );
}
