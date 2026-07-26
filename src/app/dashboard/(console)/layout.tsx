import { getSession, getMyTeam, isAdminRole } from "@/lib/session";
import { getActiveEvent, getSwitchableEvents } from "@/lib/active-event";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { SiteFooter } from "@/components/nav/SiteFooter";
import { DashboardSidebar } from "@/components/nav/DashboardSidebar";

/**
 * The always-on console chrome: header (wordmark, notifications bell, account
 * menu), a collapsible left sidebar (event switcher + navigation) and a footer
 * wordmark. Wraps every dashboard screen, including the map editor.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, membership] = await Promise.all([getSession(), getMyTeam()]);
  const isAdmin = isAdminRole(membership?.role);

  const [events, activeEvent] = membership
    ? await Promise.all([
        getSwitchableEvents(membership.team.id, isAdmin),
        getActiveEvent(membership.team.id, isAdmin),
      ])
    : [[], null];

  const user = session?.user
    ? { name: session.user.name, email: session.user.email, image: session.user.image ?? null }
    : null;

  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader user={user} />

      <div className="flex min-h-0 flex-1">
        <DashboardSidebar
          events={events}
          activeEventId={activeEvent?.id ?? null}
          isAdmin={isAdmin}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <SiteFooter />
    </div>
  );
}
