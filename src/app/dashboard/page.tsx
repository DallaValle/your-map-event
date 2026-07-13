import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { CreateTeamForm } from "@/components/team/CreateTeamForm";
import { ShareCard } from "@/components/share/ShareCard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const membership = await getMyTeam();

  // No team yet (fresh account or social sign-up): offer to create one.
  if (!membership) {
    return (
      <main className="flex flex-col gap-6 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Create your team</h1>
          <p className="text-sm opacity-70">
            A team owns your event maps and gets its own public map address.
          </p>
        </div>
        <CreateTeamForm />
      </main>
    );
  }

  const { team, role } = membership;
  const isAdmin = isAdminRole(role);

  const maps = await prisma.eventMap.findMany({
    where: {
      teamId: team.id,
      // Viewers only see what attendees see.
      ...(isAdmin ? {} : { published: true }),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { pois: true } } },
  });

  return (
    <main className="flex flex-col gap-5 px-5 py-8">
      <header className="flex items-center gap-3">
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-teal-700/10 text-lg">📍</span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{team.name}</h1>
          <p className="text-xs opacity-60">
            {isAdmin ? "Admin" : "Viewer"} · public at /{team.slug}
          </p>
        </div>
      </header>

      <ShareCard
        slug={team.slug}
        teamName={team.name}
        published={maps.some((map) => map.published)}
      />

      {isAdmin && (
        <Link
          href="/dashboard/maps/new"
          className="rounded-xl bg-teal-700 px-6 py-3.5 text-center font-semibold text-white active:scale-[.98]"
        >
          + New event map
        </Link>
      )}

      {maps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 px-4 py-10 text-center text-sm opacity-60 dark:border-white/25">
          {isAdmin
            ? "No maps yet. Create your first event map to get started."
            : "No published maps yet. Check back soon!"}
        </p>
      ) : (
        <ul className="space-y-3">
          {maps.map((map) => (
            <li key={map.id}>
              <Link
                href={isAdmin ? `/dashboard/maps/${map.id}` : `/${team.slug}`}
                className="block rounded-2xl border border-black/10 p-4 active:bg-black/5 dark:border-white/15 dark:active:bg-white/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-semibold">{map.name}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      map.published
                        ? "bg-teal-700/10 text-teal-700 dark:text-teal-400"
                        : "bg-black/5 opacity-60 dark:bg-white/10"
                    }`}
                  >
                    {map.published ? "Published" : "Draft"}
                  </span>
                </div>
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
