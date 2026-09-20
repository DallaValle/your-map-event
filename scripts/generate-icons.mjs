// Renders PWA icons from the crafted brand mark.
// Rerun with: node scripts/generate-icons.mjs
import sharp from "sharp";

const src = "public/brand/logo-light.png";
const paper = { r: 244, g: 244, b: 241, alpha: 1 };

await sharp(src).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(src).resize(512, 512).png().toFile("public/icons/icon-512.png");

const inner = Math.round(512 * 0.6);
const pad = Math.round((512 - inner) / 2);
await sharp(src)
  .resize(inner, inner)
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: paper })
  .png()
  .toFile("public/icons/icon-maskable-512.png");

console.log("wrote icon-192.png, icon-512.png, icon-maskable-512.png");
