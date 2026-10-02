"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type L from "leaflet";
import { useMap } from "react-leaflet";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Focus, MapPin, Navigation, X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { LeafletMap, type MapBounds } from "./LeafletMap";
import { PoiMarkers } from "./PoiMarkers";
import { PoiBadge, PoiChooser, PoiDetails } from "./PoiPanels";
import { walkOrder } from "./poi-badge";
import { GeolocateLayer, isInsideBounds, type GeoState } from "./GeolocateLayer";
import { CompassControl } from "./CompassControl";
import { DEFAULT_MARKER_STYLE, type LatLng, type MarkerStyle, type PoiData } from "./types";

/** Hands the Leaflet map instance to overlays living outside the container. */
function MapRefCapture({ onMap }: { onMap: (map: L.Map | null) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
    return () => onMap(null);
  }, [map, onMap]);
  return null;
}

/** Case and accent insensitive, so "cafe" finds "Café". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

interface MapView {
  lat: number;
  lng: number;
  zoom: number;
  bearing: number;
}

/**
 * Attendee camera rules: stay inside the event borders, double-click zooms in
 * one step, and report the current view up for the wrapper's data attributes.
 */
function AttendeeMapBehavior({ onView }: { onView: (view: MapView) => void }) {
  const map = useMap();

  useEffect(() => {
    const syncView = () => {
      const c = map.getCenter();
      onView({
        lat: c.lat,
        lng: c.lng,
        zoom: map.getZoom(),
        bearing: map.getBearing?.() ?? 0,
      });
    };

    // One zoom level per double-click, not a jump to a street-level zoom.
    map.options.zoomDelta = 1;
    map.doubleClickZoom?.enable();

    const applyMinZoom = () => {
      const bounds = map.options.maxBounds;
      if (!bounds) return;
      const size = map.getSize();
      if (!size.x || !size.y) return;
      // Upscaled zoom levels are for inspecting a crowded row, never the opening frame.
      const min = Math.min(map.getBoundsZoom(bounds, true), map.getMaxZoom() - 2);
      if (!Number.isFinite(min)) return;
      map.setMinZoom(min);
      if (map.getZoom() < min) map.setZoom(min);
    };

    applyMinZoom();
    syncView();
    map.on("resize", applyMinZoom);
    map.on("moveend", syncView);
    map.on("zoomend", syncView);
    map.on("rotate", syncView);
    return () => {
      map.off("resize", applyMinZoom);
      map.off("moveend", syncView);
      map.off("zoomend", syncView);
      map.off("rotate", syncView);
    };
  }, [map, onView]);

  return null;
}

/**
 * Attendee screen: a full-bleed rotatable map framed by a top navigation bar
 * (event logo + name) and a bottom navigation bar (points list, locate,
 * recenter). The points list expands into a sheet above the bottom
 * bar and can be filtered by name; selecting a point flies the map there and
 * opens its details sheet. Event borders
 * are a hard limit, not a frozen camera: pan and zoom stay inside them.
 */
