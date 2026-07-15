"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setMapPublishedAction, updateMapAction, deleteMapAction } from "@/actions/maps";
import { EditorMapCanvas } from "@/components/map/MapCanvas";
import { GeocodeSearch } from "@/components/map/GeocodeSearch";
import type { MapFocus } from "@/components/map/EditorMapView";
import type { MapBounds } from "@/components/map/LeafletMap";
import type { LatLng, PoiData } from "@/components/map/types";
import { PoiSheet, type PoiSheetMode } from "./PoiSheet";
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
  uploadsEnabled,
}: {
  map: EditorMapData;
  pois: PoiData[];
  teamSlug: string;
  teamName: string;
  uploadsEnabled: boolean;
}) {
  const router = useRouter();

  // --- Settings state (all controlled so we can snapshot + auto-save) -------
  const [name, setName] = useState(map.name);
  const [slug, setSlug] = useState(map.slug);
  const [description, setDescription] = useState(map.description ?? "");
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

  // --- POI editing state ----------------------------------------------------
  const [sheet, setSheet] = useState<PoiSheetMode | null>(null);
  const [sheetDraft, setSheetDraft] = useState<LatLng | null>(null);
  const [filter, setFilter] = useState("");

  // --- Save engine ----------------------------------------------------------
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveSeq = useRef(0);

  function snapshot() {
    return {
      name,
      slug,
      description,
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
    fd.set("name", snap.name);
    fd.set("slug", snap.slug);
    fd.set("description", snap.description);
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
    const result = await updateMapAction(map.id, null, fd);
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
  const mapWrapRef = useRef<HTMLDivElement>(null);

  function openSheet(mode: PoiSheetMode, position: LatLng) {
    setSheet(mode);
    setSheetDraft(position);
    // Bring the map back into view so tapping to reposition still works.
    mapWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeSheet() {
    setSheet(null);
    setSheetDraft(null);
  }

  // While the POI form is open, map taps MOVE the draft point; otherwise a
  // tap starts a new point.
  function handleMapClick(position: LatLng) {
    if (sheet) setSheetDraft(position);
    else openSheet({ type: "create" }, position);
  }

  // --- Publish toggle -------------------------------------------------------
  const [publishPending, startPublish] = useTransition();
  function togglePublished() {
    startPublish(async () => {
      await setMapPublishedAction(map.id, !map.published);
      router.refresh();
    });
  }

  // --- Delete ---------------------------------------------------------------
  const [deletePending, startDelete] = useTransition();
  function handleDelete() {
    if (!confirm(`Delete the map "${map.name}" and all its points? This cannot be undone.`)) {
      return;
    }
    startDelete(async () => {
      await deleteMapAction(map.id); // redirects to /dashboard on success
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
      {/* Sticky top bar: navigation, title, publish, save status */}
      <header className="sticky top-0 z-[1000] border-b border-black/10 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-neutral-950/95">
        <div className="flex h-14 items-center gap-2 px-3">
          <Link
            href="/dashboard"
            aria-label="Back to maps"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/5 text-lg dark:bg-white/10"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{name || "Untitled map"}</p>
            <p
              className={`truncate text-[11px] leading-tight ${
                saveStatus === "error" ? "text-red-600 dark:text-red-400" : "opacity-60"
              }`}
            >
              {statusLabel[saveStatus] || `/${teamSlug}/${slug}`}
            </p>
          </div>
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

      {/* On a wide screen: form on the left, map pinned on the right.
          On a phone: the map sits on top and everything scrolls together. */}
      <div className="lg:grid lg:grid-cols-[minmax(360px,40%)_1fr]">
        {/* Map cell (right on desktop, top on mobile) — stretches to the
            form's height so the inner map can stick while the form scrolls. */}
        <div className="lg:col-start-2 lg:row-start-1">
          <div
            ref={mapWrapRef}
            className="relative h-[52dvh] min-h-[320px] w-full lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]"
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
        />
        {!sheet && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2 z-[500] mx-auto w-fit rounded-full bg-black/70 px-3 py-1.5 text-center text-[11px] font-medium text-white">
            Tap the map to add a point
          </p>
        )}
          </div>
        </div>

        {/* Stacked settings — one after another, each auto-saved */}
        <div className="flex flex-col gap-6 px-4 pb-10 pt-5 lg:col-start-1 lg:row-start-1">
        <section className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Map name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveNow}
              required
              minLength={2}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Map address
            <div className="flex items-center gap-1 rounded-xl border border-black/15 px-4 py-3 dark:border-white/20 dark:bg-white/5">
              <span className="opacity-50">…/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onBlur={saveNow}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                className="w-full bg-transparent text-base outline-none"
              />
            </div>
            <span className="text-xs opacity-60">
              Part of the public link — changing it breaks shared links and QR codes.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveNow}
              rows={2}
              maxLength={500}
              className={inputClass}
            />
          </label>
        </section>

        {/* Event location: search flies the map; panning the map sets the
            attendees' default view. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Event location</h2>
          <GeocodeSearch
            onSelect={(result) => {
              setFocus(result.bounds ? { ...result, bounds: result.bounds } : result);
              setCenter({ lat: result.lat, lng: result.lng });
            }}
          />
          <p className="text-xs opacity-60">
            Search to jump the map, or pan and pinch it above — attendees open
            the map exactly as you frame it here.
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
              onChange={(e) => {
                const value = Number(e.target.value);
                setZoom(value);
                setFocus({ lat: center.lat, lng: center.lng, zoom: value });
              }}
              className="accent-teal-700"
            />
            <span className="text-xs opacity-60">
              How close the map starts for attendees — previewed live above.
            </span>
          </label>
        </section>

        {/* Borders: drawn on the map, summarised here. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Map borders</h2>
          {bounds ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-teal-700/10 px-4 py-3 text-sm">
              <span className="text-teal-700 dark:text-teal-400">
                ✓ Borders set — drag the corner handles on the map to adjust
              </span>
              <button
                type="button"
                onClick={() => setBounds(null)}
                className="shrink-0 font-semibold text-red-600 dark:text-red-400"
              >
                Clear
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-black/20 px-4 py-3 text-sm opacity-70 dark:border-white/25">
              No borders — attendees can pan freely. Frame the area on the map,
              then tap <strong>“Use current view as borders”</strong>.
            </p>
          )}
        </section>

        {/* Points of interest: placed on the map, listed here. */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Points of interest ({pois.length})</h2>
            <button
              type="button"
              onClick={() => openSheet({ type: "create" }, center)}
              className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white active:scale-[.98]"
            >
              + Add point
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
              No points yet — tap anywhere on the map to add one.
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
            path={`${teamSlug}/${slug}`}
            teamName={teamName}
            published={map.published}
          />
        </section>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deletePending}
          className="mt-2 rounded-xl border border-red-300 px-6 py-3.5 font-semibold text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
        >
          {deletePending ? "Deleting…" : "Delete this map"}
        </button>
        </div>
      </div>

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
