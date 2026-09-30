"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import type L from "leaflet";
import { Marker, useMapEvents } from "react-leaflet";
import { poiBadgeIcon } from "./poi-icon";
import {
  BADGE_LABEL_MIN,
  badgeSize,
  isParking,
  poiCode,
  poiColor,
  nearestSpacing,
} from "./poi-badge";
import type { PoiData } from "./types";

/** Fingertips land 10 to 15 px off target, so a tap reaches past a small dot. */
const TAP_RADIUS = 22;
const SELECTED_MIN = 28;

const PoiMarker = memo(function PoiMarker({
  poi,
  size,
  selected,
  onTap,
}: {
  poi: PoiData;
  size: number;
  selected: boolean;
  onTap: (poi: PoiData, event: L.LeafletMouseEvent) => void;
}) {
  const position = useMemo<[number, number]>(() => [poi.lat, poi.lng], [poi.lat, poi.lng]);
  const { code, name } = poiCode(poi.title);
  const shown = selected ? Math.max(size, SELECTED_MIN) : size;
  const icon = poiBadgeIcon({
    label: code ?? (isParking(poi.icon) ? "P" : poi.icon || "📍"),
    color: poiColor(poi.icon),
    size: shown,
    square: isParking(poi.icon),
    selected,
    showLabel: shown >= BADGE_LABEL_MIN,
  });
  const eventHandlers = useMemo(
    () => ({ click: (event: L.LeafletMouseEvent) => onTap(poi, event) }),
    [onTap, poi],
  );

  return (
    <Marker
      position={position}
      icon={icon}
      title={code ? `${code} ${name}` : name}
      alt={poi.title}
      // Selection comes first, then everything that is not a plain stand.
      zIndexOffset={selected ? 10_000 : code && /^\d/.test(code) ? 0 : 500}
      // Opening details must never move the camera past the event borders.
      autoPanOnFocus={false}
      eventHandlers={eventHandlers}
    />
  );
});

/**
 * Every point stays on its exact coordinate: no clustering, no spreading apart.
 * A tap resolves in screen space, so a finger on a crowded row gets the list of
 * points under it instead of whichever marker happened to be on top.
 */
export function PoiMarkers({
  pois,
  selectedId,
  onPick,
}: {
  pois: PoiData[];
  selectedId?: string | null;
  /** One point or every point under the finger, nearest first. Empty on a miss. */
  onPick: (hits: PoiData[]) => void;
}) {
  const spacing = useMemo(() => nearestSpacing(pois), [pois]);
  const [zoom, setZoom] = useState<number | null>(null);

  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    click: (event) => onPick(hitTestRef.current(event.containerPoint)),
  });
  const z = zoom ?? map.getZoom();
  const sizeOf = (poi: PoiData) => badgeSize(spacing.get(poi.id) ?? Infinity, z, poi.lat);

  function hitTest(point: L.Point) {
    return pois
      .map((poi) => ({
        poi,
        d: map.latLngToContainerPoint([poi.lat, poi.lng]).distanceTo(point),
        radius: Math.max(TAP_RADIUS, sizeOf(poi) / 2 + 4),
      }))
      .filter((h) => h.d <= h.radius)
      .sort((a, b) => a.d - b.d)
      .map((h) => h.poi);
  }

  // Stable handler so a zoom re-renders badges without rebinding every marker.
  const hitTestRef = useRef(hitTest);
  hitTestRef.current = hitTest;
  const onTap = useCallback(
    (poi: PoiData, event: L.LeafletMouseEvent) => {
      // Keyboard activation has no pointer position: open that marker alone.
      const e = event.originalEvent;
      const hasPointer = e && "clientX" in e && (e.clientX !== 0 || e.clientY !== 0);
      const hits = hasPointer ? hitTestRef.current(map.mouseEventToContainerPoint(e)) : [];
      // The marker under the finger is always a candidate, whatever the geometry says.
      onPick(hits.includes(poi) ? hits : [poi, ...hits]);
    },
    [map, onPick],
  );

  return (
    <>
      {pois.map((poi) => (
        <PoiMarker
          key={poi.id}
          poi={poi}
          size={sizeOf(poi)}
          selected={poi.id === selectedId}
          onTap={onTap}
        />
      ))}
    </>
  );
}
