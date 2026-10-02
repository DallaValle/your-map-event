"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { setMapPublishedAction, deleteMapAction } from "@/actions/maps";
import { PendingLabel } from "@/components/ui/Spinner";

/** Publish toggle for the Event page. */
export function PublishToggle({
  eventId,
  published,
}: {
  eventId: string;
  published: boolean;
}) {
  const t = useTranslations("eventControls");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setMapPublishedAction(eventId, !published);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-busy={pending}
      className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60 active:scale-[.98] ${
        published
          ? "bg-brand text-brand-fg"
          : "border border-black/15 dark:border-white/20"
      }`}
    >
      <PendingLabel
        pending={pending}
        label={
          published ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={Check} size="sm" />
              {t("unpublish")}
            </span>
          ) : (
            t("publish")
          )
        }
        pendingLabel={t("saving")}
      />
    </button>
  );
}

/** Danger-zone delete for the Event page; confirms, then deletes everything. */
export function DeleteEventButton({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const t = useTranslations("eventControls");
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(t("confirmDelete", { name: eventName }))) {
      return;
    }
    startTransition(async () => {
      await deleteMapAction(eventId); // redirects to /dashboard on success
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      aria-busy={pending}
      className="self-start rounded-xl border border-red-300 px-6 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
    >
      <PendingLabel pending={pending} label={t("delete")} pendingLabel={t("deleting")} />
    </button>
  );
}
