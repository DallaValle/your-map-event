/** Minimal POI shape shared by the editor and the public viewer. */
export interface PoiData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  /** Emoji shown on the marker (null = default pin). */
  icon: string | null;
  lat: number;
  lng: number;
}

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
