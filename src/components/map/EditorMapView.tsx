"use client";

import { Marker, Rectangle, useMapEvents } from "react-leaflet";
import { LeafletMap, type MapBounds } from "./LeafletMap";
import { CompassControl } from "./CompassControl";
import type { LatLng, PoiData } from "./types";

function MapEvents({
  onMapClick,
  onViewChange,
}: {
  onMapClick: (position: LatLng) => void;
  onViewChange?: (center: LatLng) => void;
}) {
  const map = useMapEvents({
    click(event) {
      onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
    moveend() {
      const center = map.getCenter();
      onViewChange?.({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}

/**
 * Admin editing surface: tap an empty spot to place a new POI (draft marker),
 * tap an existing marker to edit it. Selection UI lives outside the map in
 * MapEditor; this component only reports events.
 */
export default function EditorMapView({
  center,
  zoom,
  pois,
  draftPosition,
  bounds,
  onMapClick,
  onPoiClick,
  onViewChange,
}: {
  center: LatLng;
  zoom: number;
  pois: PoiData[];
  draftPosition: LatLng | null;
  /** Saved map borders, drawn as a dashed rectangle for reference. */
  bounds?: MapBounds | null;
  onMapClick: (position: LatLng) => void;
  onPoiClick: (poi: PoiData) => void;
  onViewChange?: (center: LatLng) => void;
}) {
  return (
    <LeafletMap center={center} zoom={zoom} rotatable className="h-full w-full">
      <MapEvents onMapClick={onMapClick} onViewChange={onViewChange} />
      <CompassControl />
      {bounds && (
        <Rectangle
          bounds={[
            [bounds.swLat, bounds.swLng],
            [bounds.neLat, bounds.neLng],
          ]}
          pathOptions={{ color: "#0f766e", weight: 2, dashArray: "6 6", fillOpacity: 0.03 }}
        />
      )}
      {pois.map((poi) => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lng]}
          eventHandlers={{ click: () => onPoiClick(poi) }}
        />
      ))}
      {draftPosition && (
        <Marker position={[draftPosition.lat, draftPosition.lng]} opacity={0.6} />
      )}
    </LeafletMap>
  );
}
