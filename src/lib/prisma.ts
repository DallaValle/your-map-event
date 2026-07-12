import { PrismaClient } from "@prisma/client";

// Cache on globalThis so Next.js HMR and the separately-bundled server
// contexts (RSC / route handlers / server actions) share one connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
