// Renders favicon, Apple touch icon and PWA icons from the map pin mark.
// Rerun with: node scripts/generate-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const brand = "#163f3a";
const paper = { r: 244, g: 244, b: 241, alpha: 1 };

// mark.svg is drawn in black so BrandMark can use it as a CSS mask.
const mark = Buffer.from(
  (await readFile("public/brand/mark.svg", "utf8")).replaceAll("#000", brand),
);

/** The mark on paper, scaled to `inner` px and centered in a `size` px square. */
function render(size, inner = size) {
  const pad = Math.round((size - inner) / 2);
  return sharp(mark, { density: 72 * (inner / 192) * 2 })
    .resize(inner, inner)
    .flatten({ background: paper })
    .extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad, background: paper })
    .png();
}

// Launchers add their own tile, so the mark keeps a margin like other app icons.
const framed = (size) => render(size, Math.round(size * 0.78));

await framed(192).toFile("public/icons/icon-192.png");
await framed(512).toFile("public/icons/icon-512.png");
// Maskable icons get cropped to a circle: keep the mark inside the 80% safe zone.
await render(512, Math.round(512 * 0.6)).toFile("public/icons/icon-maskable-512.png");
await framed(180).toFile("src/app/apple-icon.png");

// Full bleed so the pin stays legible at 16px. ICO with one embedded PNG: every current browser accepts it.
const png = await render(48).ensureAlpha().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(48, 6);
header.writeUInt8(48, 7);
header.writeUInt16LE(1, 10); // color planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile("src/app/favicon.ico", Buffer.concat([header, png]));

console.log("wrote icon-192, icon-512, icon-maskable-512, apple-icon.png, favicon.ico");
