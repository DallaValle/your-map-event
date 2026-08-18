import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveEvent } from "@/lib/active-event";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { ShareCard } from "@/components/share/ShareCard";
import { PosterShareAsset } from "@/components/social/PosterShareAsset";
import { PostPlanner } from "@/components/social/PostPlanner";

export const metadata: Metadata = { title: "Social campaign" };

export default async function SocialPage() {
  const membership = await getMyTeam();
  if (!membership) redirect("/dashboard");

  const { team, role } = membership;
  const isAdmin = isAdminRole(role);
  const event = await getActiveEvent(team.id, isAdmin);

  if (!event) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-black/10 bg-white px-8 py-10 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
          <span
            className="flex size-16 items-center justify-center rounded-2xl bg-teal-700/10 text-3xl"
            aria-hidden
          >
            📣
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">No event yet</h1>
            <p className="text-balance text-sm leading-relaxed opacity-70">
              {isAdmin
                ? "Create an event first, then plan its posts and share assets here."
                : "No published events yet. Check back soon!"}
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/dashboard/events/new"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white active:scale-[.98]"
            >
              + New event
            </Link>
          )}
        </div>
      </div>
    );
  }

  const campaign = await prisma.socialCampaign.findUnique({
    where: { eventId: event.id },
    include: { posts: { orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }] } },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Social campaign</h1>
        <p className="text-sm opacity-70">
          Share the map for {event.name} and plan the posts around it.
        </p>
      </header>

      <ShareCard
        path={`${team.slug}/${event.slug}`}
        teamName={team.name}
        published={event.published}
      />

      <PosterShareAsset
        path={`${team.slug}/${event.slug}`}
        eventName={event.name}
        published={event.published}
      />

      <PostPlanner
        eventId={event.id}
        posts={campaign?.posts ?? []}
        isAdmin={isAdmin}
      />
    </main>
  );
}
