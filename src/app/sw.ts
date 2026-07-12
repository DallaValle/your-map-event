import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  CacheFirst,
  ExpirationPlugin,
  CacheableResponsePlugin,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // OSM tiles: cache-first so tiles the attendee already viewed keep
      // working with a flaky connection on the event grounds. This caches
      // opportunistically only (no bulk prefetch), which complies with the
      // OSM tile usage policy. Bounded so we never hoard the tile pyramid.
      matcher: ({ url }) => url.origin === "https://tile.openstreetmap.org",
      handler: new CacheFirst({
        cacheName: "osm-tiles",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 250,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    {
      // POI/logo images (UploadThing CDN or arbitrary URLs).
      matcher: ({ request, sameOrigin }) =>
        request.destination === "image" && !sameOrigin,
      handler: new CacheFirst({
        cacheName: "remote-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 120,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
