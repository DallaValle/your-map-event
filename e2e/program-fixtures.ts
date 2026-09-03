import { prisma } from "../src/lib/prisma";

/** Every session these specs create is prefixed, so cleanup spares the demo data. */
export const E2E_SESSION_PREFIX = "E2E ";

/**
 * Board and Schedule group rows by day, so leftover sessions from earlier runs
 * widen the grid until an hour label like "11:00" exists in several day
 * sections and every by-label locator hits a strict-mode violation. Start each
 * test from a known program instead.
 */
export async function clearE2ESessions() {
  await prisma.programSession.deleteMany({
    where: { title: { startsWith: E2E_SESSION_PREFIX } },
  });
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
