import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

// Both the memory DB and the auth instance MUST be globalThis singletons:
// Next.js bundles server components, route handlers, and server actions as
// separate module graphs (and HMR re-evaluates modules), so a plain module-
// level instance would give each context its own empty in-memory store and
// sign-ins would "vanish" between requests.
const g = globalThis as unknown as {
  __authMemoryDb?: MemoryDB;
  __auth?: ReturnType<typeof buildAuth>;
};

// The memory adapter throws on reads from models whose table array doesn't
// exist yet, so every model (core + organization plugin) is pre-created.
g.__authMemoryDb ??= {
  user: [],
  session: [],
  account: [],
  verification: [],
  organization: [],
  member: [],
  invitation: [],
};

function buildAuth() {
  const useGoogle =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    // AUTH_STORAGE=memory  -> auth data resets on every restart (dev default;
    //                         src/instrumentation.ts re-seeds a dev admin).
    // AUTH_STORAGE=postgres -> persist via Prisma; requires the Better Auth
    //                         models in schema.prisma (`npx @better-auth/cli generate`).
    database:
      process.env.AUTH_STORAGE === "postgres"
        ? prismaAdapter(prisma, { provider: "postgresql" })
        : memoryAdapter(g.__authMemoryDb!),
    emailAndPassword: { enabled: true },
    socialProviders: useGoogle
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    databaseHooks: {
      session: {
        create: {
          // Auto-activate the user's first organization so the dashboard
          // works immediately after sign-in without an org picker.
          before: async (session, ctx) => {
            const members = ctx
              ? await ctx.context.adapter.findMany<{ organizationId: string }>({
                  model: "member",
                  where: [{ field: "userId", value: session.userId }],
                  limit: 1,
                })
              : [];
            return {
              data: {
                ...session,
                activeOrganizationId: members[0]?.organizationId ?? null,
              },
            };
          },
        },
      },
    },
    // nextCookies must be LAST: it lets auth.api calls made inside server
    // actions set cookies via next/headers.
    plugins: [organization(), nextCookies()],
  });
}

export const auth = (g.__auth ??= buildAuth());

export type Session = typeof auth.$Infer.Session;
