"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateThemeAction } from "@/actions/settings";
import { asTheme, type ThemePreference } from "@/components/settings/prefs";
import { applyThemeClass } from "@/components/theme/apply-theme";
import { PendingLabel } from "@/components/ui/Spinner";
import type { ActionState } from "@/actions/types";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "System", hint: "Match the device" },
  { value: "light", label: "Light", hint: "Paper and ink" },
  { value: "dark", label: "Dark", hint: "Always dark" },
  { value: "mono", label: "Black & white", hint: "No color" },
];

export function ThemeForm({ theme }: { theme: ThemePreference }) {
  const router = useRouter();
  const [savedAs, setSavedAs] = useState<ThemePreference | null>(null);
  const committed = useRef(theme);
  committed.current = savedAs ?? theme;

  useEffect(() => {
    return () => applyThemeClass(committed.current);
  }, []);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const next = asTheme(String(formData.get("theme")));
      const result = await updateThemeAction(prev, formData);
      if (result?.ok) {
        applyThemeClass(next);
        setSavedAs(next);
        router.refresh();
      }
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div role="radiogroup" aria-label="Theme" className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-line px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  defaultChecked={theme === option.value}
                  onChange={() => applyThemeClass(option.value)}
                  className="size-4 accent-brand"
                />
                {option.label}
              </span>
              <span className="pl-6 text-xs text-muted">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          Appearance saved
          {savedAs ? ` (${OPTIONS.find((option) => option.value === savedAs)?.label})` : ""}.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
      >
        <PendingLabel pending={pending} label="Save appearance" pendingLabel="Saving…" />
      </button>
    </form>
  );
}
