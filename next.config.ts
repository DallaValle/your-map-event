import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Serwist hooks into the webpack build only. `next dev` runs Turbopack, so
// the service worker is disabled in development and produced by `next build`
// (which stays on webpack — do NOT switch the build script to --turbopack).
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
