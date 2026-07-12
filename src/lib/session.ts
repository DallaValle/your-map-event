import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Team } from "@prisma/client";

type MemberRow = { id: string; userId: string; organizationId: string; role: string };

const ADMIN_ROLES = ["owner", "admin"];

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** The caller's membership row in the given organization, or null. */
async function getMembership(userId: string, orgId: string) {
  const ctx = await auth.$context;
  return ctx.adapter.findOne<MemberRow>({
    model: "member",
    where: [
      { field: "userId", value: userId },
      { field: "organizationId", value: orgId },
    ],
  });
}

export function isAdminRole(role: string | null | undefined) {
  return !!role && ADMIN_ROLES.includes(role);
}

/**
 * The signed-in user's team + role. Uses the session's active organization
 * (auto-set at sign-in), falling back to the user's first membership.
 * Returns null when the user belongs to no team yet.
 */
export async function getMyTeam(): Promise<{ team: Team; role: string } | null> {
  const session = await requireSession();
  const ctx = await auth.$context;

  let member: MemberRow | null = null;
  const activeOrgId = session.session.activeOrganizationId;
  if (activeOrgId) {
    member = await getMembership(session.user.id, activeOrgId);
  }
  if (!member) {
    const members = await ctx.adapter.findMany<MemberRow>({
      model: "member",
      where: [{ field: "userId", value: session.user.id }],
      limit: 1,
    });
    member = members[0] ?? null;
  }
  if (!member) return null;

  const team = await prisma.team.findUnique({
    where: { orgId: member.organizationId },
  });
  if (!team) return null;

  return { team, role: member.role };
}

/**
 * Authorization gate for every mutating server action: verifies a valid
 * session, that the target team exists, and that the caller is an admin
 * (owner/admin) of the team's organization. Throws on failure — server
 * actions surface this as an error state, never a silent success.
 */
export async function requireAdmin(teamId: string) {
  const session = await requireSession();

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");

  const member = await getMembership(session.user.id, team.orgId);
  if (!member || !isAdminRole(member.role)) {
    throw new Error("Forbidden: admin role required");
  }

  return { session, team };
}
