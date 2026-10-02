"use client";

import type { Ref } from "react";
import { useTranslations } from "next-intl";
import { poiCode, resolveBadge } from "./poi-badge";
import { DEFAULT_MARKER_STYLE, type MarkerStyle, type PoiData } from "./types";

/** The map badge in list form, so the list and the map read the same. */
export function PoiBadge({
  poi,
  style = DEFAULT_MARKER_STYLE,
  large = false,
}: {
  poi: PoiData;
  style?: MarkerStyle;
  large?: boolean;
}) {
  const { label, icon, color, square } = resolveBadge(poi, style);
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center font-bold text-white shadow-sm ${
        square ? "rounded-md" : "rounded-full"
      } ${large ? "size-11 text-base" : "size-10 text-sm"}`}
      style={{ background: color }}
    >
      {label ?? (icon || "📍")}
    </span>
  );
}

function shortName(poi: PoiData) {
  const { code, name } = poiCode(poi);
  const first = name.split(",")[0];
  return `${code ? `${code} ` : ""}${first}`;
}

const sheetClass =
  "absolute inset-x-0 bottom-0 z-[1060] max-h-[60%] overflow-y-auto rounded-t-3xl bg-white px-5 pb-4 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] dark:bg-neutral-950";

function Header({ onClose }: { onClose: () => void }) {
  const t = useTranslations("liveMap");
  return (
    <>
      <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-black/20 dark:bg-white/25" />
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/5 text-sm dark:bg-white/10"
      >
        ✕
      </button>
    </>
  );
}

/** Several points under one tap: list them in walking order and let the attendee pick. */
export function PoiChooser({
  pois,
  style,
  onPick,
  onClose,
  ref,
}: {
  pois: PoiData[];
  style?: MarkerStyle;
  onPick: (poi: PoiData) => void;
  onClose: () => void;
  ref?: Ref<HTMLElement>;
}) {
  const t = useTranslations("liveMap");
  return (
    <section ref={ref} aria-label={t("pointsHereLabel")} className={sheetClass}>
      <Header onClose={onClose} />
      <h2 className="pb-2 pr-10 pt-1 text-base font-bold">{t("pointsHere", { count: pois.length })}</h2>
      <ul className="divide-y divide-black/10 dark:divide-white/15">
        {pois.map((poi) => (
          <li key={poi.id}>
            <button
              type="button"
              onClick={() => onPick(poi)}
              className="flex w-full items-center gap-3 py-2.5 text-left active:bg-black/5 dark:active:bg-white/10"
            >
              <PoiBadge poi={poi} style={style} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{poiCode(poi).name}</span>
                {poi.description && (
                  <span className="block truncate text-xs opacity-60">{poi.description}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One point's details, with neighbours so a row of stands can be walked in order. */
export function PoiDetails({
  poi,
  style = DEFAULT_MARKER_STYLE,
  prev,
  next,
  onPick,
  onClose,
  ref,
}: {
  poi: PoiData;
  style?: MarkerStyle;
  prev?: PoiData;
  next?: PoiData;
  onPick: (poi: PoiData) => void;
  onClose: () => void;
  ref?: Ref<HTMLElement>;
}) {
  const t = useTranslations("liveMap");
  const { name, category } = resolveBadge(poi, style);
  const step =
    "flex min-h-11 min-w-0 flex-1 items-center gap-1 rounded-xl border border-black/10 px-3 text-sm font-semibold active:bg-black/5 disabled:opacity-30 dark:border-white/15 dark:active:bg-white/10";

  return (
    <section ref={ref} aria-label={t("details")} className={sheetClass}>
      <Header onClose={onClose} />
      <div className="space-y-3 pt-1">
        {poi.imageUrl && (
          // Plain <img>: remote organizer uploads, sized by the sheet.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poi.imageUrl} alt={poi.title} className="h-32 w-full rounded-xl object-cover" />
        )}
        <div className="flex items-start gap-3 pr-10">
          <PoiBadge poi={poi} style={style} large />
          <div className="min-w-0">
            {category && (
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">
                {category.icon} {category.name}
              </p>
            )}
            <h2 className="text-lg font-bold leading-tight">{name}</h2>
            {poi.description && (
              <p className="mt-1 text-sm leading-snug opacity-80">{poi.description}</p>
            )}
          </div>
        </div>
        {(prev || next) && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && onPick(prev)}
              aria-label={prev ? t("previous", { name: prev.title }) : t("noPrevious")}
              className={step}
            >
              <span aria-hidden>‹</span>
              <span className="truncate">{prev && shortName(prev)}</span>
            </button>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && onPick(next)}
              aria-label={next ? t("next", { name: next.title }) : t("noNext")}
              className={`${step} justify-end`}
            >
              <span className="truncate">{next && shortName(next)}</span>
              <span aria-hidden>›</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
