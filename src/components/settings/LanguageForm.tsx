"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateLocaleAction } from "@/actions/settings";
import { LOCALES, localeName } from "@/i18n/config";
import { PendingLabel } from "@/components/ui/Spinner";
import type { ActionState } from "@/actions/types";

export function LanguageForm({ locale }: { locale: string | null }) {
  const t = useTranslations("settings.language");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await updateLocaleAction(prev, formData);
      if (result?.ok) router.refresh();
      return result;
    },
    null,
  );

  const options = [
    { value: "", label: t("browser"), hint: t("browserHint") },
    ...LOCALES.map((code) => ({ value: code, label: localeName(code), hint: code.toUpperCase() })),
  ];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset>
        <legend className="sr-only">{t("legend")}</legend>
        <div role="radiogroup" aria-label={t("legend")} className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.value || "browser"}
              className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-line px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="locale"
                  value={option.value}
                  defaultChecked={(locale ?? "") === option.value}
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
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{t("saved")}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
      >
        <PendingLabel pending={pending} label={t("save")} pendingLabel={t("saving")} />
      </button>
    </form>
  );
}
