import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_DAYS = 30;

// One cookie per event, so signing in on one event map never signs you in on another.
export function sessionCookieName(eventId: string) {
  return `yme_attendee_${eventId}`;
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Stores a new session and returns the raw token for the cookie. */
export async function createAttendeeSession(attendeeId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.attendeeSession.create({
    data: {
      attendeeId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
    },
  });
  return { token, maxAge: SESSION_DAYS * 86_400 };
}

/** Signs the attendee in on this request (server actions only). */
export async function startAttendeeSession(eventId: string, attendeeId: string) {
  const { token, maxAge } = await createAttendeeSession(attendeeId);
  (await cookies()).set(sessionCookieName(eventId), token, sessionCookieOptions(maxAge));
}

export type AttendeeProfile = { id: string; name: string; email: string | null; image: string | null };

/** The attendee signed in on this event, or null. */
export async function getAttendee(eventId: string): Promise<AttendeeProfile | null> {
  const token = (await cookies()).get(sessionCookieName(eventId))?.value;
  if (!token) return null;
  const session = await prisma.attendeeSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { attendee: { select: { id: true, name: true, email: true, image: true, eventId: true } } },
  });
  // A cookie copied onto another event's name must not cross over.
  if (!session || session.expiresAt < new Date() || session.attendee.eventId !== eventId) return null;
  const { id, name, email, image } = session.attendee;
  return { id, name, email, image };
}

export async function endAttendeeSession(eventId: string) {
  const store = await cookies();
  const name = sessionCookieName(eventId);
  const token = store.get(name)?.value;
  if (token) await prisma.attendeeSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(name);
}
