"use client";

import { useEffect } from "react";
import type L from "leaflet";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import { LeafletMap, type MapBounds } from "./LeafletMap";
import { RotateControl } from "./RotateControl";
import { ZoomControl } from "./ZoomControl";
import { useMapControlRef } from "./control-utils";
import { poiDivIcon } from "./poi-icon";
import type { LatLng, PoiData } from "./types";

export interface MapFocus {
  lat: number;
  lng: number;
  zoom?: number;
  bounds?: MapBounds;
}

function MapEvents({
  onMapClick,
  onViewChange,
  onZoomChange,
}: {
  onMapClick: (position: LatLng) => void;
  onViewChange?: (center: LatLng) => void;
  onZoomChange?: (zoom: number) => void;
}) {
  const map = useMapEvents({
    click(event) {
      onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
    moveend() {
      const center = map.getCenter();
      onViewChange?.({ lat: center.lat, lng: center.lng });
      // Pan-while-zoomed can leave parent zoom stale; keep it in sync.
      onZoomChange?.(map.getZoom());
    },
    zoomend() {
      onZoomChange?.(map.getZoom());
    },
  });
  return null;
}

/** Fly the map to a search result / zoom change whenever `focus` changes. */
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
      map.flyTo([focus.lat, focus.lng], focus.zoom ?? map.getZoom());
    }
  }, [focus, map]);
  return null;
}

function captureBounds(map: L.Map): MapBounds {
  // getBounds() returns the axis-aligned lat/lng box covering the whole
  // viewport even when the map is rotated — exactly what maxBounds needs.
  const b = map.getBounds();
  return {
    swLat: b.getSouthWest().lat,
    swLng: b.getSouthWest().lng,
    neLat: b.getNorthEast().lat,
    neLng: b.getNorthEast().lng,
  };
}

interface ToggleableHandler {
  enable(): void;
  disable(): void;
}

/**
 * Editor-only lock: freeze pan/rotate so the attendee frame doesn't drift,
 * but keep zoom (wheel, pinch, +/-) so points are easy to place. Does not
 * recapture borders - the saved attendee lock stays as it was when locked.
 * Attendee maps use FrozenView separately and stay fully frozen.
 */
function EditorLock({ locked }: { locked: boolean }) {
  const map = useMap();

  useEffect(() => {
    const rotate: (ToggleableHandler | undefined)[] = [
      (map as unknown as { touchRotate?: ToggleableHandler }).touchRotate,
      (map as unknown as { shiftKeyRotate?: ToggleableHandler }).shiftKeyRotate,
    ];

    if (locked) {
      map.dragging.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      for (const handler of rotate) handler?.disable();
      map.touchZoom.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
    } else {
      map.dragging.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      for (const handler of rotate) handler?.enable();
    }
  }, [locked, map]);

  return null;
}

/** In-map toggle: freeze (or release) the current framing as the attendee view. */
function LockViewControl({
  locked,
  onLock,
  onUnlock,
}: {
  locked: boolean;
  onLock: (bounds: MapBounds) => void;
  onUnlock: () => void;
}) {
  const map = useMap();
  const controlRef = useMapControlRef();
  return (
    <div className="leaflet-bottom leaflet-left">
      {/* mb-6 keeps the button clear of the OSM attribution line. */}
      <div ref={controlRef} className="leaflet-control m-2 mb-6">
        <button
          type="button"
          onClick={() => (locked ? onUnlock() : onLock(captureBounds(map)))}
          className={`rounded-lg px-3 py-2 text-xs font-semibold shadow-lg ${
            locked
              ? "bg-white text-teal-700 dark:bg-neutral-900 dark:text-teal-400"
              : "bg-teal-700 text-white"
          }`}
        >
          {locked ? "🔓 Unlock view" : "🔒 Lock this view for attendees"}
        </button>
      </div>
    </div>
  );
}

/**
 * The single admin editing surface. The map card is phone-shaped, so what's
 * visible here IS the attendee view:
 * - "+ Add point" arms a tap to place a POI; tap a marker to edit (no pan)
 * - pan / pinch / rotate to define the attendees' default view (reported out
 *   via onViewChange / onZoomChange / onBearingChange so the parent can save)
 * - lock the view to freeze the attendee frame; editor zoom stays available
 * Selection UI and the settings form live outside the map in MapEditor.
 */
export default function EditorMapView({
  center,
  zoom,
  bearing = 0,
  layout,
  pois,
  draftPosition,
  bounds,
  focus = null,
  onMapClick,
  onPoiClick,
  onViewChange,
  onZoomChange,
  onBearingChange,
  onCaptureBounds,
  onClearBounds,
}: {
  center: LatLng;
  zoom: number;
  /** Initial rotation (the map's saved default orientation). */
  bearing?: number;
  /** Basemap layout (streets, light, dark, satellite, outdoors). */
  layout?: string | null;
  pois: PoiData[];
  draftPosition: LatLng | null;
  /** Saved borders. When set (and editable), the view is locked to them. */
  bounds?: MapBounds | null;
  /** Imperatively fly the map (geocode search, zoom slider). */
  focus?: MapFocus | null;
  onMapClick: (position: LatLng) => void;
  onPoiClick: (poi: PoiData) => void;
  onViewChange?: (center: LatLng) => void;
  onZoomChange?: (zoom: number) => void;
  onBearingChange?: (bearing: number) => void;
  onCaptureBounds?: (bounds: MapBounds) => void;
  onClearBounds?: () => void;
}) {
  const locked = !!bounds && !!onCaptureBounds;
  return (
    <LeafletMap
      center={center}
      zoom={zoom}
      bearing={bearing}
      layout={layout}
      rotatable
      className="h-full w-full"
    >
      <MapEvents
        onMapClick={onMapClick}
        onViewChange={onViewChange}
        onZoomChange={onZoomChange}
      />
      <FlyToFocus focus={focus} />
      {/* Orientation stays frozen with the attendee lock; zoom does not.
          No compass here - the rotate control already shows the bearing. */}
      {!locked && <RotateControl onBearingChange={onBearingChange} />}
      <ZoomControl />
      {onCaptureBounds && (
        <>
          <EditorLock locked={locked} />
          <LockViewControl
            locked={locked}
            onLock={onCaptureBounds}
            onUnlock={() => onClearBounds?.()}
          />
        </>
      )}
      {pois.map((poi) => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lng]}
          icon={poiDivIcon(poi.icon)}
          // Leaflet 1.9 pans to a focused marker by default; a click must
          // only open the sheet, never shift the framed view.
          autoPanOnFocus={false}
          eventHandlers={{ click: () => onPoiClick(poi) }}
        />
      ))}
      {draftPosition && (
        <Marker
          position={[draftPosition.lat, draftPosition.lng]}
          opacity={0.6}
          autoPanOnFocus={false}
        />
      )}
    </LeafletMap>
  );
}
