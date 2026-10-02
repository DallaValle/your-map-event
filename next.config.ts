import { readdirSync } from "node:fs";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

// Serwist hooks into the webpack build only. `next dev` runs Turbopack, so
// the service worker is disabled in development and produced by `next build`
// (which stays on webpack — do NOT switch the build script to --turbopack).
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Every messages/<locale>.json is a supported language; English first as the source.
const locales = readdirSync("messages")
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""))
  .sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : a.localeCompare(b)));

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_LOCALES: locales.join(",") },
};

export default withNextIntl(withSerwist(nextConfig));
