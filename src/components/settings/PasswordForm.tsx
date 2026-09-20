"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/actions/settings";
import { PendingLabel } from "@/components/ui/Spinner";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Current password
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        New password
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          Password updated.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
      >
        <PendingLabel pending={pending} label="Update password" pendingLabel="Updating…" />
      </button>
    </form>
  );
}
