import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ teamSlug: string }>;
}

async function getTeamWithPublishedMaps(teamSlug: string) {
  return prisma.team.findUnique({
    where: { slug: teamSlug },
    include: {
      maps: {
        where: { published: true },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { pois: true } } },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { teamSlug } = await params;
  const team = await getTeamWithPublishedMaps(teamSlug);
  if (!team) return { title: "Not found" };
  return {
    title: team.name,
    description: `Event maps by ${team.name}.`,
    ...(team.logoUrl ? { openGraph: { images: [team.logoUrl] } } : {}),
  };
}

/**
 * Team landing: with a single published map, attendees go straight to it;
 * with several, they pick from a list.
 */
export default async function TeamPage({ params }: PageProps) {
  const { teamSlug } = await params;
  const team = await getTeamWithPublishedMaps(teamSlug);
  if (!team) notFound();

  if (team.maps.length === 1) {
    redirect(`/${team.slug}/${team.maps[0].slug}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-6 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-full bg-teal-700/10 text-3xl">📍</span>
        )}
        <h1 className="text-2xl font-bold">{team.name}</h1>
      </header>

      {team.maps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 px-4 py-10 text-center text-sm opacity-60 dark:border-white/25">
          No published event map yet — check back closer to the event.
        </p>
      ) : (
        <ul className="space-y-3">
          {team.maps.map((map) => (
            <li key={map.id}>
              <Link
                href={`/${team.slug}/${map.slug}`}
                className="block rounded-2xl border border-black/10 p-4 active:bg-black/5 dark:border-white/15 dark:active:bg-white/5"
              >
                <h2 className="font-semibold">{map.name}</h2>
                <p className="mt-1 text-sm opacity-60">
                  {map.centerName} · {map._count.pois} point
                  {map._count.pois === 1 ? "" : "s"} of interest
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
