"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

interface ToggleableHandler {
  enable(): void;
  disable(): void;
}

/**
 * Disables every direct map gesture (drag / pinch / scroll-zoom / double-click
 * / box-zoom / keyboard / rotate) while `active`. Shared by the editor's view
 * lock and the attendee map, so a locked view is truly frozen in both — a tap
 * on a point shows its details and nothing moves.
 */
export function FrozenView({ active }: { active: boolean }) {
  const map = useMap();

  useEffect(() => {
    const handlers: (ToggleableHandler | undefined)[] = [
      map.dragging,
      map.touchZoom,
      map.scrollWheelZoom,
      map.doubleClickZoom,
      map.boxZoom,
      map.keyboard,
      // Added by leaflet-rotate; absent when rotation is off.
      (map as unknown as { touchRotate?: ToggleableHandler }).touchRotate,
      (map as unknown as { shiftKeyRotate?: ToggleableHandler }).shiftKeyRotate,
    ];
    for (const handler of handlers) {
      if (active) handler?.disable();
      else handler?.enable();
    }
  }, [active, map]);

  return null;
}
