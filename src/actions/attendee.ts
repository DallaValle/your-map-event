"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findLiveEvent, normalizeEmail } from "@/lib/attendee/accounts";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/attendee/password";
import { endAttendeeSession, startAttendeeSession } from "@/lib/attendee/session";
import { fail } from "@/i18n/action-errors";
import type { ActionState } from "./types";

const credentialsSchema = z.object({
  eventId: z.string().min(1),
  email: z.email("Enter a valid email address").transform(normalizeEmail),
  password: z.string().min(8, "The password must be at least 8 characters").max(128),
});

const signUpSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, "Enter your name").max(64),
});

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function signUpAttendeeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    eventId: field(formData, "eventId"),
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { eventId, name, email, password } = parsed.data;

  const event = await findLiveEvent(eventId);
  if (!event) return fail("This event map is not available");

  const passwordHash = await hashPassword(password);
  // The unique (event, email) index settles double submits too.
  const attendee = await prisma.attendee
    .create({ data: { eventId, name, email, passwordHash } })
    .catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    });
  if (!attendee) return fail("An account with this email already exists for this event");
  await startAttendeeSession(eventId, attendee.id);
  revalidatePath(event.path);
  return { ok: true };
}

export async function signInAttendeeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    eventId: field(formData, "eventId"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  // Shape errors read the same as a wrong password, so the form leaks nothing.
  if (!parsed.success) return fail("Invalid email or password");
  const { eventId, email, password } = parsed.data;

  const event = await findLiveEvent(eventId);
  if (!event) return fail("This event map is not available");

  const attendee = await prisma.attendee.findUnique({ where: { eventId_email: { eventId, email } } });
  const ok = await verifyPassword(password, attendee?.passwordHash ?? DUMMY_HASH);
  if (!attendee?.passwordHash || !ok) return fail("Invalid email or password");

  await startAttendeeSession(eventId, attendee.id);
  revalidatePath(event.path);
  return { ok: true };
}

export async function signOutAttendeeAction(eventId: string) {
  await endAttendeeSession(eventId);
  const event = await findLiveEvent(eventId);
  if (event) revalidatePath(event.path);
}
