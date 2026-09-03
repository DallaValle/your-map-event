import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { getActiveEvent } from "@/lib/active-event";
import { getBoardSessions } from "@/lib/program";
import { BoardView } from "@/components/board/BoardView";
import { EmptyEventState } from "@/components/board/EmptyEventState";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage() {
  const membership = await getMyTeam();
  if (!membership) redirect("/dashboard");

  const isAdmin = isAdminRole(membership.role);
  const event = await getActiveEvent(membership.team.id, isAdmin);

  if (!event) {
    return <EmptyEventState isAdmin={isAdmin} section="Board" />;
  }

  const sessions = await getBoardSessions(event.id);

  return (
    <BoardView
      eventId={event.id}
      eventName={event.name}
      sessions={sessions}
      isAdmin={isAdmin}
    />
  );
}
