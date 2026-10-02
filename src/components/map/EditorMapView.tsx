"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type L from "leaflet";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import { Lock, LockOpen } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { LeafletMap, type MapBounds } from "./LeafletMap";
import { RotateControl } from "./RotateControl";
import { ZoomControl } from "./ZoomControl";
import { useMapControlRef } from "./control-utils";
import { PoiMarkers } from "./PoiMarkers";
import type { LatLng, MarkerStyle, PoiData } from "./types";

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
  const t = useTranslations("editor");
  const map = useMap();
  const controlRef = useMapControlRef();
  return (
    <div className="leaflet-bottom leaflet-left">
      <div ref={controlRef} className="leaflet-control m-2">
        <button
          type="button"
          onClick={() => (locked ? onUnlock() : onLock(captureBounds(map)))}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-lg ${
            locked
              ? "bg-surface text-brand"
              : "bg-brand text-brand-fg"
          }`}
        >
          <Icon icon={locked ? LockOpen : Lock} size="xs" />
          {locked ? t("unlockView") : t("lockView")}
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
  markerStyle,
  draftPosition,
  bounds,
  focus = null,
  selectedPoiId = null,
  onMapClick,
  onPoiPick,
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
  /** Same look attendees get: numbers or icons, colors. */
  markerStyle?: MarkerStyle;
  draftPosition: LatLng | null;
  /** Saved borders. When set (and editable), the view is locked to them. */
  bounds?: MapBounds | null;
  /** Imperatively fly the map (geocode search, zoom slider). */
  focus?: MapFocus | null;
  /** The point open in the form, highlighted on the map. */
  selectedPoiId?: string | null;
  onMapClick: (position: LatLng) => void;
  /** The tapped point, or every point under the finger on a crowded spot. */
  onPoiPick: (pois: PoiData[]) => void;
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
      <PoiMarkers
        pois={pois}
        style={markerStyle}
        selectedId={selectedPoiId}
        onPick={onPoiPick}
        pickOnMapClick={false}
      />
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
