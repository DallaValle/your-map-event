"use client";

// Leaflet reads `window` at import time, so it can never run during SSR.
// In Next 15 `dynamic(..., { ssr: false })` is only allowed inside client
// components — this file IS that client boundary. Server pages import these
// wrappers, never LeafletMap/PublicMap/etc. directly.
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/nav/BrandMark";

function MapLoading() {
  const t = useTranslations("liveMap");
  return (
    <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-black/5 text-sm dark:bg-white/10">
      <BrandMark size={40} className="animate-pulse" />
      <span className="opacity-60">{t("loading")}</span>
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
