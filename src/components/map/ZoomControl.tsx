"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { useMapControlRef } from "./control-utils";

/**
 * In-map +/- zoom buttons for the editor. Attendee maps lean on pinch/scroll,
 * but the admin needs explicit controls to frame the default view on desktop.
 * Bounds mirror the editor's saved-zoom floor (14) and the tile ceiling (19).
 */
export function ZoomControl({ min = 14, max = 19 }: { min?: number; max?: number }) {
  const map = useMap();
  const controlRef = useMapControlRef();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);

  const buttonClass =
    "pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white text-2xl leading-none shadow-lg select-none active:scale-95 disabled:opacity-40 dark:bg-neutral-900";

  return (
    <div className="leaflet-top leaflet-right">
      <div ref={controlRef} className="leaflet-control m-2 flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => map.zoomIn()}
          disabled={zoom >= max}
          className={buttonClass}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => map.zoomOut()}
          disabled={zoom <= min}
          className={buttonClass}
        >
          −
        </button>
      </div>
    </div>
  );
}
