import { headers } from "next/headers";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { asTheme, DEFAULT_PREFS } from "@/components/settings/prefs";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { ConnectedAccounts } from "@/components/settings/ConnectedAccounts";
import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";
import { ThemeForm } from "@/components/settings/ThemeForm";
import { ThemeOverride } from "@/components/settings/ThemeOverride";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const [accounts, stored] = await Promise.all([
    auth.api.listUserAccounts({ headers: await headers() }).catch(() => []),
    prisma.userPreference.findUnique({ where: { userId: session.user.id } }),
  ]);

  const prefs = {
    emailNotifications: stored?.emailNotifications ?? DEFAULT_PREFS.emailNotifications,
    pushNotifications: stored?.pushNotifications ?? DEFAULT_PREFS.pushNotifications,
    eventAnnouncements: stored?.eventAnnouncements ?? DEFAULT_PREFS.eventAnnouncements,
    theme: asTheme(stored?.theme),
  };
  const hasPassword = accounts.some((account) => account.providerId === "credential");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <ThemeOverride theme={prefs.theme} />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm opacity-70">
          Your personal account. Team profile and event details live on their own pages.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Profile</h2>
          <p className="mt-0.5 text-sm opacity-60">Name and avatar shown in the account menu.</p>
        </div>
        <ProfileForm
          name={session.user.name}
          email={session.user.email}
          image={session.user.image ?? null}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Password</h2>
          <p className="mt-0.5 text-sm opacity-60">Change the password you use with your email.</p>
        </div>
        {hasPassword ? (
          <PasswordForm />
        ) : (
          <p className="rounded-2xl border border-black/10 px-4 py-3 text-sm opacity-70 dark:border-white/15">
            You sign in through a connected account, so there is no password to change.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            Connected accounts
          </h2>
          <p className="mt-0.5 text-sm opacity-60">Sign-in methods linked to this account.</p>
        </div>
        <ConnectedAccounts accounts={accounts} />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            Notifications
          </h2>
          <p className="mt-0.5 text-sm opacity-60">
            Choose what we send you. These are personal; they do not change team or event settings.
          </p>
        </div>
        <NotificationPrefsForm
          emailNotifications={prefs.emailNotifications}
          pushNotifications={prefs.pushNotifications}
          eventAnnouncements={prefs.eventAnnouncements}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Appearance</h2>
          <p className="mt-0.5 text-sm opacity-60">
            Override the system theme for your account. Color tokens live in the shared theme.
          </p>
        </div>
        <ThemeForm theme={prefs.theme} />
      </section>
    </main>
  );
}
