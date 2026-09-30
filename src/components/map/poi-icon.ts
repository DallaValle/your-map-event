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

const badgeCache = new Map<string, L.DivIcon>();

/**
 * Flyer style badge centred on the exact coordinate: a category dot that shows
 * the stand code (or emoji) once it is big enough to read.
 */
export function poiBadgeIcon({
  label,
  color,
  size,
  square = false,
  selected = false,
  showLabel,
}: {
  label: string;
  color: string;
  size: number;
  square?: boolean;
  selected?: boolean;
  showLabel: boolean;
}): L.DivIcon {
  const key = [label, color, size, square, selected, showLabel].join("|");
  let icon = badgeCache.get(key);
  if (!icon) {
    const text = showLabel ? escapeHtml(label) : "";
    // Long codes ("AIES") widen into a pill instead of shrinking the text.
    const width = showLabel && label.length > 2 ? Math.round(size + (label.length - 2) * size * 0.34) : size;
    const fontSize = Math.round(size * (label.length > 2 ? 0.42 : 0.52));
    const ring = selected
      ? "box-shadow:0 0 0 3px #fff,0 0 0 6px #0f766e,0 3px 8px rgba(0,0,0,.45);"
      : "box-shadow:0 1px 3px rgba(0,0,0,.4);";
    icon = L.divIcon({
      className: "poi-badge",
      iconSize: [width, size],
      iconAnchor: [width / 2, size / 2],
      html: `<div data-selected="${selected}" style="box-sizing:border-box;width:${width}px;height:${size}px;border-radius:${square ? "4px" : "9999px"};background:${color};border:1.5px solid #fff;${ring}display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${fontSize}px/1 system-ui,-apple-system,sans-serif;letter-spacing:-.02em;white-space:nowrap">${text}</div>`,
    });
    badgeCache.set(key, icon);
  }
  return icon;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
