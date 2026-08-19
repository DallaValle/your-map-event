"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// Patches L.Map with rotation support (bearing, two-finger rotate).
import "leaflet-rotate";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import "./leaflet-icon-fix";
import type { LatLng } from "./types";
import {
  DEFAULT_MAP_LAYOUT,
  resolveMapLayout,
  type MapLayoutId,
} from "./map-layouts";

/**
 * The only component that touches Leaflet's DOM API directly. It must never
 * be imported by server code — MapCanvas dynamic-imports it with ssr: false.
 *
 * Tile usage: each layout declares its own host + attribution. OSM still uses
 * the single canonical host (the {s} subdomains are deprecated there).
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
  rotatable = false,
  bearing = 0,
  layout = DEFAULT_MAP_LAYOUT,
  children,
  className = "h-full w-full",
}: {
  center: LatLng;
  zoom: number;
  /** When set, panning is elastically constrained to this box. */
  maxBounds?: MapBounds | null;
  /** Two-finger (touch) / shift+scroll (mouse) rotation. */
  rotatable?: boolean;
  /** Initial rotation in degrees (0 = north up). */
  bearing?: number;
  /** Basemap preset (streets, light, dark, satellite, outdoors). */
  layout?: MapLayoutId | string | null;
  children?: React.ReactNode;
  className?: string;
}) {
  const basemap = resolveMapLayout(layout);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      bearing={rotatable ? bearing : 0}
      className={className}
      // Mobile-first: pinch/drag are primary; the +/- control just wastes
      // screen space on phones.
      zoomControl={false}
      attributionControl
      rotate={rotatable}
      touchRotate={rotatable}
      shiftKeyRotate={rotatable}
      rotateControl={false}
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
      {/* key remounts tiles when the admin switches layout */}
      <TileLayer
        key={basemap.id}
        url={basemap.url}
        attribution={basemap.attribution}
        maxZoom={basemap.maxZoom}
      />
      {children}
    </MapContainer>
  );
}
