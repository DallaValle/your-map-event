import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { TeamProfileForm } from "@/components/team/TeamProfileForm";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const membership = await getMyTeam();
  if (!membership) redirect("/dashboard");
  if (!isAdminRole(membership.role)) redirect("/dashboard");

  const { team } = membership;

  const org = await auth.api
    .getFullOrganization({
      query: { organizationId: team.orgId },
      headers: await headers(),
    })
    .catch(() => null);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-5 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Team settings</h1>
        <p className="text-sm opacity-70">
          Your logo and name appear on the public map page.
        </p>
      </div>

      <TeamProfileForm
        team={team}
        uploadsEnabled={!!process.env.UPLOADTHING_TOKEN}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Members
        </h2>
        <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
          {(org?.members ?? []).map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{member.user.name}</p>
                <p className="truncate text-xs opacity-60">{member.user.email}</p>
              </div>
              <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium capitalize dark:bg-white/10">
                {isAdminRole(member.role) ? "Admin" : "Viewer"}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs opacity-60">
          Admins can edit maps and points; viewers can only open published maps.
        </p>
      </section>
    </main>
  );
}
