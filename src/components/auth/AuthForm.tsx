"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

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

    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Please try again.");
      return;
    }

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

  const title = mode === "sign-up" ? "Create your account" : "Welcome back";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-1 text-center">
        <span className="text-4xl" aria-hidden>
          🗺️
        </span>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "sign-up" && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name
            <input
              name="name"
              required
              autoComplete="name"
              className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
        >
          {pending
            ? "Please wait…"
            : mode === "sign-up"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs uppercase opacity-40">
            <span className="h-px flex-1 bg-current" />
            or
            <span className="h-px flex-1 bg-current" />
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            className="rounded-xl border border-black/15 px-6 py-3.5 font-semibold active:scale-[.98] dark:border-white/20"
          >
            Continue with Google
          </button>
        </>
      )}

      <p className="text-center text-sm opacity-70">
        {mode === "sign-up" ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-semibold text-teal-700 dark:text-teal-400">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/sign-up" className="font-semibold text-teal-700 dark:text-teal-400">
              Create an account
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
