import type { PoiData } from "./types";

/**
 * Stand codes as printed on event flyers: "12. Micèl", "C. Tami Bar", "GS. Gara".
 * Only digits, all caps or a single lowercase letter count, so "St. Moritz" stays a name.
 */
const CODE_RE = /^(\d{1,3}[A-Za-z]?|[A-Z]{1,4}|[a-z])\.\s+(\S.*)$/;

export function poiCode(title: string): { code: string | null; name: string } {
  const m = title.match(CODE_RE);
  return m ? { code: m[1], name: m[2] } : { code: null, name: title };
}

const GROUPS: { color: string; icons: string[] }[] = [
  { color: "#8a1538", icons: ["🍷", "🍺", "🍸", "🍹", "🥂", "🍾", "☕", "💧"] },
  { color: "#16803c", icons: ["🍔", "🍕", "🥪", "🥙", "🌮", "🍣", "🍝", "🍦", "🥞", "🧀", "🐟", "🍟", "🌭", "🥗", "🍜", "🍰", "🧁", "🍩", "🥐", "🍖", "🍗"] },
  { color: "#d4217a", icons: ["🛍️"] },
  { color: "#1d5fc4", icons: ["ℹ️", "🚻", "⛑️", "🔌", "🚪"] },
  { color: "#1d4ea0", icons: ["🅿️"] },
  { color: "#e36a12", icons: ["🎤", "🎪", "🎡", "🧸", "🎓", "🎈", "🏃", "🎨", "🏆"] },
];

/** Category color, so a row of stands reads like the printed map legend. */
export function poiColor(icon: string | null): string {
  return GROUPS.find((g) => icon && g.icons.includes(icon))?.color ?? "#0f766e";
}

export const isParking = (icon: string | null) => icon === "🅿️";

/** Numbers first, then letter codes, then uncoded points in their saved order. */
export function walkOrder(pois: PoiData[]): PoiData[] {
  const rank = (code: string | null) => (code == null ? 2 : /^\d/.test(code) ? 0 : 1);
  return pois
    .map((poi, i) => ({ poi, i, code: poiCode(poi.title).code }))
    .sort((a, b) => {
      const r = rank(a.code) - rank(b.code);
      if (r) return r;
      if (a.code && b.code) return a.code.localeCompare(b.code, undefined, { numeric: true });
      return a.i - b.i;
    })
    .map((x) => x.poi);
}

function metersBetween(a: PoiData, b: PoiData) {
  const k = Math.PI / 180;
  const x = (b.lng - a.lng) * k * Math.cos(((a.lat + b.lat) / 2) * k);
  const y = (b.lat - a.lat) * k;
  return Math.hypot(x, y) * 6_371_000;
}

/** Distance from each point to its closest neighbour: how much room its badge has. */
export function nearestSpacing(pois: PoiData[]): Map<string, number> {
  return new Map(
    pois.map((a) => [
      a.id,
      pois.reduce((min, b) => (b === a ? min : Math.min(min, metersBetween(a, b))), Infinity),
    ]),
  );
}

export const BADGE_MIN = 10;
export const BADGE_MAX = 34;
/** Below this the badge is a plain dot: a code would not be legible. */
export const BADGE_LABEL_MIN = 18;

/**
 * Badges grow with zoom until they would touch their neighbour, so a lone
 * parking lot is a full badge at once and a street of stands 4 m apart starts as dots.
 */
export function badgeSize(spacingMeters: number, zoom: number, lat: number): number {
  const metersPerPixel = (156_543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  const px = (spacingMeters / metersPerPixel) * 0.95;
  return Math.round(Math.min(BADGE_MAX, Math.max(BADGE_MIN, px)));
}
