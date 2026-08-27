import Link from "next/link";
import type { Metadata } from "next";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { getActiveEvent } from "@/lib/active-event";
import { listAnnouncements } from "@/lib/notifications";
import { ComposeAnnouncementForm } from "@/components/notifications/ComposeAnnouncementForm";
import { AnnouncementList } from "@/components/notifications/AnnouncementList";
import { MarkAnnouncementsSeen } from "@/components/notifications/MarkAnnouncementsSeen";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const membership = await getMyTeam();

  if (!membership) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm opacity-70">Create a team first, then broadcast live announcements from here.</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white active:scale-[.98]"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

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
            🔔
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">No event yet</h1>
            <p className="text-balance text-sm leading-relaxed opacity-70">
              {isAdmin
                ? "Create an event, then send live announcements to attendees from here."
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

  const announcements = await listAnnouncements(event.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <MarkAnnouncementsSeen eventId={event.id} />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm opacity-70">
          Broadcast a live announcement to attendees of {event.name}. It shows on the public map as soon as you send it.
        </p>
      </div>

      {isAdmin && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">New announcement</h2>
          <ComposeAnnouncementForm key={event.id} eventId={event.id} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Sent announcements</h2>
        <AnnouncementList items={announcements} />
      </section>
    </main>
  );
}
