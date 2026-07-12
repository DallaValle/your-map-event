// Renders the app icon (map pin on teal) at the PWA sizes.
// Rerun with: node scripts/generate-icons.mjs
import sharp from "sharp";

const icon = (padded) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${padded ? 0 : 96}" fill="#0f766e"/>
  <g transform="translate(256 236) scale(${padded ? 0.72 : 1}) translate(-256 -236)">
    <path d="M256 96c-62 0-112 50-112 112 0 84 112 208 112 208s112-124 112-208c0-62-50-112-112-112z" fill="#ffffff"/>
    <circle cx="256" cy="208" r="52" fill="#0f766e"/>
  </g>
</svg>`;

for (const [file, size, padded] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
]) {
  await sharp(Buffer.from(icon(padded))).resize(size, size).png().toFile(`public/icons/${file}`);
  console.log("wrote", file);
}
