import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/metadata";
import { auth } from "@/lib/auth";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { TeamProfileForm } from "@/components/team/TeamProfileForm";
import { InviteMemberForm } from "@/components/team/InviteMemberForm";
import { InvitationActions } from "@/components/team/InvitationActions";

export const generateMetadata = pageTitle("team");

export default async function TeamPage() {
  const membership = await getMyTeam();
  if (!membership) redirect("/dashboard");
  if (!isAdminRole(membership.role)) redirect("/dashboard");

  const { team } = membership;
  const t = await getTranslations("team");

  const org = await auth.api
    .getFullOrganization({
      query: { organizationId: team.orgId },
      headers: await headers(),
    })
    .catch(() => null);

  const now = Date.now();
  const pendingInvites = (org?.invitations ?? []).filter(
    (invite) => invite.status === "pending" && new Date(invite.expiresAt).getTime() > now,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm opacity-70">
          {t("intro")}
        </p>
      </div>

      <TeamProfileForm
        team={team}
        uploadsEnabled={!!process.env.UPLOADTHING_TOKEN}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            {t("invite")}
          </h2>
          <p className="mt-0.5 text-sm opacity-60">
            {t("inviteHint")}
          </p>
        </div>
        <InviteMemberForm orgId={team.orgId} />

        {pendingInvites.length > 0 && (
          <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{invite.email}</p>
                  <p className="truncate text-xs opacity-60">
                    {t("invitedAs", { role: isAdminRole(invite.role) ? t("admin") : t("viewer") })}
                  </p>
                </div>
                <InvitationActions invitationId={invite.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          {t("members")}
        </h2>
        <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
          {(org?.members ?? []).map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{member.user.name}</p>
                <p className="truncate text-xs opacity-60">{member.user.email}</p>
              </div>
              <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium capitalize dark:bg-white/10">
                {isAdminRole(member.role) ? t("admin") : t("viewer")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
