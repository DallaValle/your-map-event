import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { BrandMark } from "@/components/nav/BrandMark";
import { SiteFooter } from "@/components/nav/SiteFooter";

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
    <div className="flex min-h-dvh flex-col">
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <BrandMark size={72} />
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
          className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg active:scale-[.98]"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-xl border border-brand/40 px-6 py-3.5 font-semibold text-brand active:scale-[.98]"
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
                    <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-sm">
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
    <SiteFooter />
    </div>
  );
}
