import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/metadata";
import { Plus, RadioTower } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { getActiveEvent } from "@/lib/active-event";
import {
  getAnnouncementSettings,
  listAnnouncements,
  listUpcomingActivities,
} from "@/lib/announcements";
import { ComposeAnnouncementForm } from "@/components/announcements/ComposeAnnouncementForm";
import { AnnouncementList, type AnnouncementRow } from "@/components/announcements/AnnouncementList";
import { AutoAnnouncementsForm } from "@/components/announcements/AutoAnnouncementsForm";

export const generateMetadata = pageTitle("announcements");

const YEAR_MS = 365 * 24 * 3_600_000;

export default async function AnnouncementsPage() {
  const membership = await getMyTeam();
  const t = await getTranslations("announcements");

  if (!membership) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm opacity-70">{t("noTeam")}</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-6 py-3 font-semibold text-brand-fg active:scale-[.98]"
        >
          {t("goToDashboard")}
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
            className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand"
            aria-hidden
          >
            <Icon icon={RadioTower} size="xl" />
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{t("noEvent")}</h1>
            <p className="text-balance text-sm leading-relaxed opacity-70">
              {isAdmin ? t("noEventAdmin") : t("noEventViewer")}
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/dashboard/events/new"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-brand-fg active:scale-[.98]"
            >
              <Icon icon={Plus} size="sm" />
              {t("newEvent")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const now = Date.now();
  const [announcements, settings, activities, locale] = await Promise.all([
    listAnnouncements(event.id),
    getAnnouncementSettings(event.id),
    listUpcomingActivities(event.id, now, YEAR_MS),
    getLocale(),
  ]);
  const rows = announcements.map(
    (a): AnnouncementRow & { at: number } => ({
      id: a.id,
      title: a.title,
      body: a.body,
      authorName: a.authorName,
      publishAt: a.publishAt.toISOString(),
      at: a.publishAt.getTime(),
    }),
  );
  // Soonest scheduled first; sent ones newest first.
  const scheduled = rows.filter((row) => row.at > now).reverse();
  const sent = rows.filter((row) => row.at <= now);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm opacity-70">{t("intro", { event: event.name })}</p>
      </div>

      {isAdmin && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{t("new")}</h2>
          <ComposeAnnouncementForm key={event.id} eventId={event.id} />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{t("auto.title")}</h2>
          <p className="text-sm opacity-70">{t("auto.intro")}</p>
        </div>
        <AutoAnnouncementsForm
          key={event.id}
          eventId={event.id}
          autoUpcoming={settings.autoUpcoming}
          leadMinutes={settings.leadMinutes}
          activities={activities}
          canEdit={isAdmin}
          locale={locale}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          {t("scheduledTitle", { count: scheduled.length })}
        </h2>
        <AnnouncementList items={scheduled} scheduled canDelete={isAdmin} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{t("sent")}</h2>
        <AnnouncementList items={sent} canDelete={isAdmin} />
      </section>
    </main>
  );
}
