import L from "leaflet";

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
