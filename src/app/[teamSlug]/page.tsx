import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicMapCanvas } from "@/components/map/MapCanvas";

interface PageProps {
  params: Promise<{ teamSlug: string }>;
}

async function getPublicTeam(teamSlug: string) {
  return prisma.team.findUnique({
    where: { slug: teamSlug },
    include: {
      maps: {
        where: { published: true },
        orderBy: { updatedAt: "desc" },
        include: { pois: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
}

// SEO for the public event page: this is the link attendees share around.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { teamSlug } = await params;
  const team = await getPublicTeam(teamSlug);
  if (!team) return { title: "Map not found" };

  const map = team.maps[0];
  const description =
    map?.description ??
    (map
      ? `Interactive event map of ${map.centerName} with ${map.pois.length} points of interest.`
      : `${team.name} on Your Map Event.`);

  return {
    title: map ? `${map.name} – ${team.name}` : team.name,
    description,
    openGraph: {
      title: map ? `${map.name} – ${team.name}` : team.name,
      description,
      ...(team.logoUrl ? { images: [team.logoUrl] } : {}),
    },
  };
}

export default async function PublicMapPage({ params }: PageProps) {
  const { teamSlug } = await params;
  const team = await getPublicTeam(teamSlug);
  if (!team) notFound();

  const [primaryMap] = team.maps;

  if (!primaryMap) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-4xl" aria-hidden>🗺️</span>
        <h1 className="text-xl font-bold">{team.name}</h1>
        <p className="max-w-xs text-sm opacity-70">
          No published event map yet — check back closer to the event.
        </p>
      </main>
    );
  }

  // Attendees get everything the team has published, on one map.
  const pois = team.maps.flatMap((map) => map.pois);

  return (
    <main className="relative h-dvh w-full">
      <h1 className="sr-only">
        {primaryMap.name} – interactive event map by {team.name}
      </h1>

      <PublicMapCanvas
        center={{ lat: primaryMap.centerLat, lng: primaryMap.centerLng }}
        zoom={primaryMap.zoom}
        pois={pois}
      />

      {/* Team chip: pointer-events pass through except on the chip itself. */}
      <div className="pointer-events-none absolute right-3 top-3 z-[1000]">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-1.5 pr-3 shadow-lg backdrop-blur dark:bg-neutral-900/95">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-teal-700/10 text-sm">📍</span>
          )}
          <span className="max-w-32 truncate text-sm font-semibold">{team.name}</span>
        </div>
      </div>
    </main>
  );
}
