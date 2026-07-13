import L from "leaflet";

const iconCache = new Map<string, L.DivIcon>();

/**
 * Round white marker with an emoji face — recognizable at a glance and far
 * more scannable on a crowded event map than identical blue pins.
 */
export function poiDivIcon(emoji?: string | null): L.DivIcon {
  const face = emoji || "📍";
  let icon = iconCache.get(face);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      iconSize: [36, 36],
      iconAnchor: [18, 34],
      popupAnchor: [0, -30],
      html: `<div style="width:36px;height:36px;border-radius:9999px 9999px 9999px 2px;transform:rotate(0deg);background:#fff;border:2px solid #0f766e;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:19px;line-height:1">${face}</div>`,
    });
    iconCache.set(face, icon);
  }
  return icon;
}
