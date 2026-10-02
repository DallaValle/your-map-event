import { cache } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PublicMapCanvas } from "@/components/map/MapCanvas";
import { markerStyleOf } from "@/components/map/poi-badge";
import { getLatestAnnouncement } from "@/lib/notifications";
import { AnnouncementBanner } from "@/components/notifications/AnnouncementBanner";

interface PageProps {
  params: Promise<{ teamSlug: string; mapSlug: string }>;
}

// Cached per request: metadata, viewport and the page all read the same event.
const getPublicMap = cache(async (teamSlug: string, mapSlug: string) => {
  const team = await prisma.team.findUnique({ where: { slug: teamSlug } });
  if (!team) return null;
  const map = await prisma.event.findUnique({
    where: { teamId_slug: { teamId: team.id, slug: mapSlug } },
    include: {
      pois: { orderBy: { createdAt: "asc" } },
      categories: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!map || !map.published) return null;
  return { team, map };
});

// The browser status bar matches the organizer's bar color on phones.
export async function generateViewport({ params }: PageProps): Promise<Viewport> {
  const { teamSlug, mapSlug } = await params;
  const barColor = (await getPublicMap(teamSlug, mapSlug))?.map.barColor;
  return barColor ? { themeColor: barColor } : {};
}

// SEO for the attendee page: this is the link shared on posters and socials.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { teamSlug, mapSlug } = await params;
  const result = await getPublicMap(teamSlug, mapSlug);
  const t = await getTranslations("liveMap");
  if (!result) return { title: t("pageTitleNotFound") };
  const { team, map } = result;

  const description =
    map.description ?? t("pageDescription", { place: map.centerName, count: map.pois.length });

  return {
    title: `${map.name} – ${team.name}`,
    description,
    openGraph: {
      title: `${map.name} – ${team.name}`,
      description,
      ...(map.logoUrl
        ? { images: [map.logoUrl] }
        : team.logoUrl
          ? { images: [team.logoUrl] }
          : {}),
    },
  };
}

export default async function PublicMapPage({ params }: PageProps) {
  const { teamSlug, mapSlug } = await params;
  const result = await getPublicMap(teamSlug, mapSlug);
  if (!result) notFound();
  const { team, map } = result;
  const latest = await getLatestAnnouncement(map.id);
  const t = await getTranslations("liveMap");

  return (
    <main className="relative h-dvh w-full">
      <h1 className="sr-only">
        {t("pageHeading", { event: map.name, team: team.name })}
      </h1>

      <PublicMapCanvas
        center={{ lat: map.centerLat, lng: map.centerLng }}
        zoom={map.zoom}
        bearing={map.bearing}
        layout={map.mapLayout}
        pois={map.pois}
        markerStyle={markerStyleOf(map, map.categories)}
        eventName={map.name}
        eventSubtitle={map.subtitle}
        eventLogoUrl={map.logoUrl}
        barColor={map.barColor}
        team={{ name: team.name }}
        maxBounds={
          map.boundsSWLat != null
            ? {
                swLat: map.boundsSWLat,
                swLng: map.boundsSWLng!,
                neLat: map.boundsNELat!,
                neLng: map.boundsNELng!,
              }
            : null
        }
        banner={
          latest ? <AnnouncementBanner title={latest.title} body={latest.body} /> : undefined
        }
      />
    </main>
  );
}
