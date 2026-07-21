import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicMapCanvas } from "@/components/map/MapCanvas";

interface PageProps {
  params: Promise<{ teamSlug: string; mapSlug: string }>;
}

async function getPublicMap(teamSlug: string, mapSlug: string) {
  const team = await prisma.team.findUnique({ where: { slug: teamSlug } });
  if (!team) return null;
  const map = await prisma.event.findUnique({
    where: { teamId_slug: { teamId: team.id, slug: mapSlug } },
    include: { pois: { orderBy: { createdAt: "asc" } } },
  });
  if (!map || !map.published) return null;
  return { team, map };
}

// SEO for the attendee page: this is the link shared on posters and socials.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { teamSlug, mapSlug } = await params;
  const result = await getPublicMap(teamSlug, mapSlug);
  if (!result) return { title: "Map not found" };
  const { team, map } = result;

  const description =
    map.description ??
    `Interactive event map of ${map.centerName} with ${map.pois.length} points of interest.`;

  return {
    title: `${map.name} – ${team.name}`,
    description,
    openGraph: {
      title: `${map.name} – ${team.name}`,
      description,
      ...(team.logoUrl ? { images: [team.logoUrl] } : {}),
    },
  };
}

export default async function PublicMapPage({ params }: PageProps) {
  const { teamSlug, mapSlug } = await params;
  const result = await getPublicMap(teamSlug, mapSlug);
  if (!result) notFound();
  const { team, map } = result;

  return (
    <main className="relative h-dvh w-full">
      <h1 className="sr-only">
        {map.name} – interactive event map by {team.name}
      </h1>

      <PublicMapCanvas
        center={{ lat: map.centerLat, lng: map.centerLng }}
        zoom={map.zoom}
        bearing={map.bearing}
        pois={map.pois}
        team={{ name: team.name, logoUrl: team.logoUrl }}
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
      />
    </main>
  );
}
