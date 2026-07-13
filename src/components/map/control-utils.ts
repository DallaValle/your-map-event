import { useEffect, useRef } from "react";
import L from "leaflet";

/**
 * Ref for custom in-map controls: without this, taps on a control ALSO fire
 * the map's click handler (Leaflet listens natively on the container, so
 * React's stopPropagation can't help) — e.g. tapping "rotate" would silently
 * open the new-point form underneath.
 */
export function useMapControlRef<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);
  return ref;
}
