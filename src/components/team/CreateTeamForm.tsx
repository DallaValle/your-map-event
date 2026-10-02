"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createTeamAction } from "@/actions/team";
import { slugify } from "@/lib/slug";
import { PendingLabel } from "@/components/ui/Spinner";

export function CreateTeamForm() {
  const t = useTranslations("team");
  const [state, formAction, pending] = useActionState(createTeamAction, null);
  const [slugPreview, setSlugPreview] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("name")}
        <input
          name="name"
          required
          minLength={2}
          onChange={(e) => setSlugPreview(slugify(e.target.value))}
          placeholder={t("namePlaceholder")}
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("address")}
        <div className="flex items-center gap-1 rounded-xl border border-black/15 px-4 py-3 dark:border-white/20 dark:bg-white/5">
          <span className="opacity-50">/</span>
          <input
            name="slug"
            placeholder={slugPreview || t("slugPlaceholder")}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="w-full bg-transparent text-base outline-none"
          />
        </div>
        <span className="text-xs opacity-60">
          {t("addressHintNew")}
        </span>
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
      >
        <PendingLabel pending={pending} label={t("create")} pendingLabel={t("creating")} />
      </button>
    </form>
  );
}
