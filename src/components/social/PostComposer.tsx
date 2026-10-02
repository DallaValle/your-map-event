"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createScheduledPostAction } from "@/actions/social";
import type { ActionState } from "@/actions/types";
import { POST_CHANNELS } from "@/lib/social";
import { PendingLabel } from "@/components/ui/Spinner";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5";

export function PostComposer({ eventId }: { eventId: string }) {
  const t = useTranslations("social");
  const formRef = useRef<HTMLFormElement>(null);
  const [intent, setIntent] = useState<"draft" | "scheduled" | null>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createScheduledPostAction.bind(null, eventId),
    null,
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  useEffect(() => {
    if (!pending) setIntent(null);
  }, [pending]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("post")}
        <textarea
          name="body"
          required
          maxLength={500}
          rows={3}
          placeholder={t("postPlaceholder")}
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
          {t("channel")}
          <select name="channel" defaultValue="x" className={inputClass} aria-label={t("channel")}>
            {POST_CHANNELS.map((channel) => (
              <option key={channel.value} value={channel.value}>
                {t(`channels.${channel.value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
          {t("when")}
          <input
            name="scheduledAt"
            type="datetime-local"
            className={inputClass}
            aria-label={t("scheduleTime")}
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
          aria-busy={pending && intent === "draft"}
          onClick={() => setIntent("draft")}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
        >
          <PendingLabel
            pending={pending && intent === "draft"}
            label={t("saveDraft")}
            pendingLabel={t("saving")}
          />
        </button>
        <button
          type="submit"
          name="status"
          value="scheduled"
          disabled={pending}
          aria-busy={pending && intent === "scheduled"}
          onClick={() => setIntent("scheduled")}
          className="rounded-xl border border-black/15 px-5 py-2.5 text-sm font-semibold disabled:opacity-60 active:scale-[.98] dark:border-white/20"
        >
          <PendingLabel
            pending={pending && intent === "scheduled"}
            label={t("schedulePost")}
            pendingLabel={t("saving")}
          />
        </button>
      </div>
    </form>
  );
}
