"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { useMapControlRef } from "./control-utils";

/**
 * Compass for rotatable maps: the needle mirrors the current bearing and a
 * tap animates the map back to north. Hidden while already facing north.
 */
export function CompassControl({
  className = "m-3",
}: {
  /** Margin classes — lets host screens clear their own top overlays. */
  className?: string;
}) {
  const map = useMap();
  const controlRef = useMapControlRef();
  const [bearing, setBearing] = useState(0);

  useEffect(() => {
    const update = () => setBearing(map.getBearing?.() ?? 0);
    map.on("rotate", update);
    return () => {
      map.off("rotate", update);
    };
  }, [map]);

  if (Math.abs(bearing) < 0.5) return null;

  return (
    <div className="leaflet-top leaflet-right">
      <div ref={controlRef} className={`leaflet-control ${className}`}>
        <button
          type="button"
          aria-label="Reset map to north"
          onClick={() => map.setBearing(0)}
          className="flex size-11 items-center justify-center rounded-full bg-white shadow-lg dark:bg-neutral-900"
        >
          <span
            className="text-xl"
            style={{ transform: `rotate(${bearing}deg)` }}
          >
            🧭
          </span>
        </button>
      </div>
    </div>
  );
}
