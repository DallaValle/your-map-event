"use client";

import { LeafletMap } from "./LeafletMap";
import { PoiMarkers } from "./PoiMarkers";
import { GeolocateControl } from "./GeolocateControl";
import { PoiSearch } from "./PoiSearch";
import type { LatLng, PoiData } from "./types";

/** Full-screen attendee map: POIs, live location, search. */
export default function PublicMap({
  center,
  zoom,
  pois,
}: {
  center: LatLng;
  zoom: number;
  pois: PoiData[];
}) {
  return (
    <LeafletMap center={center} zoom={zoom} className="h-dvh w-full">
      <PoiMarkers pois={pois} />
      <GeolocateControl />
      <PoiSearch pois={pois} />
    </LeafletMap>
  );
}
