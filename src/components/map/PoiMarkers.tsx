"use client";

import type L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { poiDivIcon } from "./poi-icon";
import type { PoiData } from "./types";

/**
 * Clustered POI markers with rich popups. chunkedLoading keeps the main
 * thread responsive when a map has hundreds of points.
 */
export function PoiMarkers({
  pois,
  registerMarker,
  locked = false,
}: {
  pois: PoiData[];
  /** Lets the parent open a marker's popup programmatically (points list). */
  registerMarker?: (id: string, marker: L.Marker | null) => void;
  /**
   * When the attendee view is locked to a fixed frame, opening a popup must
   * NOT pan the map. The map already sits between the nav bars (not under
   * them), so the details stay readable without moving.
   */
  locked?: boolean;
}) {
  return (
    <MarkerClusterGroup
      chunkedLoading
      showCoverageOnHover={false}
      // When locked, tapping a cluster must not zoom/pan the frozen view.
      zoomToBoundsOnClick={!locked}
      spiderfyOnMaxZoom={!locked}
    >
      {pois.map((poi) => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lng]}
          icon={poiDivIcon(poi.icon)}
          ref={(marker) => registerMarker?.(poi.id, marker)}
        >
          {/* Unlocked: auto-pan the popup fully into view so a point near an
              edge stays readable. Locked: never pan (the frame is fixed). */}
          <Popup
            maxWidth={260}
            minWidth={200}
            autoPan={!locked}
            autoPanPaddingTopLeft={[16, 24]}
            autoPanPaddingBottomRight={[16, 24]}
          >
            <div className="space-y-1.5">
              {poi.imageUrl && (
                // Plain <img>: next/image's fill/size handling fights
                // Leaflet's popup measurement.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poi.imageUrl}
                  alt={poi.title}
                  className="h-32 w-full rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              <h3 className="text-base font-semibold leading-tight">{poi.title}</h3>
              {poi.description && (
                <p className="text-sm leading-snug opacity-80">{poi.description}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  );
}
