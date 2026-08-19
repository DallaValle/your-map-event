/**
 * Basemap / layout presets for event maps.
 * All sources are free for production use with the listed attribution.
 */

export const MAP_LAYOUTS = {
  streets: {
    id: "streets",
    label: "Streets",
    description: "Classic OpenStreetMap roads and labels",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  light: {
    id: "light",
    label: "Light",
    description: "Clean light basemap, great for dense venues",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  dark: {
    id: "dark",
    label: "Dark",
    description: "Dark basemap for evening events",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    description: "Aerial imagery for outdoor grounds",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
  outdoors: {
    id: "outdoors",
    label: "Outdoors",
    description: "Terrain and trails for parks and festivals",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
  },
} as const;

export type MapLayoutId = keyof typeof MAP_LAYOUTS;

export const MAP_LAYOUT_IDS = Object.keys(MAP_LAYOUTS) as MapLayoutId[];

export const DEFAULT_MAP_LAYOUT: MapLayoutId = "streets";

export function isMapLayoutId(value: unknown): value is MapLayoutId {
  return typeof value === "string" && value in MAP_LAYOUTS;
}

export function resolveMapLayout(value: unknown) {
  return MAP_LAYOUTS[isMapLayoutId(value) ? value : DEFAULT_MAP_LAYOUT];
}
