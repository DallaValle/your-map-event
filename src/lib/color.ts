/** What `<input type="color">` produces, and the only form we store. */
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const DARK_TEXT = "#0c0c0c";
const LIGHT_TEXT = "#ffffff";

/** WCAG relative luminance of a #rrggbb color. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text color with the higher contrast ratio on this background, so any organizer color stays legible. */
export function readableTextOn(hex: string) {
  const l = luminance(hex);
  const onDark = (1 + 0.05) / (l + 0.05);
  const onLight = (l + 0.05) / (luminance(DARK_TEXT) + 0.05);
  return onDark >= onLight ? LIGHT_TEXT : DARK_TEXT;
}
