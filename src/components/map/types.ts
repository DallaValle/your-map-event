/** Minimal POI shape shared by the editor and the public viewer. */
export interface PoiData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  /** Emoji shown on the marker (null = the category icon, else a pin). */
  icon: string | null;
  lat: number;
  lng: number;
  /** Stand number or letter ("12", "C"); null falls back to a "12." title prefix. */
  code?: string | null;
  categoryId?: string | null;
  /** Overrides the category color for this marker. */
  color?: string | null;
}

/** Legend group: its markers share an icon and a color. */
export interface PoiCategoryData {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const MARKER_LABELS = ["auto", "number", "icon"] as const;
export type MarkerLabel = (typeof MARKER_LABELS)[number];

/** Event wide marker look chosen by the admin. */
export interface MarkerStyle {
  label: MarkerLabel;
  /** One color for every marker; null colors them by category. */
  color: string | null;
  categories: PoiCategoryData[];
}

export const DEFAULT_MARKER_STYLE: MarkerStyle = { label: "auto", color: null, categories: [] };

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Emoji choices offered in the POI form — typical event infrastructure.
 * Lives here (leaflet-free module) so forms outside the map bundle can
 * import it without dragging Leaflet into SSR.
 */
export const POI_ICONS = [
  "📍",
  "🎤",
  "🎪",
  "🍔",
  "🍺",
  "☕",
  "🚻",
  "⛑️",
  "ℹ️",
  "💧",
  "🛍️",
  "🅿️",
  "🚪",
  "🎡",
  "🧸",
  "🔌",
] as const;
