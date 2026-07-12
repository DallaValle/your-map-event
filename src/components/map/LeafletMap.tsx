"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import "./leaflet-icon-fix";
import type { LatLng } from "./types";

/**
 * The only component that touches Leaflet's DOM API directly. It must never
 * be imported by server code — MapCanvas dynamic-imports it with ssr: false.
 *
 * OSM tile usage policy: single canonical host (the {s} subdomains are
 * deprecated) and visible attribution are required.
 */
export interface MapBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export function LeafletMap({
  center,
  zoom,
  maxBounds,
  children,
  className = "h-full w-full",
}: {
  center: LatLng;
  zoom: number;
  /** When set, panning is elastically constrained to this box. */
  maxBounds?: MapBounds | null;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className={className}
      // Mobile-first: pinch/drag are primary; the +/- control just wastes
      // screen space on phones.
      zoomControl={false}
      attributionControl
      {...(maxBounds
        ? {
            maxBounds: [
              [maxBounds.swLat, maxBounds.swLng],
              [maxBounds.neLat, maxBounds.neLng],
            ] as [[number, number], [number, number]],
            maxBoundsViscosity: 1.0,
          }
        : {})}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      {children}
    </MapContainer>
  );
}
