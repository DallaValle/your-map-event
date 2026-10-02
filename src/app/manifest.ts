import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";

// Follows the device language like the attendee map, so an installed app reads the same.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("manifest");
  return {
    name: "Your Map Event",
    short_name: "MapEvent",
    description: t("description"),
    lang: await getLocale(),
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#163f3a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