export default function PublicMap({
  center,
  zoom,
  bearing = 0,
  layout,
  pois,
  markerStyle = DEFAULT_MARKER_STYLE,
  maxBounds,
  team,
  eventName,
  eventSubtitle,
  eventLogoUrl,
  chromeInsets,
  banner,
}: {
  center: LatLng;
  zoom: number;
  /** The admin's saved default orientation. */
  bearing?: number;
  /** Basemap layout saved on the event. */
  layout?: string | null;
  pois: PoiData[];
  /** Numbers or icons, colors and categories chosen by the admin. */
  markerStyle?: MarkerStyle;
  maxBounds?: MapBounds | null;
  team: { name: string };
  /** Shown in the top bar alongside the event logo. */
  eventName: string;
  /** Line under the event name; falls back to the team name. */
  eventSubtitle?: string | null;
  /** Event branding in the top bar (falls back to a pin if missing). */
  eventLogoUrl?: string | null;
  /**
   * Extra clearance (in rem) for the top and bottom bars, on top of the device
   * safe-area insets. Real devices supply their own insets; this is for
   * simulated chrome like the phone-preview frame, whose Dynamic Island and
   * rounded corners would otherwise clip the bars. Defaults to none.
   */
  chromeInsets?: { top?: number; bottom?: number };
  /** Optional overlay at the top of the map (live announcement, etc.). */
  banner?: React.ReactNode;
}) {
  const t = useTranslations("liveMap");
  const topInset = chromeInsets?.top ?? 0;
  const bottomInset = chromeInsets?.bottom ?? 0;
  const [map, setMap] = useState<L.Map | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [choices, setChoices] = useState<PoiData[] | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const flyingRef = useRef(false);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [offMapNotice, setOffMapNotice] = useState(false);
  const [view, setView] = useState<MapView>({
    lat: center.lat,
    lng: center.lng,
    zoom,
    bearing,
  });
  const onGeoChange = useCallback((state: GeoState) => setGeo(state), []);
  const onView = useCallback((next: MapView) => setView(next), []);
  // A category chip narrows both the map and the list until it is cleared.
  const [shownCategoryId, setShownCategoryId] = useState<string | null>(null);
  const usedCategories = useMemo(
    () =>
      markerStyle.categories
        .map((category) => ({
          category,
          count: pois.filter((poi) => poi.categoryId === category.id).length,
        }))
        .filter((c) => c.count > 0),
    [markerStyle.categories, pois],
  );
  const shownCategory = usedCategories.find((c) => c.category.id === shownCategoryId)?.category;
  const shown = useMemo(
    () => (shownCategory ? pois.filter((poi) => poi.categoryId === shownCategory.id) : pois),
    [pois, shownCategory],
  );
  const ordered = useMemo(() => walkOrder(shown), [shown]);
  const selected = selectedId ? shown.find((poi) => poi.id === selectedId) ?? null : null;
  const selectedIndex = selected ? ordered.indexOf(selected) : -1;

  const onPick = useCallback((hits: PoiData[]) => {
    setChoices(hits.length > 1 ? walkOrder(hits) : null);
    setSelectedId(hits.length === 1 ? hits[0].id : null);
  }, []);
  const closeSheet = useCallback(() => onPick([]), [onPick]);

  const needle = normalize(query);
  // Listed by stand number like the flyer legend, not by when points were added.
  const matches = needle ? ordered.filter((poi) => normalize(poi.title).includes(needle)) : ordered;

  // The sheet covers the bottom of the map: nudge the chosen point above it.
  const revealAboveSheet = useCallback(
    (poi: PoiData) => {
      if (!map) return;
      const sheet = sheetRef.current?.offsetHeight ?? 0;
      map.panInside([poi.lat, poi.lng], {
        paddingTopLeft: [32, 32],
        paddingBottomRight: [32, sheet + 32],
      });
    },
    [map],
  );

  useEffect(() => {
    if (selected && !flyingRef.current) revealAboveSheet(selected);
  }, [selected, revealAboveSheet]);

  useEffect(() => {
    if (!selected && !choices) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, choices, closeSheet]);

  useEffect(() => {
    if (!offMapNotice) return;
    const timer = window.setTimeout(() => setOffMapNotice(false), 5000);
    return () => window.clearTimeout(timer);
  }, [offMapNotice]);

  function closeList() {
    setListOpen(false);
    setQuery("");
  }

  function goToPoi(poi: PoiData) {
    closeList();
    onPick([poi]);
    if (!map) return;
    // Zoom 19 is where a street of stands 4 m apart shows readable codes.
    flyingRef.current = true;
    map.once("moveend", () => {
      flyingRef.current = false;
      revealAboveSheet(poi);
    });
    map.flyTo([poi.lat, poi.lng], Math.max(map.getZoom(), 19));
  }

  function locateMe() {
    if (!map || geo.status !== "active" || geo.lat == null || geo.lng == null) return;
    if (maxBounds && !isInsideBounds(geo.lat, geo.lng, maxBounds)) {
      setOffMapNotice(true);
      return;
    }
    setOffMapNotice(false);
    map.flyTo([geo.lat, geo.lng], Math.max(map.getZoom(), 17));
  }

  function recenter() {
    if (!map) return;
    map.setBearing?.(bearing);
    map.flyTo([center.lat, center.lng], zoom);
  }

  const navButton =
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium active:bg-black/5 dark:active:bg-white/10 disabled:opacity-40";

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Top navigation bar: event icon + name. In normal flow (not overlaying
          the map) so points near the top edge stay clickable and readable. */}
      <div
        className="z-[1000] shrink-0 border-b border-black/10 bg-white/95 dark:border-white/10 dark:bg-neutral-900/95"
        style={{ paddingTop: `calc(max(0.5rem, env(safe-area-inset-top)) + ${topInset}rem)` }}
      >
        <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-0.5">
          {eventLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={eventLogoUrl}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon icon={MapPin} size="sm" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{eventName}</p>
            <p className="truncate text-[11px] leading-tight opacity-60">{eventSubtitle || team.name}</p>
          </div>
        </div>
      </div>

      {/* Map fills the space between the bars. */}
      <div
        className="relative min-h-0 flex-1"
        data-testid="live-map-view"
        data-lat={view.lat}
        data-lng={view.lng}
        data-zoom={view.zoom}
        data-bearing={view.bearing}
      >
        {(banner || shownCategory) && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1050] flex flex-col items-center gap-2 p-3">
            {banner && <div className="pointer-events-auto w-full">{banner}</div>}
            {shownCategory && (
              <button
                type="button"
                onClick={() => {
                  onPick([]);
                  setShownCategoryId(null);
                }}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-neutral-900 py-1.5 pl-3 pr-2 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-neutral-900"
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: shownCategory.color }} />
                {t("only", { category: `${shownCategory.icon} ${shownCategory.name}` })}
                <span className="flex size-5 items-center justify-center rounded-full bg-white/20 dark:bg-black/10" aria-hidden>
                  <Icon icon={X} size="xs" />
                </span>
                <span className="sr-only">{t("showAll")}</span>
              </button>
            )}
          </div>
        )}
        <LeafletMap
          center={center}
          zoom={zoom}
          bearing={bearing}
          layout={layout}
          maxBounds={maxBounds}
          rotatable
          className="h-full w-full"
        >
          <MapRefCapture onMap={setMap} />
          <AttendeeMapBehavior onView={onView} />
          <PoiMarkers pois={shown} style={markerStyle} selectedId={selectedId} onPick={onPick} />
          <GeolocateLayer onChange={onGeoChange} maxBounds={maxBounds} />
          <CompassControl className="m-3" />
        </LeafletMap>
        {offMapNotice && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[1050] flex justify-center px-4">
            <p
              role="status"
              className="rounded-2xl bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white shadow-lg dark:bg-white dark:text-neutral-900"
            >
              {t("offMap")}
            </p>
          </div>
        )}
        {selected && (
          <PoiDetails
            style={markerStyle}
            ref={sheetRef}
            poi={selected}
            prev={ordered[selectedIndex - 1]}
            next={ordered[selectedIndex + 1]}
            onPick={(poi) => onPick([poi])}
            onClose={closeSheet}
          />
        )}
        {choices && (
          <PoiChooser
            ref={sheetRef}
            pois={choices}
            style={markerStyle}
            onPick={(poi) => onPick([poi])}
            onClose={closeSheet}
          />
        )}
      </div>

      {/* Points list: expands into a sheet above the bottom bar. */}
      {listOpen && (
        <div className="absolute inset-0 z-[1100] flex flex-col justify-end">
          <button
            type="button"
            aria-label={t("closeList")}
            onClick={closeList}
            className="flex-1 bg-black/30"
          />
          <div className="max-h-[65dvh] overflow-y-auto rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-neutral-950">
            <div className="sticky top-0 bg-white/95 px-5 pb-2 pt-3 backdrop-blur dark:bg-neutral-950/95">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/20 dark:bg-white/25" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {matches.length < pois.length
                    ? t("listTitleFiltered", { shown: matches.length, total: pois.length })
                    : t("listTitle", { total: pois.length })}
                </h2>
                <button
                  type="button"
                  onClick={closeList}
                  aria-label={t("collapseList")}
                  className="flex size-9 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                >
                  <Icon icon={ChevronDown} />
                </button>
              </div>
              {pois.length > 0 && (
                <div className="relative mt-2">
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && matches[0]) goToPoi(matches[0]);
                      if (e.key === "Escape") closeList();
                    }}
                    placeholder={t("searchPlaceholder")}
                    aria-label={t("search")}
                    enterKeyHint="go"
                    autoComplete="off"
                    className="w-full rounded-xl bg-black/5 py-2.5 pl-4 pr-11 text-base outline-none placeholder:opacity-50 focus:ring-2 focus:ring-brand dark:bg-white/10 [&::-webkit-search-cancel-button]:appearance-none"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        searchRef.current?.focus();
                      }}
                      aria-label={t("clearSearch")}
                      className="absolute inset-y-0 right-1 flex w-10 items-center justify-center opacity-50 hover:opacity-80"
                    >
                      <Icon icon={X} size="sm" />
                    </button>
                  )}
                </div>
              )}
              {usedCategories.length > 0 && (
                <div role="group" aria-label={t("categories")} className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
                  {[{ category: null, count: pois.length }, ...usedCategories].map(({ category, count }) => {
                    const on = (category?.id ?? null) === (shownCategory?.id ?? null);
                    return (
                      <button
                        key={category?.id ?? "all"}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          // A new filter starts clean: no sheet or chooser for points it hides.
                          onPick([]);
                          setShownCategoryId(category?.id ?? null);
                        }}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                          on
                            ? "border-transparent bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                            : "border-black/10 dark:border-white/15"
                        }`}
                      >
                        {category && (
                          <span aria-hidden className="size-2.5 rounded-full" style={{ background: category.color }} />
                        )}
                        {category ? `${category.icon} ${category.name}` : t("all")}
                        <span className="tabular-nums opacity-50">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <ul className="divide-y divide-black/10 px-5 dark:divide-white/15">
              {matches.map((poi) => (
                <li key={poi.id}>
                  <button
                    type="button"
                    onClick={() => goToPoi(poi)}
                    className="flex w-full items-center gap-3 py-3 text-left active:bg-black/5 dark:active:bg-white/10"
                  >
                    {poi.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poi.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                    ) : (
                      <PoiBadge poi={poi} style={markerStyle} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{poi.title}</p>
                      {poi.description && (
                        <p className="truncate text-xs opacity-60">{poi.description}</p>
                      )}
                    </div>
                    <Icon icon={ChevronRight} size="sm" className="opacity-40" />
                  </button>
                </li>
              ))}
              {pois.length === 0 && (
                <li className="py-6 text-center text-sm opacity-60">{t("empty")}</li>
              )}
              {pois.length > 0 && matches.length === 0 && (
                <li className="py-6 text-center text-sm opacity-60">{t("noMatch", { query: query.trim() })}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Bottom navigation bar: points list, locate, recenter. */}
      <div
        className="z-[1000] shrink-0 border-t border-black/10 bg-white/95 dark:border-white/10 dark:bg-neutral-900/95"
        style={{ paddingBottom: `calc(max(0rem, env(safe-area-inset-bottom)) + ${bottomInset}rem)` }}
      >
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => (listOpen ? closeList() : setListOpen(true))}
            aria-expanded={listOpen}
            className={`${navButton} ${listOpen ? "text-brand" : ""}`}
          >
            <Icon icon={MapPin} />
            {t("points", { count: pois.length })}
          </button>
          <button
            type="button"
            onClick={locateMe}
            disabled={geo.status !== "active"}
            title={
              geo.status === "denied"
                ? t("locationDenied")
                : geo.status === "unavailable"
                  ? t("locationUnavailable")
                  : t("showLocation")
            }
            className={navButton}
          >
            <Icon icon={Navigation} />
            {t("locate")}
          </button>
          <button type="button" onClick={recenter} className={navButton}>
            <Icon icon={Focus} />
            {t("recenter")}
          </button>
        </div>
      </div>
    </div>
  );
}
