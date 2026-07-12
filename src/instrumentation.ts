// Runs once per server boot (Next.js instrumentation hook).
//
// With AUTH_STORAGE=memory all auth data (users, orgs, sessions) lives
// in-process and is wiped on every restart, so we re-seed a known dev admin
// and re-link the demo Team row to the freshly created organization id.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.AUTH_STORAGE === "postgres") return;

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[auth] AUTH_STORAGE=memory in production: auth data will not survive restarts.",
    );
  }

  // Dynamic imports keep Prisma/Better Auth out of the edge instrumentation bundle.
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");

  const email = "admin@dev.local";
  const password = "demo-password";

  try {
    const signUp = await auth.api.signUpEmail({
      body: { email, password, name: "Demo Admin" },
    });

    const org = await auth.api.createOrganization({
      body: { name: "Demo Team", slug: "demo-team", userId: signUp.user.id },
    });
    if (!org) throw new Error("createOrganization returned null");

    // Second seeded account to exercise the Viewer role.
    const viewer = await auth.api.signUpEmail({
      body: { email: "viewer@dev.local", password, name: "Demo Viewer" },
    });
    await auth.api.addMember({
      body: { userId: viewer.user.id, organizationId: org.id, role: "member" },
    });

    // The Team row persists in Postgres while the org id changes every boot —
    // upsert so /demo-team keeps resolving to the new organization.
    await prisma.team.upsert({
      where: { slug: "demo-team" },
      update: { orgId: org.id },
      create: { orgId: org.id, slug: "demo-team", name: "Demo Team" },
    });

    console.log(
      `[auth] Seeded dev accounts: ${email} (admin) and viewer@dev.local (viewer), password "${password}", team "demo-team".`,
    );
  } catch (error) {
    console.error("[auth] Dev seed failed:", error);
  }
}
