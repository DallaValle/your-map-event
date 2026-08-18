import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionDTO } from "@/lib/program-types";

export type { SessionDTO };

function toDTO(session: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  sortOrder: number;
}): SessionDTO {
  return {
    id: session.id,
    title: session.title,
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    location: session.location,
    sortOrder: session.sortOrder,
  };
}

/** Sessions in the team's running order (Board). */
export async function getBoardSessions(eventId: string): Promise<SessionDTO[]> {
  const program = await prisma.program.findUnique({
    where: { eventId },
    include: {
      sessions: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
    },
  });
  return (program?.sessions ?? []).map(toDTO);
}

/** Same sessions, earliest start first (Schedule). */
export async function getScheduleSessions(eventId: string): Promise<SessionDTO[]> {
  const program = await prisma.program.findUnique({
    where: { eventId },
    include: {
      sessions: { orderBy: [{ startsAt: "asc" }, { sortOrder: "asc" }] },
    },
  });
  return (program?.sessions ?? []).map(toDTO);
}
