"use client";

import { Marker, useMapEvents } from "react-leaflet";
import { LeafletMap } from "./LeafletMap";
import type { LatLng, PoiData } from "./types";

function ClickCapture({ onMapClick }: { onMapClick: (position: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
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
  onMapClick,
  onPoiClick,
}: {
  center: LatLng;
  zoom: number;
  pois: PoiData[];
  draftPosition: LatLng | null;
  onMapClick: (position: LatLng) => void;
  onPoiClick: (poi: PoiData) => void;
}) {
  return (
    <LeafletMap center={center} zoom={zoom} className="h-full w-full">
      <ClickCapture onMapClick={onMapClick} />
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
