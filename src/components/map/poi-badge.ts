import {
  MARKER_LABELS,
  type MarkerLabel,
  type MarkerStyle,
  type PoiCategoryData,
  type PoiData,
} from "./types";

/**
 * Stand codes as printed on event flyers: "12. Micèl", "C. Tami Bar", "GS. Gara".
 * Only digits, all caps or a single lowercase letter count, so "St. Moritz" stays a name.
 */
const CODE_RE = /^(\d{1,3}[A-Za-z]?|[A-Z]{1,4}|[a-z])\.\s+(\S.*)$/;

/** The point's stand code and display name: an explicit code wins over a title prefix. */
export function poiCode(poi: Pick<PoiData, "title" | "code">): { code: string | null; name: string } {
  const m = poi.title.match(CODE_RE);
  const code = poi.code?.trim() || null;
  if (code) return { code, name: m && m[1] === code ? m[2] : poi.title };
  return m ? { code: m[1], name: m[2] } : { code: null, name: poi.title };
}

const GROUPS: { color: string; name: string; icons: string[] }[] = [
  { color: "#8a1538", name: "Drinks", icons: ["🍷", "🍺", "🍸", "🍹", "🥂", "🍾", "☕", "💧"] },
  { color: "#16803c", name: "Food", icons: ["🍔", "🍕", "🥪", "🥙", "🌮", "🍣", "🍝", "🍦", "🥞", "🧀", "🐟", "🍟", "🌭", "🥗", "🍜", "🍰", "🧁", "🍩", "🥐", "🍖", "🍗"] },
  { color: "#d4217a", name: "Shops", icons: ["🛍️"] },
  { color: "#1d5fc4", name: "Services", icons: ["ℹ️", "🚻", "⛑️", "🔌", "🚪"] },
  { color: "#1d4ea0", name: "Parking", icons: ["🅿️"] },
  { color: "#e36a12", name: "Activities", icons: ["🎤", "🎪", "🎡", "🧸", "🎓", "🎈", "🏃", "🎨", "🏆"] },
];

/** Names that read well for a category made from a single icon. */
const ICON_NAMES: Record<string, string> = {
  "🍷": "Wine", "🍺": "Beer", "☕": "Coffee", "💧": "Water", "🍕": "Pizza", "🍦": "Ice cream",
  "🍔": "Food", "🛍️": "Shops", "ℹ️": "Info", "🚻": "Toilets", "⛑️": "First aid", "🅿️": "Parking",
  "🚪": "Entrances", "🎤": "Stages", "🎪": "Tents", "🎡": "Rides", "🧸": "Kids", "🔌": "Charging",
};

/** Default color for an icon, so a new category already looks like a printed legend. */
export function suggestedColor(icon: string | null): string {
  return GROUPS.find((g) => icon && g.icons.includes(icon))?.color ?? "#0f766e";
}

export interface CategorySuggestion {
  /** Stable id of the suggestion: the icon group, or the lone icon. */
  key: string;
  name: string;
  icon: string;
  color: string;
  icons: string[];
  count: number;
}

/**
 * Categories worth creating from the icons of uncategorized points. Related
 * icons share one ("Food" for 🍕 🥪 🍝), so each point keeps its own emoji
 * and the legend stays short.
 */
export function suggestCategories(pois: Pick<PoiData, "icon" | "categoryId">[]): CategorySuggestion[] {
  const byIcon = new Map<string, number>();
  for (const poi of pois) {
    if (poi.categoryId || !poi.icon) continue;
    byIcon.set(poi.icon, (byIcon.get(poi.icon) ?? 0) + 1);
  }
  const buckets = new Map<string, { group?: (typeof GROUPS)[number]; icons: [string, number][] }>();
  for (const [icon, count] of byIcon) {
    const group = GROUPS.find((g) => g.icons.includes(icon));
    const key = group ? `group:${group.name}` : `icon:${icon}`;
    const bucket = buckets.get(key) ?? { group, icons: [] };
    bucket.icons.push([icon, count]);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .map(([key, { group, icons }]) => {
      icons.sort((a, b) => b[1] - a[1]);
      const [top] = icons[0];
      return {
        key,
        // A group used through one icon reads better by that icon: "Wine", not "Drinks".
        name: (icons.length === 1 ? ICON_NAMES[top] : undefined) ?? group?.name ?? ICON_NAMES[top] ?? "New category",
        icon: top,
        color: group?.color ?? suggestedColor(top),
        icons: icons.map(([icon]) => icon),
        count: icons.reduce((sum, [, n]) => sum + n, 0),
      };
    })
    // Ties by name: points created in one batch share a timestamp, so their order is not stable.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export const isParking = (icon: string | null) => icon === "🅿️";

/** What one marker shows, after the event style, its category and its own overrides. */
export function resolveBadge(poi: PoiData, style: MarkerStyle) {
  const category = poi.categoryId ? style.categories.find((c) => c.id === poi.categoryId) : undefined;
  const icon = poi.icon || category?.icon || null;
  const { code, name } = poiCode(poi);
  const iconLabel = isParking(icon) ? "P" : icon || "📍";
  const label =
    style.label === "icon" ? iconLabel : style.label === "number" ? code : (code ?? iconLabel);
  return {
    label,
    code,
    name,
    icon,
    category,
    color: poi.color || style.color || category?.color || suggestedColor(icon),
    square: isParking(icon),
  };
}

/** Numbers first, then letter codes, then uncoded points in their saved order. */
export function walkOrder<T extends PoiData>(pois: T[]): T[] {
  const rank = (code: string | null) => (code == null ? 2 : /^\d/.test(code) ? 0 : 1);
  return pois
    .map((poi, i) => ({ poi, i, code: poiCode(poi).code }))
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

/** The admin's saved choices as the shape the markers read. */
export function markerStyleOf(
  event: { markerLabel: string; markerColor: string | null },
  categories: PoiCategoryData[],
): MarkerStyle {
  const label = (MARKER_LABELS as readonly string[]).includes(event.markerLabel)
    ? (event.markerLabel as MarkerLabel)
    : "auto";
  return {
    label,
    color: event.markerColor,
    categories: categories.map(({ id, name, icon, color }) => ({ id, name, icon, color })),
  };
}
