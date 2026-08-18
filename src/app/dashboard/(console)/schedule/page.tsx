import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { getActiveEvent } from "@/lib/active-event";
import { getScheduleSessions } from "@/lib/program";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { EmptyEventState } from "@/components/board/EmptyEventState";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const membership = await getMyTeam();
  if (!membership) redirect("/dashboard");

  const isAdmin = isAdminRole(membership.role);
  const event = await getActiveEvent(membership.team.id, isAdmin);

  if (!event) {
    return <EmptyEventState isAdmin={isAdmin} section="Schedule" />;
  }

  const sessions = await getScheduleSessions(event.id);

  return <ScheduleView eventName={event.name} sessions={sessions} />;
}
