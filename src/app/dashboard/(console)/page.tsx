import Link from "next/link";
import { pageTitle } from "@/i18n/metadata";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { getActiveEvent } from "@/lib/active-event";
import { CreateTeamForm } from "@/components/team/CreateTeamForm";
import { ShareCard } from "@/components/share/ShareCard";
import { EventInfoForm } from "@/components/event/EventInfoForm";
import { PublishToggle, DeleteEventButton } from "@/components/event/EventControls";

export const generateMetadata = pageTitle("event");

export default async function EventPage() {
  const membership = await getMyTeam();
  const t = await getTranslations("eventHome");

  // No team yet (fresh account or social sign-up): offer to create one.
  if (!membership) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t("createTeam")}</h1>
          <p className="text-sm opacity-70">
            {t("createTeamHint")}
          </p>
        </div>
        <CreateTeamForm />
      </div>
    );
  }

  const { team, role } = membership;
  const isAdmin = isAdminRole(role);

  const event = await getActiveEvent(team.id, isAdmin);

  // No event yet: fill the content pane and center a clear first-run card.
  if (!event) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-black/10 bg-white px-8 py-10 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
          <span
            className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-3xl"
            aria-hidden
          >
            🗺️
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{t("noEvent")}</h1>
            <p className="text-balance text-sm leading-relaxed opacity-70">
              {isAdmin
                ? t("noEventAdmin")
                : t("noEventViewer")}
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/dashboard/events/new"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-6 py-3 font-semibold text-brand-fg active:scale-[.98]"
            >
              {t("newEvent")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const poiCount = await prisma.pointOfInterest.count({ where: { mapId: event.id } });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      {/* Event header: identity + live state, actions on the right. */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-2xl font-bold">{event.name}</h1>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                event.published
                  ? "bg-brand-soft text-brand"
                  : "bg-black/5 opacity-60 dark:bg-white/10"
              }`}
            >
              {event.published ? t("live") : t("draft")}
            </span>
          </div>
          <p className="mt-0.5 text-sm opacity-60">
            {event.centerName} · {t("pointCount", { count: poiCount })}
          </p>
        </div>
        {isAdmin && <PublishToggle eventId={event.id} published={event.published} />}
      </header>

      {/* The map is the event's heart — one prominent door into the editor. */}
      {isAdmin ? (
        <Link
          href={`/dashboard/events/${event.id}`}
          className="group flex items-center gap-4 rounded-2xl border border-black/10 p-5 transition-colors hover:border-brand/50 hover:bg-brand-soft dark:border-white/15"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-3xl" aria-hidden>
            🗺️
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("mapEditor")}</span>
            <span className="block text-sm opacity-60">
              {t("mapEditorHint")}
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
            className="block rounded-xl border border-brand/40 px-6 py-3 text-center font-semibold text-brand"
          >
            {t("viewLiveMap")}
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
              {t("basicInfo")}
            </h2>
            <EventInfoForm
              // The inputs are uncontrolled (defaultValue) — remount the form
              // when the selected event changes so the fields follow it.
              key={event.id}
              event={{
                id: event.id,
                name: event.name,
                subtitle: event.subtitle,
                slug: event.slug,
                description: event.description,
                logoUrl: event.logoUrl,
                startTime: event.startTime?.toISOString() ?? null,
                endTime: event.endTime?.toISOString() ?? null,
              }}
              teamSlug={team.slug}
              teamName={team.name}
              uploadsEnabled={!!process.env.UPLOADTHING_TOKEN}
            />
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-red-200 p-5 dark:border-red-950">
            <div>
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">
                {t("dangerZone")}
              </h2>
              <p className="mt-0.5 text-sm opacity-60">
                {t("dangerZoneHint")}
              </p>
            </div>
            <DeleteEventButton eventId={event.id} eventName={event.name} />
          </section>
        </>
      )}
    </div>
  );
}
