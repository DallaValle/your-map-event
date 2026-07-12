"use client";

import { useActionState } from "react";
import { updateTeamAction } from "@/actions/team";
import { ImageField } from "@/components/upload/ImageField";
import type { Team } from "@prisma/client";

export function TeamProfileForm({
  team,
  uploadsEnabled,
}: {
  team: Pick<Team, "id" | "name" | "slug" | "logoUrl">;
  uploadsEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateTeamAction.bind(null, team.id),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ImageField
        name="logoUrl"
        label="Team logo"
        endpoint="teamLogo"
        uploadsEnabled={uploadsEnabled}
        defaultValue={team.logoUrl}
      />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Team name
        <input
          name="name"
          required
          minLength={2}
          defaultValue={team.name}
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Public address
        <div className="flex items-center gap-1 rounded-xl border border-black/15 px-4 py-3 dark:border-white/20 dark:bg-white/5">
          <span className="opacity-50">/</span>
          <input
            name="slug"
            required
            defaultValue={team.slug}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="w-full bg-transparent text-base outline-none"
          />
        </div>
        <span className="text-xs opacity-60">
          Changing this breaks previously shared links.
        </span>
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-teal-700/10 px-3 py-2 text-sm text-teal-700 dark:text-teal-400">
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
