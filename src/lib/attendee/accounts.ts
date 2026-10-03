import "server-only";

import { prisma } from "@/lib/prisma";
import type { AttendeeProvider, ProviderProfile } from "./oauth";

/** A published event and its live map path; attendees exist only there. */
export async function findLiveEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true, published: true, team: { select: { slug: true } } },
  });
  if (!event?.published) return null;
  return { id: event.id, path: `/${event.team.slug}/${event.slug}` };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** The attendee behind a provider identity on this event, created or linked on first use. */
export async function attendeeFromProvider(eventId: string, provider: AttendeeProvider, profile: ProviderProfile) {
  const linked = await prisma.attendeeAccount.findUnique({
    where: { eventId_provider_providerAccountId: { eventId, provider, providerAccountId: profile.id } },
    select: { attendeeId: true },
  });
  if (linked) return linked.attendeeId;

  const email = profile.email ? normalizeEmail(profile.email) : null;
  const existing =
    email && profile.emailVerified
      ? await prisma.attendee.findUnique({ where: { eventId_email: { eventId, email } } })
      : null;

  if (existing) {
    // Password sign up never proves the email: the verified provider owner takes the account over.
    await prisma.attendee.update({
      where: { id: existing.id },
      data: {
        passwordHash: null,
        image: existing.image ?? profile.image,
        accounts: { create: { eventId, provider, providerAccountId: profile.id } },
      },
    });
    await prisma.attendeeSession.deleteMany({ where: { attendeeId: existing.id } });
    return existing.id;
  }

  const created = await prisma.attendee.create({
    data: {
      eventId,
      name: profile.name.slice(0, 64),
      // An unverified email would block the real owner from signing up later.
      email: profile.emailVerified ? email : null,
      image: profile.image,
      accounts: { create: { eventId, provider, providerAccountId: profile.id } },
    },
  });
  return created.id;
}
