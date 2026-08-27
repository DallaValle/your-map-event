"use client";

import { useEffect } from "react";
import type L from "leaflet";
import { Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { poiDivIcon } from "./poi-icon";
import type { PoiData } from "./types";

const POPUP_PAD = 8;

/** Shift a Leaflet popup so its box stays fully inside the map container. */
function clampPopupElement(map: L.Map, el: HTMLElement) {
  const mapRect = map.getContainer().getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const minLeft = mapRect.left + POPUP_PAD;
  const maxLeft = mapRect.right - POPUP_PAD - rect.width;
  const minTop = mapRect.top + POPUP_PAD;
  const maxTop = mapRect.bottom - POPUP_PAD - rect.height;
  const dx = Math.min(Math.max(rect.left, minLeft), Math.max(minLeft, maxLeft)) - rect.left;
  const dy = Math.min(Math.max(rect.top, minTop), Math.max(minTop, maxTop)) - rect.top;
  if (dx === 0 && dy === 0) return;
  el.style.left = `${parseFloat(el.style.left || "0") + dx}px`;
  el.style.bottom = `${parseFloat(el.style.bottom || "0") - dy}px`;
}

/**
 * Leaflet popups live in an overflow:hidden map. Auto-pan can't pull a point
 * near the event border far enough in, so we slide the bubble itself.
 */
function KeepPopupsOnScreen() {
  const map = useMap();

  useEffect(() => {
    const clampOpen = () => {
      const el = map.getContainer().querySelector(".leaflet-popup");
      if (el instanceof HTMLElement) clampPopupElement(map, el);
    };
    const onOpen = () => {
      requestAnimationFrame(() => {
        clampOpen();
        requestAnimationFrame(clampOpen);
      });
    };
    map.on("popupopen", onOpen);
    map.on("moveend zoomend", clampOpen);
    return () => {
      map.off("popupopen", onOpen);
      map.off("moveend zoomend", clampOpen);
    };
  }, [map]);

  return null;
}

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
   * When the event has hard borders, opening a popup must not pan past them.
   * The popup is then shifted to stay on-screen instead.
   */
  locked?: boolean;
}) {
  return (
    <>
      <KeepPopupsOnScreen />
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        // Clustering should be a last resort, not the default look: attendees
        // browse around the event's default zoom (~17), where individual pins
        // must stay separate even when close. So cluster only when genuinely
        // zoomed out (16 and below) and only for markers nearly on top of each
        // other (small radius) — a full-area overview, never the normal view.
        maxClusterRadius={40}
        disableClusteringAtZoom={16}
        // Clusters expand on tap by zooming to fit their markers.
        // With borders, skip that zoom so we never jump outside the event.
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
            {/* Never auto-pan: borders are a hard limit, and KeepPopupsOnScreen
                slides the bubble so a point near an edge stays readable. */}
            <Popup
              maxWidth={260}
              minWidth={200}
              autoPan={false}
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
    </>
  );
}
