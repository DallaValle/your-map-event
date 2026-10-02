"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateEventInfoAction } from "@/actions/maps";
import { ImageField } from "@/components/upload/ImageField";
import { toLocalInputValue } from "@/lib/schedule-time";
import { PendingLabel } from "@/components/ui/Spinner";
import type { ActionState } from "@/actions/types";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5";

/**
 * Basic event info (everything NOT related to the map): name, subtitle, logo, public
 * address and description. Map framing, borders and points live in the editor.
 */
export function EventInfoForm({
  event,
  teamSlug,
  teamName,
  uploadsEnabled,
}: {
  event: {
    id: string;
    name: string;
    subtitle: string | null;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    startTime: string | null;
    endTime: string | null;
  };
  teamSlug: string;
  teamName: string;
  uploadsEnabled: boolean;
}) {
  const t = useTranslations("eventInfo");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateEventInfoAction.bind(null, event.id),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("name")}
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
        {t("subtitle")}
        <input
          name="subtitle"
          defaultValue={event.subtitle ?? ""}
          placeholder={teamName}
          maxLength={80}
          className={inputClass}
        />
        <span className="text-xs opacity-60">
          {t("subtitleHint")}
        </span>
      </label>

      <ImageField
        name="logoUrl"
        label={t("logo")}
        endpoint="eventLogo"
        uploadsEnabled={uploadsEnabled}
        defaultValue={event.logoUrl}
      />
      <p className="-mt-2 text-xs opacity-60">
        {t("logoHint")}
      </p>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("address")}
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
          {t("addressHint")}
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("description")}
        <textarea
          name="description"
          defaultValue={event.description ?? ""}
          rows={3}
          maxLength={500}
          className={inputClass}
        />
        <span className="text-xs opacity-60">
          {t("descriptionHint")}
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("start")}
          <input
            name="startTime"
            type="datetime-local"
            defaultValue={toLocalInputValue(event.startTime)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("end")}
          <input
            name="endTime"
            type="datetime-local"
            defaultValue={toLocalInputValue(event.endTime)}
            className={inputClass}
          />
        </label>
      </div>
      <p className="-mt-2 text-xs opacity-60">
        {t("hoursHint")}
      </p>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          {t("saved")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="self-start rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
      >
        <PendingLabel pending={pending} label={t("save")} pendingLabel={t("saving")} />
      </button>
    </form>
  );
}
