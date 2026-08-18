"use client";

import { useActionState, useEffect, useRef } from "react";
import { createScheduledPostAction } from "@/actions/social";
import type { ActionState } from "@/actions/types";
import { POST_CHANNELS } from "@/lib/social";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5";

export function PostComposer({ eventId }: { eventId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createScheduledPostAction.bind(null, eventId),
    null,
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Post
        <textarea
          name="body"
          required
          maxLength={500}
          rows={3}
          placeholder="Gates open at 16:00. Open the map for stages, food and first aid."
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
          Channel
          <select name="channel" defaultValue="x" className={inputClass} aria-label="Channel">
            {POST_CHANNELS.map((channel) => (
              <option key={channel.value} value={channel.value}>
                {channel.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
          When
          <input
            name="scheduledAt"
            type="datetime-local"
            className={inputClass}
            aria-label="Schedule time"
          />
        </label>
      </div>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="status"
          value="draft"
          disabled={pending}
          className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 active:scale-[.98]"
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="submit"
          name="status"
          value="scheduled"
          disabled={pending}
          className="rounded-xl border border-black/15 px-5 py-2.5 text-sm font-semibold disabled:opacity-60 active:scale-[.98] dark:border-white/20"
        >
          Schedule post
        </button>
      </div>
    </form>
  );
}
