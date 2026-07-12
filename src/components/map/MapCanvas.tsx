"use client";

// Leaflet reads `window` at import time, so it can never run during SSR.
// In Next 15 `dynamic(..., { ssr: false })` is only allowed inside client
// components — this file IS that client boundary. Server pages import these
// wrappers, never LeafletMap/PublicMap/etc. directly.
import dynamic from "next/dynamic";

function MapLoading() {
  return (
    <div className="flex h-full min-h-40 w-full animate-pulse items-center justify-center rounded-2xl bg-black/5 text-sm opacity-60 dark:bg-white/10">
      Loading map…
    </div>
  );
}

export const PublicMapCanvas = dynamic(() => import("./PublicMap"), {
  ssr: false,
  loading: MapLoading,
});

export const PickerMapCanvas = dynamic(() => import("./PickerMap"), {
  ssr: false,
  loading: MapLoading,
});

export const EditorMapCanvas = dynamic(() => import("./EditorMapView"), {
  ssr: false,
  loading: MapLoading,
});
