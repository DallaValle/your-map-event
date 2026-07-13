"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setMapPublishedAction, setMapBearingAction } from "@/actions/maps";
import { EditorMapCanvas } from "@/components/map/MapCanvas";
import type { MapBounds } from "@/components/map/LeafletMap";
import type { LatLng, PoiData } from "@/components/map/types";
import { PoiSheet, type PoiSheetMode } from "./PoiSheet";
import { MapSettingsForm } from "./MapSettingsForm";
import { ShareCard } from "@/components/share/ShareCard";

export interface EditorMapData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  centerLat: number;
  centerLng: number;
  centerName: string;
  zoom: number;
  bearing: number;
  published: boolean;
  boundsSWLat: number | null;
  boundsSWLng: number | null;
  boundsNELat: number | null;
  boundsNELng: number | null;
}

/**
 * Full-screen editing canvas: everything happens on the map itself.
 * - tap the map → POI form opens as a top overlay at that spot
 * - tap a marker → edit it
 * - "+" button → add a point by typing coordinates
 * - points button → searchable list drawer + map settings
 */
export function MapEditor({
  map,
  pois,
  teamSlug,
  teamName,
  uploadsEnabled,
}: {
  map: EditorMapData;
  pois: PoiData[];
  teamSlug: string;
  teamName: string;
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<PoiSheetMode | null>(null);
  const [sheetDraft, setSheetDraft] = useState<LatLng | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState(false);
  const [filter, setFilter] = useState("");
  const [viewCenter, setViewCenter] = useState<LatLng>({
    lat: map.centerLat,
    lng: map.centerLng,
  });
  const [liveBearing, setLiveBearing] = useState(map.bearing);
  const [publishPending, startPublish] = useTransition();
  const [bearingPending, startBearing] = useTransition();

  const bearingDirty =
    Math.abs((((liveBearing - map.bearing) % 360) + 360) % 360) > 0.5;

  function saveBearing() {
    startBearing(async () => {
      await setMapBearingAction(map.id, liveBearing);
      router.refresh();
    });
  }

  const bounds: MapBounds | null =
    map.boundsSWLat != null
      ? {
          swLat: map.boundsSWLat,
          swLng: map.boundsSWLng!,
          neLat: map.boundsNELat!,
          neLng: map.boundsNELng!,
        }
      : null;

  const filtered = filter.trim()
    ? pois.filter((poi) =>
        poi.title.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : pois;

  function openSheet(mode: PoiSheetMode, position: LatLng) {
    setDrawer(false);
    setSheet(mode);
    setSheetDraft(position);
  }

  function closeSheet() {
    setSheet(null);
    setSheetDraft(null);
  }

  // While the form is open, map taps MOVE the draft point (the form floats
  // above the map without blocking it); otherwise a tap starts a new point.
  function handleMapClick(position: LatLng) {
    if (sheet) setSheetDraft(position);
    else openSheet({ type: "create" }, position);
  }

  function togglePublished() {
    startPublish(async () => {
      await setMapPublishedAction(map.id, !map.published);
      router.refresh();
    });
  }

  const fabButton =
    "pointer-events-auto flex items-center justify-center rounded-full bg-white shadow-lg dark:bg-neutral-900";

  return (
    <div className="relative h-[calc(100dvh-5.5rem)] w-full overflow-hidden">
      <EditorMapCanvas
        center={{ lat: map.centerLat, lng: map.centerLng }}
        zoom={map.zoom}
        bearing={map.bearing}
        pois={pois}
        draftPosition={sheetDraft}
        bounds={bounds}
        onMapClick={handleMapClick}
        onPoiClick={(poi) => openSheet({ type: "edit", poi }, { lat: poi.lat, lng: poi.lng })}
        onViewChange={setViewCenter}
        onBearingChange={setLiveBearing}
      />

      {/* Appears as soon as the rotation differs from the saved default. */}
      {bearingDirty && !sheet && (
        <button
          type="button"
          onClick={saveBearing}
          disabled={bearingPending}
          className="absolute left-1/2 top-16 z-[1000] -translate-x-1/2 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
        >
          {bearingPending
            ? "Saving…"
            : `Save ${Math.round(((liveBearing % 360) + 360) % 360)}° as default angle`}
        </button>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center gap-2 p-3">
        <Link
          href="/dashboard"
          aria-label="Back to maps"
          className={`${fabButton} size-11 text-lg`}
        >
          ←
        </Link>
        <div className="pointer-events-auto min-w-0 flex-1 rounded-full bg-white/95 px-4 py-2 shadow-lg backdrop-blur dark:bg-neutral-900/95">
          <p className="truncate text-sm font-bold leading-tight">{map.name}</p>
          <p className="truncate text-[10px] leading-tight opacity-60">
            {map.centerName}
          </p>
        </div>
        <button
          type="button"
          onClick={togglePublished}
          disabled={publishPending}
          className={`pointer-events-auto shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg disabled:opacity-60 ${
            map.published
              ? "bg-teal-700 text-white"
              : "bg-white dark:bg-neutral-900"
          }`}
        >
          {publishPending ? "…" : map.published ? "Live ✓" : "Publish"}
        </button>
      </div>

      {/* Bottom controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex items-end justify-between gap-2 p-3">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className={`${fabButton} h-12 gap-2 px-4 text-sm font-semibold`}
        >
          ☰ Points ({pois.length})
        </button>
        <p className="pointer-events-none mb-1 rounded-full bg-black/70 px-3 py-1.5 text-center text-[11px] font-medium text-white">
          Tap map to add
        </p>
        <button
          type="button"
          aria-label="Add point by coordinates"
          onClick={() => openSheet({ type: "create" }, viewCenter)}
          className={`${fabButton} size-14 bg-teal-700! text-2xl text-white`}
        >
          +
        </button>
      </div>

      {/* POI list drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[1100] flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close list"
            onClick={() => setDrawer(false)}
            className="flex-1 bg-black/40"
          />
          <div className="max-h-[70dvh] overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:bg-neutral-950">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/20 dark:bg-white/25" />

            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Points of interest</h2>
              <button
                type="button"
                onClick={() => {
                  setDrawer(false);
                  setSettings(true);
                }}
                className="rounded-full bg-black/5 px-3 py-2 text-sm font-semibold dark:bg-white/10"
              >
                ⚙️ Map settings
              </button>
            </div>

            {/* Setup overview: everything an organizer configures, at a
                glance. Tapping a chip jumps into settings. */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[
                { label: `🔗 /${teamSlug}/${map.slug}` },
                {
                  label: bounds ? "⛶ Borders set" : "⛶ No borders",
                  muted: !bounds,
                },
                {
                  label: `🧭 ${Math.round(((map.bearing % 360) + 360) % 360)}°`,
                  muted: map.bearing === 0,
                },
                { label: `🔍 Zoom ${map.zoom}` },
                { label: `📍 ${map.centerName}` },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setDrawer(false);
                    setSettings(true);
                  }}
                  className={`max-w-full truncate rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/15 ${
                    chip.muted ? "opacity-50" : ""
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {pois.length > 3 && (
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter points…"
                className="mb-3 w-full rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
              />
            )}

            {pois.length === 0 ? (
              <p className="rounded-xl border border-dashed border-black/20 px-4 py-8 text-center text-sm opacity-60 dark:border-white/25">
                No points yet — close this and tap anywhere on the map.
              </p>
            ) : (
              <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
                {filtered.map((poi) => (
                  <li key={poi.id}>
                    <button
                      type="button"
                      onClick={() => openSheet({ type: "edit", poi }, { lat: poi.lat, lng: poi.lng })}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10"
                    >
                      {poi.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={poi.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <span className="flex size-10 items-center justify-center rounded-lg bg-teal-700/10">{poi.icon ?? "📌"}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{poi.title}</p>
                        {poi.description && (
                          <p className="truncate text-xs opacity-60">{poi.description}</p>
                        )}
                      </div>
                      <span className="text-sm opacity-40">Edit</span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-4 py-3 text-sm opacity-60">No matches.</li>
                )}
              </ul>
            )}

            <div className="mt-4 flex flex-col gap-3">
              {map.published && (
                <Link
                  href={`/${teamSlug}/${map.slug}`}
                  className="block rounded-xl border border-teal-700/40 px-6 py-3 text-center font-semibold text-teal-700 dark:text-teal-400"
                >
                  View live map →
                </Link>
              )}
              <ShareCard
                path={`${teamSlug}/${map.slug}`}
                teamName={teamName}
                published={map.published}
              />
            </div>
          </div>
        </div>
      )}

      {/* Map settings overlay */}
      {settings && (
        <div className="fixed inset-0 z-[1200] overflow-y-auto bg-white dark:bg-neutral-950">
          <div className="mx-auto max-w-lg px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Map settings</h2>
              <button
                type="button"
                onClick={() => setSettings(false)}
                aria-label="Close settings"
                className="flex size-10 items-center justify-center rounded-full bg-black/5 text-lg dark:bg-white/10"
              >
                ✕
              </button>
            </div>
            <MapSettingsForm map={map} />
          </div>
        </div>
      )}

      {/* POI form: compact floating card; the map stays interactive and
          taps reposition the draft point while it's open. */}
      {sheet && sheetDraft && (
        <PoiSheet
          mapId={map.id}
          mode={sheet}
          position={sheetDraft}
          uploadsEnabled={uploadsEnabled}
          onClose={closeSheet}
          onPositionChange={setSheetDraft}
        />
      )}
    </div>
  );
}
