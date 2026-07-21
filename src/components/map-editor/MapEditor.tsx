"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setMapPublishedAction, updateMapViewAction } from "@/actions/maps";
import { EditorMapCanvas } from "@/components/map/MapCanvas";
import { GeocodeSearch } from "@/components/map/GeocodeSearch";
import type { MapFocus } from "@/components/map/EditorMapView";
import type { MapBounds } from "@/components/map/LeafletMap";
import type { LatLng, PoiData } from "@/components/map/types";
import { PoiSheet, type PoiSheetMode } from "./PoiSheet";
import { PhonePreview } from "./PhonePreview";
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

type SaveStatus = "idle" | "saving" | "saved" | "error";

const ZOOM_MIN = 12;
const ZOOM_MAX = 19;
const clampZoom = (z: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z)));

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5";

/**
 * Single-page map editor. Everything lives in one scroll: the map stays at
 * the top as a live preview while a stacked settings form sits below it.
 * Every field auto-saves on its own — text on blur, map/slider/border changes
 * debounced — so there is no explicit "save" step. The only things done ON the
 * map are placing points and drawing borders; both are also listed in the form.
 */
export function MapEditor({
  map,
  pois,
  teamSlug,
  teamName,
  teamLogoUrl,
  uploadsEnabled,
}: {
  map: EditorMapData;
  pois: PoiData[];
  teamSlug: string;
  teamName: string;
  teamLogoUrl: string | null;
  uploadsEnabled: boolean;
}) {
  const router = useRouter();

  // --- Map view state (all controlled so we can snapshot + auto-save) -------
  // Basic event info (name, address, description) is edited on the dashboard's
  // Event page — the editor only touches the map.
  const [centerName, setCenterName] = useState(map.centerName);
  const [center, setCenter] = useState<LatLng>({
    lat: map.centerLat,
    lng: map.centerLng,
  });
  const [zoom, setZoom] = useState(map.zoom);
  const [bearing, setBearing] = useState(map.bearing);
  const [bounds, setBounds] = useState<MapBounds | null>(
    map.boundsSWLat != null
      ? {
          swLat: map.boundsSWLat,
          swLng: map.boundsSWLng!,
          neLat: map.boundsNELat!,
          neLng: map.boundsNELng!,
        }
      : null,
  );
  const [focus, setFocus] = useState<MapFocus | null>(null);

  // Attendee (iPhone) preview overlay.
  const [previewOpen, setPreviewOpen] = useState(false);

  // --- POI editing state ----------------------------------------------------
  const [sheet, setSheet] = useState<PoiSheetMode | null>(null);
  const [sheetDraft, setSheetDraft] = useState<LatLng | null>(null);
  // "Placing" arms map taps to drop new points, and STAYS armed after each
  // one so several points can be added in a row — until "Done" disarms it.
  // Without it, taps only pan / select, so framing never creates stray points.
  const [placing, setPlacing] = useState(false);
  const [filter, setFilter] = useState("");

  // --- Save engine ----------------------------------------------------------
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveSeq = useRef(0);

  function snapshot() {
    return {
      centerName,
      centerLat: center.lat,
      centerLng: center.lng,
      zoom,
      bearing,
      boundsSWLat: bounds?.swLat ?? "",
      boundsSWLng: bounds?.swLng ?? "",
      boundsNELat: bounds?.neLat ?? "",
      boundsNELng: bounds?.neLng ?? "",
    };
  }

  // Serialized snapshot of what's currently persisted, so redundant saves
  // (e.g. the map settling on load) are skipped.
  const savedRef = useRef<string>(JSON.stringify(snapshot()));

  async function saveNow() {
    const snap = snapshot();
    const json = JSON.stringify(snap);
    if (json === savedRef.current) return;

    const fd = new FormData();
    fd.set("centerName", snap.centerName);
    fd.set("centerLat", String(snap.centerLat));
    fd.set("centerLng", String(snap.centerLng));
    fd.set("zoom", String(snap.zoom));
    fd.set("bearing", String(snap.bearing));
    fd.set("boundsSWLat", String(snap.boundsSWLat));
    fd.set("boundsSWLng", String(snap.boundsSWLng));
    fd.set("boundsNELat", String(snap.boundsNELat));
    fd.set("boundsNELng", String(snap.boundsNELng));

    const seq = ++saveSeq.current;
    setSaveStatus("saving");
    const result = await updateMapViewAction(map.id, null, fd);
    if (seq !== saveSeq.current) return; // superseded by a newer save
    if (result?.ok) {
      savedRef.current = json;
      setSaveStatus("saved");
      setSaveError(null);
      // Keep the public map + dashboard in sync without remounting our map.
      router.refresh();
    } else {
      setSaveStatus("error");
      setSaveError(result?.error ?? "Couldn't save your change");
    }
  }

  // Debounced auto-save for map-driven changes (pan/zoom/rotate/borders).
  // Text fields save on blur instead (see the field handlers below).
  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;
  useEffect(() => {
    const t = setTimeout(() => saveRef.current(), 700);
    return () => clearTimeout(t);
  }, [center, zoom, bearing, bounds]);

  // --- Map interaction ------------------------------------------------------
  // The map card is sticky at every breakpoint, so it is always on screen —
  // no scrollIntoView here. (An earlier version scrolled on every placed
  // point, which read as "the map moved" even when the view was locked.)
  function openSheet(mode: PoiSheetMode, position: LatLng) {
    setSheet(mode);
    setSheetDraft(position);
  }

  function closeSheet() {
    setSheet(null);
    setSheetDraft(null);
  }

  function togglePlacing() {
    if (placing) {
      setPlacing(false);
      return;
    }
    closeSheet();
    setPlacing(true);
  }

  // Map taps are intentional-only: they reposition the open draft, or drop a
  // new point when placement is armed. A bare tap (framing, borders) does
  // nothing, so nothing is created by accident.
  function handleMapClick(position: LatLng) {
    if (sheet) setSheetDraft(position);
    else if (placing) openSheet({ type: "create" }, position);
  }

  // --- Publish toggle -------------------------------------------------------
  const [publishPending, startPublish] = useTransition();
  function togglePublished() {
    startPublish(async () => {
      await setMapPublishedAction(map.id, !map.published);
      router.refresh();
    });
  }

  const filtered = filter.trim()
    ? pois.filter((poi) =>
        poi.title.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : pois;

  const statusLabel: Record<SaveStatus, string> = {
    idle: "",
    saving: "Saving…",
    saved: "All changes saved",
    error: saveError ?? "Couldn't save",
  };

  return (
    <div className="flex flex-col">
      {/* Sticky top bar: navigation, title, preview, publish, save status.
          z sits above the map's Leaflet panes so it always stays in front. */}
      <header className="sticky top-0 z-[1200] border-b border-black/10 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-neutral-950/95">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 lg:px-8">
          <Link
            href="/dashboard"
            aria-label="Back to event"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/5 text-lg dark:bg-white/10"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{map.name || "Untitled event"}</p>
            <p
              className={`truncate text-[11px] leading-tight ${
                saveStatus === "error" ? "text-red-600 dark:text-red-400" : "opacity-60"
              }`}
            >
              {statusLabel[saveStatus] || `/${teamSlug}/${map.slug}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label="Preview on iPhone"
            title="Preview on iPhone"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-black/15 text-lg dark:border-white/20"
          >
            📱
          </button>
          <button
            type="button"
            onClick={togglePublished}
            disabled={publishPending}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
              map.published
                ? "bg-teal-700 text-white"
                : "border border-black/15 dark:border-white/20"
            }`}
          >
            {publishPending ? "…" : map.published ? "Live ✓" : "Publish"}
          </button>
        </div>
      </header>

      {/* Desktop: a fixed-height two-pane shell that fills the space below the
          editor's own header (3.5rem + 1px border) — the page itself never
          scrolls, only the form pane does, so the map physically cannot move.
          On a phone: the map card sits on top, sticky while the page scrolls. */}
      <div className="mx-auto w-full max-w-5xl lg:grid lg:h-[calc(100dvh-3.5rem-1px)] lg:grid-cols-[minmax(360px,30rem)_1fr] lg:gap-12 lg:overflow-hidden lg:px-8">
        {/* Map pane — a phone-shaped card (same aspect ratio as the attendee
            preview), so what's framed here is exactly what attendees see.
            Centred in the fixed pane on desktop. On mobile the whole cell is
            sticky with an opaque background, so the form scrolls underneath
            and the map never leaves the screen. */}
        <div className="px-4 py-3 max-lg:sticky max-lg:top-14 max-lg:z-[900] max-lg:bg-white max-lg:dark:bg-neutral-950 lg:col-start-2 lg:row-start-1 lg:flex lg:h-full lg:min-h-0 lg:items-center lg:justify-center lg:px-0">
          <div
            className={`relative mx-auto aspect-[390/844] h-[58dvh] max-w-full overflow-hidden rounded-2xl border shadow-sm lg:h-full ${
              bounds
                ? "border-teal-600/70 ring-2 ring-teal-600/40"
                : "border-black/10 dark:border-white/15"
            }`}
          >
            <EditorMapCanvas
          center={{ lat: map.centerLat, lng: map.centerLng }}
          zoom={map.zoom}
          bearing={map.bearing}
          pois={pois}
          draftPosition={sheetDraft}
          bounds={bounds}
          focus={focus}
          onMapClick={handleMapClick}
          onPoiClick={(poi) =>
            openSheet({ type: "edit", poi }, { lat: poi.lat, lng: poi.lng })
          }
          onViewChange={setCenter}
          onZoomChange={(z) => setZoom(clampZoom(z))}
          onBearingChange={(b) => setBearing(((b % 360) + 360) % 360)}
          onCaptureBounds={setBounds}
          onClearBounds={() => setBounds(null)}
        />
        {/* Visible borders: while locked the viewport IS the attendee area,
            so a dashed frame just inside the card edges marks the border. */}
        {bounds && (
          <>
            <div className="pointer-events-none absolute inset-1.5 z-[500] rounded-xl border-2 border-dashed border-teal-500/90" />
            <span className="pointer-events-none absolute right-3 top-3 z-[500] rounded-full bg-teal-700 px-2.5 py-1 text-[10px] font-semibold text-white shadow">
              🔒 View locked
            </span>
          </>
        )}
        {placing && !sheet && (
          <div className="pointer-events-none absolute inset-x-0 bottom-14 z-[500] mx-auto flex w-fit items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-medium text-white">
            Tap the map to add points — one per tap
            <button
              type="button"
              onClick={() => setPlacing(false)}
              className="pointer-events-auto rounded-full bg-white/20 px-2 py-0.5 font-semibold"
            >
              Done
            </button>
          </div>
        )}
          </div>
        </div>

        {/* Stacked settings — one after another, each auto-saved. On desktop
            this pane scrolls on its own inside the fixed shell. */}
        <div className="flex flex-col gap-6 px-4 pb-10 pt-5 lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-0 lg:py-3 lg:pr-2">
        {/* Event location: search flies the map; panning the map sets the
            attendees' default view. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Event location</h2>
          <GeocodeSearch
            placeholder="Search event location…"
            onSelect={(result) => {
              setFocus(result.bounds ? { ...result, bounds: result.bounds } : result);
              setCenter({ lat: result.lat, lng: result.lng });
            }}
          />
          <p className="text-xs opacity-60">
            Search to jump the map, or pan and pinch it — attendees open the
            map exactly as you frame it.
          </p>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Location name
            <input
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              onBlur={saveNow}
              required
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Default zoom: {zoom}
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              value={clampZoom(zoom)}
              disabled={!!bounds}
              onChange={(e) => {
                const value = Number(e.target.value);
                setZoom(value);
                setFocus({ lat: center.lat, lng: center.lng, zoom: value });
              }}
              className="accent-teal-700 disabled:opacity-40"
            />
            <span className="text-xs opacity-60">
              {bounds
                ? "Zoom is frozen while the view is locked — unlock to change it."
                : "How close the map starts for attendees — previewed live on the map."}
            </span>
          </label>
        </section>

        {/* View lock: freezing the phone-shaped view captures borders,
            orientation and zoom in one go. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Attendee view lock</h2>
          {bounds ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-teal-700/10 px-4 py-3 text-sm">
              <span className="text-teal-700 dark:text-teal-400">
                🔒 Locked — borders, orientation and zoom are frozen to the
                framed view. Attendees can’t pan outside it.
              </span>
              <button
                type="button"
                onClick={() => setBounds(null)}
                className="shrink-0 font-semibold text-red-600 dark:text-red-400"
              >
                Unlock
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-black/20 px-4 py-3 text-sm opacity-70 dark:border-white/25">
              Unlocked — attendees can pan freely. Frame the event in the
              phone-shaped map, then tap{" "}
              <strong>“Lock this view for attendees”</strong>.
            </p>
          )}
        </section>

        {/* Points of interest: placed on the map, listed here. */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Points of interest ({pois.length})</h2>
            <button
              type="button"
              onClick={togglePlacing}
              className={`rounded-full px-4 py-2 text-sm font-semibold active:scale-[.98] ${
                placing
                  ? "bg-teal-700/15 text-teal-700 dark:text-teal-400"
                  : "bg-teal-700 text-white"
              }`}
            >
              {placing ? "✓ Done adding" : "+ Add points"}
            </button>
          </div>

          {pois.length > 3 && (
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter points…"
              className={inputClass}
            />
          )}

          {pois.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/20 px-4 py-8 text-center text-sm opacity-60 dark:border-white/25">
              No points yet — tap “+ Add points”, then tap the map once per point.
            </p>
          ) : (
            <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
              {filtered.map((poi) => (
                <li key={poi.id}>
                  <button
                    type="button"
                    onClick={() =>
                      openSheet({ type: "edit", poi }, { lat: poi.lat, lng: poi.lng })
                    }
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10"
                  >
                    {poi.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poi.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-lg bg-teal-700/10">
                        {poi.icon ?? "📌"}
                      </span>
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
        </section>

        {/* Share + go live */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Share</h2>
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
        </section>
        </div>
      </div>

      {/* Attendee preview inside an iPhone frame — mirrors the current
          (possibly unsaved) framing, borders and points. */}
      {previewOpen && (
        <PhonePreview
          center={center}
          zoom={zoom}
          bearing={bearing}
          pois={pois}
          bounds={bounds}
          team={{ name: teamName, logoUrl: teamLogoUrl }}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* POI form: floating bottom sheet; the map stays interactive above it
          and taps reposition the draft point while it's open. */}
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
