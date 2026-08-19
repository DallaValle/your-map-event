"use client";

import { useActionState } from "react";
import { updateThemeAction } from "@/actions/settings";
import type { ThemePreference } from "@/components/settings/prefs";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "System", hint: "Match the device" },
  { value: "light", label: "Light", hint: "Always light" },
  { value: "dark", label: "Dark", hint: "Always dark" },
];

export function ThemeForm({ theme }: { theme: ThemePreference }) {
  const [state, formAction, pending] = useActionState(updateThemeAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div role="radiogroup" aria-label="Theme" className="grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-black/15 px-4 py-3 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-700/10 dark:border-white/20 dark:has-[:checked]:border-teal-400"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  defaultChecked={theme === option.value}
                  className="size-4 accent-teal-700"
                />
                {option.label}
              </span>
              <span className="pl-6 text-xs opacity-60">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-teal-700/10 px-3 py-2 text-sm text-teal-700 dark:text-teal-400">
          Appearance saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
      >
        {pending ? "Saving…" : "Save appearance"}
      </button>
    </form>
  );
}
