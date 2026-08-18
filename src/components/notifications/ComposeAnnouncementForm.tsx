"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendAnnouncementAction } from "@/actions/notifications";
import type { ActionState } from "@/actions/types";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5";

export function ComposeAnnouncementForm({ eventId }: { eventId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    sendAnnouncementAction.bind(null, eventId),
    null,
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Title
        <input
          name="title"
          required
          minLength={2}
          maxLength={80}
          placeholder="Gates closing in 10 minutes"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Message
        <textarea
          name="body"
          required
          minLength={1}
          maxLength={280}
          rows={3}
          placeholder="Main entrance closes at 23:00. Last entry 22:50."
          className={inputClass}
        />
        <span className="text-xs opacity-60">Shown on the live attendee map. 280 characters max.</span>
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-lg bg-teal-700/10 px-3 py-2 text-sm text-teal-700 dark:text-teal-400">
          Sent to the live map.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60 active:scale-[.98]"
      >
        {pending ? "Sending…" : "Send announcement"}
      </button>
    </form>
  );
}
