import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  // Surface a few published teams so visitors can jump straight to a map.
  const teams = await prisma.team.findMany({
    where: { events: { some: { published: true } } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="space-y-3">
        <span className="text-5xl" aria-hidden>
          🗺️
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Your Map Event</h1>
        <p className="mx-auto max-w-sm text-balance text-sm opacity-70">
          Build an interactive map of your event, add points of interest, and
          share one link so attendees always know where they are and what’s
          around them.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/sign-in"
          className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white active:scale-[.98]"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-xl border border-teal-700/40 px-6 py-3.5 font-semibold text-teal-700 active:scale-[.98] dark:text-teal-400"
        >
          Create a team
        </Link>
      </div>

      {teams.length > 0 && (
        <div className="w-full max-w-xs space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide opacity-50">
            Live event maps
          </h2>
          <ul className="space-y-2">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`/${team.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-black/10 px-4 py-3 text-left dark:border-white/15"
                >
                  {team.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={team.logoUrl}
                      alt=""
                      className="size-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full bg-teal-700/10 text-sm">
                      📍
                    </span>
                  )}
                  <span className="font-medium">{team.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
