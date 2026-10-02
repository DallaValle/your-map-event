import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/metadata";
import { asLocale } from "@/i18n/config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { asTheme, DEFAULT_PREFS } from "@/components/settings/prefs";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { ConnectedAccounts } from "@/components/settings/ConnectedAccounts";
import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";
import { ThemeForm } from "@/components/settings/ThemeForm";
import { LanguageForm } from "@/components/settings/LanguageForm";

export const generateMetadata = pageTitle("settings");

export default async function SettingsPage() {
  const session = await requireSession();
  const t = await getTranslations("settings");
  const [accounts, stored] = await Promise.all([
    auth.api.listUserAccounts({ headers: await headers() }).catch(() => []),
    prisma.userPreference.findUnique({ where: { userId: session.user.id } }),
  ]);

  const prefs = {
    emailNotifications: stored?.emailNotifications ?? DEFAULT_PREFS.emailNotifications,
    pushNotifications: stored?.pushNotifications ?? DEFAULT_PREFS.pushNotifications,
    eventAnnouncements: stored?.eventAnnouncements ?? DEFAULT_PREFS.eventAnnouncements,
    theme: asTheme(stored?.theme),
    locale: asLocale(stored?.locale),
  };
  const hasPassword = accounts.some((account) => account.providerId === "credential");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm opacity-70">
          {t("intro")}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{t("profile.title")}</h2>
          <p className="mt-0.5 text-sm opacity-60">{t("profile.intro")}</p>
        </div>
        <ProfileForm
          name={session.user.name}
          email={session.user.email}
          image={session.user.image ?? null}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{t("password.title")}</h2>
          <p className="mt-0.5 text-sm opacity-60">{t("password.intro")}</p>
        </div>
        {hasPassword ? (
          <PasswordForm />
        ) : (
          <p className="rounded-2xl border border-black/10 px-4 py-3 text-sm opacity-70 dark:border-white/15">
            {t("password.none")}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            {t("accounts.title")}
          </h2>
          <p className="mt-0.5 text-sm opacity-60">{t("accounts.intro")}</p>
        </div>
        <ConnectedAccounts accounts={accounts} />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            {t("notifications.title")}
          </h2>
          <p className="mt-0.5 text-sm opacity-60">{t("notifications.intro")}</p>
        </div>
        <NotificationPrefsForm
          emailNotifications={prefs.emailNotifications}
          pushNotifications={prefs.pushNotifications}
          eventAnnouncements={prefs.eventAnnouncements}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{t("appearance.title")}</h2>
          <p className="mt-0.5 text-sm opacity-60">{t("appearance.intro")}</p>
        </div>
        <ThemeForm theme={prefs.theme} />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{t("language.title")}</h2>
          <p className="mt-0.5 text-sm opacity-60">{t("language.intro")}</p>
        </div>
        <LanguageForm locale={prefs.locale} />
      </section>
    </main>
  );
}
