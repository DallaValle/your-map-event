"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

/**
 * Explicit rotation buttons for the editor — gestures (two-finger rotate on
 * touch, Shift+scroll on desktop) are hard to discover, so the admin gets
 * visible ⟲/⟳ controls plus a live angle readout. Every change (buttons or
 * gestures) is reported so the parent can offer to save it.
 */
export function RotateControl({
  onBearingChange,
}: {
  onBearingChange?: (bearing: number) => void;
}) {
  const map = useMap();
  const [bearing, setBearing] = useState(() => map.getBearing?.() ?? 0);

  useEffect(() => {
    const update = () => {
      const value = map.getBearing?.() ?? 0;
      setBearing(value);
      onBearingChange?.(value);
    };
    map.on("rotate", update);
    return () => {
      map.off("rotate", update);
    };
  }, [map, onBearingChange]);

  function rotateBy(delta: number) {
    map.setBearing(((map.getBearing?.() ?? 0) + delta) % 360);
  }

  const buttonClass =
    "flex size-11 items-center justify-center rounded-full bg-white text-lg shadow-lg active:scale-95 dark:bg-neutral-900";

  return (
    <div className="leaflet-left" style={{ top: "50%", transform: "translateY(-50%)" }}>
      <div className="leaflet-control m-2 flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Rotate map counter-clockwise"
          onClick={() => rotateBy(-15)}
          className={buttonClass}
        >
          ⟲
        </button>
        <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
          {Math.round(((bearing % 360) + 360) % 360)}°
        </span>
        <button
          type="button"
          aria-label="Rotate map clockwise"
          onClick={() => rotateBy(15)}
          className={buttonClass}
        >
          ⟳
        </button>
      </div>
    </div>
  );
}
