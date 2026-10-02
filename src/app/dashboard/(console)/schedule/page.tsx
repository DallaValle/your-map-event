import { redirect } from "next/navigation";
import { pageTitle } from "@/i18n/metadata";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { getActiveEvent } from "@/lib/active-event";
import { getEventActivities, getEventSchedulePois } from "@/lib/activity-data";
import { TimelineBuilder } from "@/components/schedule/TimelineBuilder";
import { EmptyEventState } from "@/components/board/EmptyEventState";

export const generateMetadata = pageTitle("schedule");

export default async function SchedulePage() {
  const membership = await getMyTeam();
  if (!membership) redirect("/dashboard");

  const isAdmin = isAdminRole(membership.role);
  const event = await getActiveEvent(membership.team.id, isAdmin);

  if (!event) {
    return <EmptyEventState isAdmin={isAdmin} section="Schedule" />;
  }

  const [activities, pois] = await Promise.all([
    getEventActivities(event.id),
    getEventSchedulePois(event.id),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <TimelineBuilder
      event={{
        id: event.id,
        name: event.name,
        startTime: event.startTime?.toISOString() ?? null,
        endTime: event.endTime?.toISOString() ?? null,
        published: event.published,
      }}
      activities={activities}
      pois={pois}
      isAdmin={isAdmin}
      editorHref={isAdmin ? `/dashboard/events/${event.id}` : null}
    />
    </div>
  );
}
