import L from "leaflet";

const iconCache = new Map<string, L.DivIcon>();

/**
 * Round white marker with an emoji face and a downward pointer at the
 * bottom-centre — recognizable at a glance, and the tip marks the exact
 * coordinate (iconAnchor sits on the pointer tip). More scannable on a
 * crowded event map than identical blue pins.
 */
export function poiDivIcon(emoji?: string | null): L.DivIcon {
  const face = emoji || "📍";
  let icon = iconCache.get(face);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      iconSize: [40, 48],
      // Tip of the pointer = the point's real location.
      iconAnchor: [20, 46],
      // Popup opens just above the bubble, tip aligned over the pointer.
      popupAnchor: [0, -46],
      html: `<div style="position:relative;width:40px;height:48px">
        <div style="position:absolute;top:0;left:2px;box-sizing:border-box;width:36px;height:36px;border-radius:9999px;background:#fff;border:2px solid #0f766e;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:19px;line-height:1">${face}</div>
        <div style="position:absolute;top:34px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid #0f766e"></div>
      </div>`,
    });
    iconCache.set(face, icon);
  }
  return icon;
}
