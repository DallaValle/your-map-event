"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { sendAnnouncementAction } from "@/actions/notifications";
import type { ActionState } from "@/actions/types";
import { PendingLabel } from "@/components/ui/Spinner";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5";

export function ComposeAnnouncementForm({ eventId }: { eventId: string }) {
  const t = useTranslations("notifications");
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
        {t("titleField")}
        <input
          name="title"
          required
          minLength={2}
          maxLength={80}
          placeholder={t("titlePlaceholder")}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("message")}
        <textarea
          name="body"
          required
          minLength={1}
          maxLength={280}
          rows={3}
          placeholder={t("messagePlaceholder")}
          className={inputClass}
        />
        <span className="text-xs opacity-60">{t("messageHint")}</span>
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          {t("sentOk")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="self-start rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
      >
        <PendingLabel pending={pending} label={t("send")} pendingLabel={t("sending")} />
      </button>
    </form>
  );
}
