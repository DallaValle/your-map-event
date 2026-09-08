import { prisma } from "../src/lib/prisma";

/** Every activity these specs create is prefixed, so cleanup spares the demo data. */
export const E2E_ACTIVITY_PREFIX = "E2E ";

export async function clearE2EActivities() {
  await prisma.activity.deleteMany({
    where: { name: { startsWith: E2E_ACTIVITY_PREFIX } },
  });
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
