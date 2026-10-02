"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { BrandMark } from "@/components/nav/BrandMark";
import { SiteFooter } from "@/components/nav/SiteFooter";
import { PendingLabel } from "@/components/ui/Spinner";
import { syncThemeCookieAction } from "@/actions/settings";

const AUTH_ERRORS = {
  INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
  INVALID_EMAIL: "invalidEmail",
  PASSWORD_TOO_SHORT: "passwordTooShort",
  USER_ALREADY_EXISTS: "userExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "userExists",
} as const;

// Better Auth answers in English: known codes get our wording, others keep its text for English readers.
function authErrorMessage(
  error: { code?: string; message?: string },
  t: ReturnType<typeof useTranslations<"auth">>,
  locale: string,
) {
  const key = AUTH_ERRORS[error.code as keyof typeof AUTH_ERRORS];
  if (key) return t(`errors.${key}`);
  return locale === "en" && error.message ? error.message : t("errors.generic");
}

/**
 * Shared sign-in / sign-up form. Kept as one component because the two flows
 * differ only in which authClient call runs and the name field's visibility.
 */
export function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: "sign-in" | "sign-up";
  googleEnabled: boolean;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  // In-memory auth (AUTH_STORAGE=memory) is wiped on every dev server restart,
  // so the "remember me" cookie can't survive a reboot and you'd have to retype
  // the seeded creds each time. Prefill them in development to make sign-in a
  // single click. Dead-code-eliminated from production builds.
  const devDefaults =
    process.env.NODE_ENV === "development" && mode === "sign-in"
      ? { email: "admin@test.com", password: "password" }
      : null;

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    // Unchecked = session cookie only (signed out when the browser closes).
    const rememberMe = form.get("rememberMe") === "on";

    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password, rememberMe });

    setPending(false);

    if (result.error) {
      setError(authErrorMessage(result.error, t, locale));
      return;
    }

    // SPA logins (fetch + preventDefault) often slip past the browser's
    // save-password heuristics. Handing the credential over explicitly makes
    // Chromium-based browsers show the save prompt reliably; browsers without
    // PasswordCredential (Safari, Firefox) fall back to their heuristics.
    try {
      type PasswordCredentialCtor = new (init: {
        id: string;
        password: string;
        name?: string;
      }) => Credential;
      const PasswordCredential = (
        window as unknown as { PasswordCredential?: PasswordCredentialCtor }
      ).PasswordCredential;
      if (PasswordCredential && navigator.credentials?.store) {
        await navigator.credentials.store(
          new PasswordCredential({ id: email, password, name: name || undefined }),
        );
      }
    } catch {
      // Saving credentials is best-effort; never block the login on it.
    }

    await syncThemeCookieAction();
    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTo,
    });
  }

  const title = mode === "sign-up" ? t("createYourAccount") : t("welcomeBack");

  return (
    <div className="flex min-h-dvh flex-col">
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark size={56} />
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>

      {/* method="post" keeps browser password heuristics happy even though
          submission is intercepted in JS. */}
      <form onSubmit={handleSubmit} method="post" className="flex flex-col gap-3">
        {mode === "sign-up" && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("name")}
            <input
              name="name"
              required
              autoComplete="name"
              className="rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("email")}
          <input
            name="email"
            type="email"
            required
            defaultValue={devDefaults?.email}
            // "username" is the token password managers key on for the
            // save/autofill prompt — "email" alone is often ignored.
            autoComplete="username"
            inputMode="email"
            className="rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("password")}
          <input
            name="password"
            type="password"
            required
            minLength={8}
            defaultValue={devDefaults?.password}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            className="rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5"
          />
        </label>

        {mode === "sign-in" && (
          <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              name="rememberMe"
              defaultChecked
              className="size-5 accent-brand"
            />
            {t("rememberMe")}
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="mt-1 rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
        >
          <PendingLabel
            pending={pending}
            label={mode === "sign-up" ? t("createAccount") : t("signIn")}
            pendingLabel={t("pleaseWait")}
          />
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs uppercase opacity-40">
            <span className="h-px flex-1 bg-current" />
            {t("or")}
            <span className="h-px flex-1 bg-current" />
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            className="rounded-xl border border-black/15 px-6 py-3.5 font-semibold active:scale-[.98] dark:border-white/20"
          >
            {t("continueWithGoogle")}
          </button>
        </>
      )}

      <p className="text-center text-sm opacity-70">
        {mode === "sign-up" ? (
          <>
            {t("haveAccount")}{" "}
            <Link href="/sign-in" className="font-semibold text-brand">
              {t("signIn")}
            </Link>
          </>
        ) : (
          <>
            {t("newHere")}{" "}
            <Link href="/sign-up" className="font-semibold text-brand">
              {t("createAnAccount")}
            </Link>
          </>
        )}
      </p>
    </main>
    <SiteFooter />
    </div>
  );
}
