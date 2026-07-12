"use client";

import { useActionState, useState } from "react";
import { createTeamAction } from "@/actions/team";
import { slugify } from "@/lib/slug";

export function CreateTeamForm() {
  const [state, formAction, pending] = useActionState(createTeamAction, null);
  const [slugPreview, setSlugPreview] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Team name
        <input
          name="name"
          required
          minLength={2}
          onChange={(e) => setSlugPreview(slugify(e.target.value))}
          placeholder="Lakeside Festival Crew"
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Public address
        <div className="flex items-center gap-1 rounded-xl border border-black/15 px-4 py-3 dark:border-white/20 dark:bg-white/5">
          <span className="opacity-50">/</span>
          <input
            name="slug"
            placeholder={slugPreview || "lakeside-festival"}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="w-full bg-transparent text-base outline-none"
          />
        </div>
        <span className="text-xs opacity-60">
          Attendees will open your map at this address. Leave empty to use the
          team name.
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
        className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
      >
        {pending ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}
