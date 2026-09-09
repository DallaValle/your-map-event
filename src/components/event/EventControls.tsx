"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
      className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60 active:scale-[.98] ${
        published
          ? "bg-brand text-brand-fg"
          : "border border-black/15 dark:border-white/20"
      }`}
    >
      <PendingLabel
        pending={pending}
        label={published ? "Live ✓ - Unpublish" : "Publish"}
        pendingLabel="Saving…"
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
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(
        `Delete the event "${eventName}" with its map and all its points? This cannot be undone.`,
      )
    ) {
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
      className="self-start rounded-xl border border-red-300 px-6 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
    >
      <PendingLabel pending={pending} label="Delete this event" pendingLabel="Deleting…" />
    </button>
  );
}
