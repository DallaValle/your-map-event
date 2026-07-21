"use client";

import { useActionState } from "react";
import { updateEventInfoAction } from "@/actions/maps";
import type { ActionState } from "@/actions/types";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5";

/**
 * Basic event info (everything NOT related to the map): name, public address
 * and description. Map framing, borders and points live in the map editor.
 */
export function EventInfoForm({
  event,
  teamSlug,
}: {
  event: { id: string; name: string; slug: string; description: string | null };
  teamSlug: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateEventInfoAction.bind(null, event.id),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Event name
        <input
          name="name"
          defaultValue={event.name}
          required
          minLength={2}
          maxLength={80}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Public address
        <div className="flex items-center gap-1 rounded-xl border border-black/15 px-4 py-3 dark:border-white/20 dark:bg-white/5">
          <span className="shrink-0 opacity-50">/{teamSlug}/</span>
          <input
            name="slug"
            defaultValue={event.slug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="w-full min-w-0 bg-transparent text-base outline-none"
          />
        </div>
        <span className="text-xs opacity-60">
          Part of the public link. Changing it breaks shared links and QR codes.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Description
        <textarea
          name="description"
          defaultValue={event.description ?? ""}
          rows={3}
          maxLength={500}
          className={inputClass}
        />
        <span className="text-xs opacity-60">
          Shown in link previews when the event is shared.
        </span>
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-lg bg-teal-700/10 px-3 py-2 text-sm text-teal-700 dark:text-teal-400">
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60 active:scale-[.98]"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
