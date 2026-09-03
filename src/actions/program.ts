"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { MAX_SESSION_DAYS, parseWallClock } from "@/lib/program-time";
import type { ActionState } from "./types";

const MAX_SPAN_MS = MAX_SESSION_DAYS * 24 * 60 * 60 * 1000;

/**
 * A `datetime-local` field is a wall clock with no offset. Parsing it as UTC
 * keeps the hour the organizer typed; `z.coerce.date()` would read it in the
 * server's timezone, and would also accept a missing field as the epoch.
 */
function wallClockField(label: string) {
  return z.unknown().transform((value, ctx) => {
    const date = parseWallClock(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: `${label} is required` });
      return z.NEVER;
    }
    return date;
  });
}

const sessionSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(80),
    startsAt: wallClockField("Start time"),
    endsAt: wallClockField("End time"),
    location: z.string().trim().max(80).optional(),
  })
  .refine((data) => data.endsAt.getTime() > data.startsAt.getTime(), {
    message: "End time must be after start time",
    path: ["endsAt"],
  })
  // Without a cap a mistyped year renders thousands of hour rows on Schedule.
  .refine((data) => data.endsAt.getTime() - data.startsAt.getTime() <= MAX_SPAN_MS, {
    message: `A session cannot run longer than ${MAX_SESSION_DAYS} days`,
    path: ["endsAt"],
  });

function parseSessionForm(formData: FormData) {
  return sessionSchema.safeParse({
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    location: formData.get("location") || undefined,
  });
}

function revalidateProgram() {
  revalidatePath("/dashboard/board");
  revalidatePath("/dashboard/schedule");
}

async function requireEventAdmin(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  const { team } = await requireAdmin(event.teamId);
  return { event, team };
}

async function getOrCreateProgram(eventId: string) {
  return prisma.program.upsert({
    where: { eventId },
    create: { eventId },
    update: {},
  });
}

export async function createSessionAction(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireEventAdmin(eventId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" };
  }

  const parsed = parseSessionForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const program = await getOrCreateProgram(eventId);
  const max = await prisma.programSession.aggregate({
    where: { programId: program.id },
    _max: { sortOrder: true },
  });

  const { location, ...rest } = parsed.data;
  await prisma.programSession.create({
    data: {
      programId: program.id,
      ...rest,
      location: location || null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });

  revalidateProgram();
  return { ok: true };
}

export async function updateSessionAction(
  sessionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: { program: { include: { event: true } } },
  });
  if (!session) return { ok: false, error: "Session not found" };

  try {
    await requireAdmin(session.program.event.teamId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" };
  }

  const parsed = parseSessionForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { location, ...rest } = parsed.data;
  await prisma.programSession.update({
    where: { id: sessionId },
    data: { ...rest, location: location || null },
  });

  revalidateProgram();
  return { ok: true };
}

export async function deleteSessionAction(sessionId: string): Promise<ActionState> {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: { program: { include: { event: true } } },
  });
  if (!session) return { ok: false, error: "Session not found" };

  try {
    await requireAdmin(session.program.event.teamId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" };
  }

  await prisma.programSession.delete({ where: { id: sessionId } });

  revalidateProgram();
  return { ok: true };
}

export async function moveSessionAction(
  sessionId: string,
  direction: "up" | "down",
): Promise<ActionState> {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: { program: { include: { event: true } } },
  });
  if (!session) return { ok: false, error: "Session not found" };

  try {
    await requireAdmin(session.program.event.teamId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" };
  }

  const siblings = await prisma.programSession.findMany({
    where: { programId: session.programId },
    orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
  });
  const index = siblings.findIndex((row) => row.id === sessionId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= siblings.length) {
    return { ok: true };
  }

  const next = [...siblings];
  const [moved] = next.splice(index, 1);
  next.splice(swapWith, 0, moved);
  await prisma.$transaction(
    next.map((row, order) =>
      prisma.programSession.update({ where: { id: row.id }, data: { sortOrder: order } }),
    ),
  );

  revalidateProgram();
  return { ok: true };
}
