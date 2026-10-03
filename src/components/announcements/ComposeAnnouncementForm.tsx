"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { sendAnnouncementAction } from "@/actions/announcements";
import type { ActionState } from "@/actions/types";
import { PendingLabel } from "@/components/ui/Spinner";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5";

/** datetime-local without an offset parses as this device's time: send the real instant. */
function toInstant(local: string): string {
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function ComposeAnnouncementForm({ eventId }: { eventId: string }) {
  const t = useTranslations("announcements");
  const formRef = useRef<HTMLFormElement>(null);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [localTime, setLocalTime] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    sendAnnouncementAction.bind(null, eventId),
    null,
  );
  const [sentWhen, setSentWhen] = useState<"now" | "later">("now");

  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    setLocalTime("");
    setWhen("now");
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => setSentWhen(when)}
      className="flex flex-col gap-4"
    >
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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("when")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["now", "later"] as const).map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                when === option ? "border-brand bg-brand-soft text-brand" : "border-black/15 dark:border-white/20"
              }`}
            >
              <input
                type="radio"
                name="when"
                value={option}
                checked={when === option}
                onChange={() => setWhen(option)}
                className="accent-brand"
              />
              {t(option === "now" ? "sendNow" : "schedule")}
            </label>
          ))}
        </div>
        {when === "later" && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("publishAt")}
            <input
              type="datetime-local"
              required
              value={localTime}
              onChange={(e) => setLocalTime(e.target.value)}
              className={inputClass}
            />
            <span className="text-xs opacity-60">{t("publishAtHint")}</span>
          </label>
        )}
        <input type="hidden" name="publishAt" value={when === "later" ? toInstant(localTime) : ""} />
      </fieldset>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          {t(sentWhen === "later" ? "scheduledOk" : "sentOk")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="self-start rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
      >
        <PendingLabel
          pending={pending}
          label={t(when === "later" ? "scheduleSubmit" : "send")}
          pendingLabel={t("sending")}
        />
      </button>
    </form>
  );
}
