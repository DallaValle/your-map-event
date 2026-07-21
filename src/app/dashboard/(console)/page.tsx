import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { getActiveEvent } from "@/lib/active-event";
import { CreateTeamForm } from "@/components/team/CreateTeamForm";
import { ShareCard } from "@/components/share/ShareCard";
import { EventInfoForm } from "@/components/event/EventInfoForm";
import { PublishToggle, DeleteEventButton } from "@/components/event/EventControls";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage() {
  const membership = await getMyTeam();

  // No team yet (fresh account or social sign-up): offer to create one.
  if (!membership) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Create your team</h1>
          <p className="text-sm opacity-70">
            A team owns your events and gets its own public map address.
          </p>
        </div>
        <CreateTeamForm />
      </main>
    );
  }

  const { team, role } = membership;
  const isAdmin = isAdminRole(role);

  const event = await getActiveEvent(team.id, isAdmin);

  // No event yet: everything on this page is per-event, so create one first.
  if (!event) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-6 py-20 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-teal-700/10 text-3xl" aria-hidden>
          🗺️
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">No event yet</h1>
          <p className="text-sm opacity-70">
            {isAdmin
              ? "Create your first event: pick the venue, build the map, publish the link."
              : "No published events yet. Check back soon!"}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/events/new"
            className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white active:scale-[.98]"
          >
            + New event
          </Link>
        )}
      </main>
    );
  }

  const poiCount = await prisma.pointOfInterest.count({ where: { mapId: event.id } });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      {/* Event header: identity + live state, actions on the right. */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-2xl font-bold">{event.name}</h1>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                event.published
                  ? "bg-teal-700/10 text-teal-700 dark:text-teal-400"
                  : "bg-black/5 opacity-60 dark:bg-white/10"
              }`}
            >
              {event.published ? "Live" : "Draft"}
            </span>
          </div>
          <p className="mt-0.5 text-sm opacity-60">
            {event.centerName} · {poiCount} point{poiCount === 1 ? "" : "s"} of interest
          </p>
        </div>
        {isAdmin && <PublishToggle eventId={event.id} published={event.published} />}
      </header>

      {/* The map is the event's heart — one prominent door into the editor. */}
      {isAdmin ? (
        <Link
          href={`/dashboard/events/${event.id}`}
          className="group flex items-center gap-4 rounded-2xl border border-black/10 p-5 transition-colors hover:border-teal-700/50 hover:bg-teal-700/5 dark:border-white/15"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal-700/10 text-3xl" aria-hidden>
            🗺️
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Map editor</span>
            <span className="block text-sm opacity-60">
              Frame the venue, lock the attendee view, place points of interest.
            </span>
          </span>
          <span className="shrink-0 text-xl opacity-40 transition-transform group-hover:translate-x-0.5" aria-hidden>
            →
          </span>
        </Link>
      ) : (
        event.published && (
          <Link
            href={`/${team.slug}/${event.slug}`}
            className="block rounded-xl border border-teal-700/40 px-6 py-3 text-center font-semibold text-teal-700 dark:text-teal-400"
          >
            View live map →
          </Link>
        )
      )}

      <ShareCard
        path={`${team.slug}/${event.slug}`}
        teamName={team.name}
        published={event.published}
      />

      {isAdmin && (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
              Basic info
            </h2>
            <EventInfoForm
              // The inputs are uncontrolled (defaultValue) — remount the form
              // when the selected event changes so the fields follow it.
              key={event.id}
              event={{
                id: event.id,
                name: event.name,
                slug: event.slug,
                description: event.description,
              }}
              teamSlug={team.slug}
            />
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-red-200 p-5 dark:border-red-950">
            <div>
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">
                Danger zone
              </h2>
              <p className="mt-0.5 text-sm opacity-60">
                Deleting the event removes its map and all its points of interest.
              </p>
            </div>
            <DeleteEventButton eventId={event.id} eventName={event.name} />
          </section>
        </>
      )}
    </main>
  );
}
