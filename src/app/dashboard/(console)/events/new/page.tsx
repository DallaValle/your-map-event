import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/metadata";
import { ArrowLeft } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { NewEventFlow } from "@/components/event/NewEventFlow";

export const generateMetadata = pageTitle("pricing");

export default async function NewEventPage() {
  const membership = await getMyTeam();
  if (!membership || !isAdminRole(membership.role)) redirect("/dashboard");
  const t = await getTranslations("newEvent");

  return (
    <div className="flex min-h-full justify-center px-6 py-10">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-50">
            {t("eyebrow")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm leading-relaxed opacity-70">
            {t("intro")}
          </p>
        </div>
        <NewEventFlow teamId={membership.team.id} />
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1.5 text-sm opacity-70 hover:opacity-100"
        >
          <Icon icon={ArrowLeft} size="sm" /> {t("back")}
        </Link>
      </div>
    </div>
  );
}
