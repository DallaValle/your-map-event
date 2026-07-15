"use client";

import { useEffect } from "react";
import { Marker, Rectangle, useMap, useMapEvents } from "react-leaflet";
import { LeafletMap, type MapBounds } from "./LeafletMap";
import { CompassControl } from "./CompassControl";
import { RotateControl } from "./RotateControl";
import { BoundsEditor } from "./BoundsEditor";
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

/** In-map button that captures the currently visible area as the borders. */
function CaptureBoundsControl({
  onCapture,
}: {
  onCapture: (bounds: MapBounds) => void;
}) {
  const map = useMap();
  const controlRef = useMapControlRef();
  return (
    <div className="leaflet-bottom leaflet-left">
      <div ref={controlRef} className="leaflet-control m-2">
        <button
          type="button"
          onClick={() => {
            const b = map.getBounds();
            onCapture({
              swLat: b.getSouthWest().lat,
              swLng: b.getSouthWest().lng,
              neLat: b.getNorthEast().lat,
              neLng: b.getNorthEast().lng,
            });
          }}
          className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-lg"
        >
          ⛶ Use current view as borders
        </button>
      </div>
    </div>
  );
}

/**
 * The single admin editing surface. It is both the live preview of the map
 * settings and the place where the on-map things are done:
 * - tap an empty spot to place a new POI (draft marker), tap a marker to edit
 * - pan / pinch / rotate to define the attendees' default view (reported out
 *   via onViewChange / onZoomChange / onBearingChange so the parent can save)
 * - capture the current view as borders, then drag the corner handles
 * Selection UI and the settings form live outside the map in MapEditor.
 */
export default function EditorMapView({
  center,
  zoom,
  bearing = 0,
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
}: {
  center: LatLng;
  zoom: number;
  /** Initial rotation (the map's saved default orientation). */
  bearing?: number;
  pois: PoiData[];
  draftPosition: LatLng | null;
  /** Saved map borders — editable when onCaptureBounds is provided. */
  bounds?: MapBounds | null;
  /** Imperatively fly the map (geocode search, zoom slider). */
  focus?: MapFocus | null;
  onMapClick: (position: LatLng) => void;
  onPoiClick: (poi: PoiData) => void;
  onViewChange?: (center: LatLng) => void;
  onZoomChange?: (zoom: number) => void;
  onBearingChange?: (bearing: number) => void;
  onCaptureBounds?: (bounds: MapBounds) => void;
}) {
  return (
    <LeafletMap
      center={center}
      zoom={zoom}
      bearing={bearing}
      rotatable
      className="h-full w-full"
    >
      <MapEvents
        onMapClick={onMapClick}
        onViewChange={onViewChange}
        onZoomChange={onZoomChange}
      />
      <FlyToFocus focus={focus} />
      <RotateControl onBearingChange={onBearingChange} />
      <CompassControl />
      {bounds &&
        (onCaptureBounds ? (
          // Editable: drag any corner handle to fine-tune the box.
          <BoundsEditor bounds={bounds} onChange={onCaptureBounds} />
        ) : (
          <Rectangle
            bounds={[
              [bounds.swLat, bounds.swLng],
              [bounds.neLat, bounds.neLng],
            ]}
            pathOptions={{ color: "#0f766e", weight: 2, dashArray: "6 6", fillOpacity: 0.03 }}
          />
        ))}
      {onCaptureBounds && !bounds && (
        <CaptureBoundsControl onCapture={onCaptureBounds} />
      )}
      {pois.map((poi) => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lng]}
          icon={poiDivIcon(poi.icon)}
          eventHandlers={{ click: () => onPoiClick(poi) }}
        />
      ))}
      {draftPosition && (
        <Marker position={[draftPosition.lat, draftPosition.lng]} opacity={0.6} />
      )}
    </LeafletMap>
  );
}
