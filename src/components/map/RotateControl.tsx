"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import { useMapControlRef } from "./control-utils";

/**
 * Explicit rotation control — gestures (two-finger rotate, Shift+scroll)
 * are hard to discover and awkward on trackpads, so the admin gets visible
 * buttons: tap for 15° steps, press-and-hold for continuous rotation.
 * Every change (buttons or gestures) is reported so the parent can offer
 * to persist it.
 */
export function RotateControl({
  onBearingChange,
}: {
  onBearingChange?: (bearing: number) => void;
}) {
  const map = useMap();
  const controlRef = useMapControlRef();
  const [bearing, setBearing] = useState(() => map.getBearing?.() ?? 0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const held = useRef(false);

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
    map.setBearing(((map.getBearing?.() ?? 0) + delta + 360) % 360);
  }

  // Press-and-hold rotates continuously (2°/frame); a quick tap steps 15°.
  function startHold(direction: 1 | -1) {
    held.current = false;
    holdTimer.current = setInterval(() => {
      held.current = true;
      rotateBy(direction * 2);
    }, 50);
  }

  function endHold(direction: 1 | -1) {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    if (!held.current) rotateBy(direction * 15);
    held.current = false;
  }

  const buttonClass =
    "pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white text-lg shadow-lg select-none active:scale-95 dark:bg-neutral-900";

  const holdProps = (direction: 1 | -1) => ({
    onPointerDown: () => startHold(direction),
    onPointerUp: () => endHold(direction),
    onPointerLeave: () => {
      if (holdTimer.current) {
        clearInterval(holdTimer.current);
        holdTimer.current = null;
        held.current = false;
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    // leaflet-top/left classes make Leaflet position this absolutely inside
    // the map (a bare div would flow behind the panes and be invisible).
    <div className="leaflet-top leaflet-left">
      <div ref={controlRef} className="leaflet-control m-2 mt-20 flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Rotate map counter-clockwise (hold for continuous)"
          {...holdProps(-1)}
          className={buttonClass}
        >
          ⟲
        </button>
        <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
          {Math.round(((bearing % 360) + 360) % 360)}°
        </span>
        <button
          type="button"
          aria-label="Rotate map clockwise (hold for continuous)"
          {...holdProps(1)}
          className={buttonClass}
        >
          ⟳
        </button>
      </div>
    </div>
  );
}
