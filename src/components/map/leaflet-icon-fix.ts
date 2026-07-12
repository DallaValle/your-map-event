import L from "leaflet";

// Leaflet resolves its default marker images relative to the stylesheet URL,
// which breaks under bundlers ("iconUrl not set in Icon options"). Bundler
// image imports are also unreliable here (webpack returns StaticImageData,
// Turbopack dev handles node_modules PNGs differently), so the three marker
// images are copied into public/leaflet/ and referenced by plain URL — this
// works identically in dev and production.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});
