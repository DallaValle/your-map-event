// Renders PWA icons from the crafted brand mark.
// Rerun with: node scripts/generate-icons.mjs
import sharp from "sharp";

const src = "public/brand/logo-light.png";

for (const [file, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
]) {
  await sharp(src).resize(size, size).png().toFile(`public/icons/${file}`);
  console.log("wrote", file);
}
