"use client";

import { useActionState } from "react";
import { updateNotificationPrefsAction } from "@/actions/settings";
import { PendingLabel } from "@/components/ui/Spinner";

const PREFS = [
  {
    name: "emailNotifications",
    label: "Email notifications",
    hint: "Account and event updates sent to your inbox.",
  },
  {
    name: "pushNotifications",
    label: "Push notifications",
    hint: "Browser alerts while the dashboard is open.",
  },
  {
    name: "eventAnnouncements",
    label: "Event announcements",
    hint: "Live organizer broadcasts from the header bell.",
  },
] as const;

export function NotificationPrefsForm({
  emailNotifications,
  pushNotifications,
  eventAnnouncements,
}: {
  emailNotifications: boolean;
  pushNotifications: boolean;
  eventAnnouncements: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateNotificationPrefsAction, null);
  const defaults = { emailNotifications, pushNotifications, eventAnnouncements };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
        {PREFS.map((pref) => (
          <li key={pref.name} className="px-4 py-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name={pref.name}
                defaultChecked={defaults[pref.name]}
                className="mt-0.5 size-5 accent-brand"
              />
              <span>
                <span className="block text-sm font-medium">{pref.label}</span>
                <span className="block text-xs opacity-60">{pref.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          Preferences saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
      >
        <PendingLabel pending={pending} label="Save preferences" pendingLabel="Saving…" />
      </button>
    </form>
  );
}
