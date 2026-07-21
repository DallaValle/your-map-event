import { getMyTeam, isAdminRole } from "@/lib/session";
import { getActiveEvent, getSwitchableEvents } from "@/lib/active-event";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { SiteFooter } from "@/components/nav/SiteFooter";
import { SideNav } from "@/components/nav/SideNav";
import { EventSwitcher } from "@/components/nav/EventSwitcher";

/**
 * The always-on console chrome: header (wordmark + sign out), a left sidebar
 * (event switcher on top, then the event's sections and workspace pages) and
 * a footer wordmark. Only the main pane scrolls; header, sidebar and footer
 * never move.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getMyTeam();
  const isAdmin = isAdminRole(membership?.role);

  const [events, activeEvent] = membership
    ? await Promise.all([
        getSwitchableEvents(membership.team.id, isAdmin),
        getActiveEvent(membership.team.id, isAdmin),
      ])
    : [[], null];

  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader teamName={membership?.team.name} signedIn />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col border-r border-black/10 dark:border-white/10 max-lg:w-16">
          <div className="max-lg:hidden">
            <EventSwitcher
              events={events}
              activeEventId={activeEvent?.id ?? null}
              isAdmin={isAdmin}
            />
          </div>
          <SideNav isAdmin={isAdmin} />
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <SiteFooter />
    </div>
  );
}
