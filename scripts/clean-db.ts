/**
 * Wipe every application table (keeps Prisma migration history).
 *
 * Usage:
 *   npx tsx scripts/clean-db.ts --yes
 *   npm run db:clean
 *
 * Requires DATABASE_URL (loaded from .env by Prisma).
 */
import { PrismaClient } from "@prisma/client";

// Physical table names (@@map where set). Order does not matter with CASCADE.
const TABLES = [
  "PointOfInterest",
  "EventMap",
  "Team",
  "session",
  "account",
  "invitation",
  "member",
  "organization",
  "verification",
  "user",
] as const;

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error(
      "Refusing to wipe the database without --yes.\n" +
        "  npx tsx scripts/clean-db.ts --yes\n" +
        "  npm run db:clean",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const list = TABLES.map((t) => `"${t}"`).join(", ");
    // RESTART IDENTITY resets serial sequences; CASCADE follows FKs.
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`,
    );
    console.log(`Cleaned ${TABLES.length} tables: ${TABLES.join(", ")}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
