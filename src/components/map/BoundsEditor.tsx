"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker, Rectangle } from "react-leaflet";
import type { MapBounds } from "./LeafletMap";

// Small round handle rendered as a plain div so it stays crisp at any zoom.
const handleIcon = L.divIcon({
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: '<div style="width:20px;height:20px;border-radius:9999px;background:#0f766e;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
});

type Corner = "sw" | "ne" | "nw" | "se";

/**
 * Editable borders: dashed rectangle with four draggable corner handles.
 * Dragging any corner resizes the box; the parent owns the bounds state.
 */
export function BoundsEditor({
  bounds,
  onChange,
}: {
  bounds: MapBounds;
  onChange: (bounds: MapBounds) => void;
}) {
  const corners = useMemo<Record<Corner, [number, number]>>(
    () => ({
      sw: [bounds.swLat, bounds.swLng],
      ne: [bounds.neLat, bounds.neLng],
      nw: [bounds.neLat, bounds.swLng],
      se: [bounds.swLat, bounds.neLng],
    }),
    [bounds],
  );

  function moveCorner(corner: Corner, lat: number, lng: number) {
    const next: MapBounds = { ...bounds };
    // Each corner controls one latitude edge and one longitude edge.
    if (corner === "sw" || corner === "se") next.swLat = lat;
    else next.neLat = lat;
    if (corner === "sw" || corner === "nw") next.swLng = lng;
    else next.neLng = lng;
    // Re-normalize in case a handle was dragged past the opposite edge.
    onChange({
      swLat: Math.min(next.swLat, next.neLat),
      neLat: Math.max(next.swLat, next.neLat),
      swLng: Math.min(next.swLng, next.neLng),
      neLng: Math.max(next.swLng, next.neLng),
    });
  }

  return (
    <>
      <Rectangle
        bounds={[corners.sw, corners.ne]}
        pathOptions={{ color: "#0f766e", weight: 2, dashArray: "6 6", fillOpacity: 0.05 }}
      />
      {(Object.keys(corners) as Corner[]).map((corner) => (
        <Marker
          key={corner}
          position={corners[corner]}
          icon={handleIcon}
          draggable
          eventHandlers={{
            drag(event) {
              const { lat, lng } = (event.target as L.Marker).getLatLng();
              moveCorner(corner, lat, lng);
            },
          }}
        />
      ))}
    </>
  );
}
