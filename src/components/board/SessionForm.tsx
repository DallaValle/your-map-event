"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSessionAction, updateSessionAction } from "@/actions/program";
import { toLocalInputValue } from "@/lib/program-time";
import type { ActionState } from "@/actions/types";
import type { SessionDTO } from "@/lib/program-types";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5";

export function SessionForm({
  eventId,
  session,
  onDone,
}: {
  eventId: string;
  session?: SessionDTO;
  onDone?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = !!session;

  const bound = isEdit
    ? updateSessionAction.bind(null, session.id)
    : createSessionAction.bind(null, eventId);

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await bound(prev, formData);
      if (result?.ok) {
        router.refresh();
        if (isEdit) onDone?.();
        else formRef.current?.reset();
      }
      return result;
    },
    null,
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={isEdit ? "Edit session" : "Add session"}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Title
        <input
          name="title"
          required
          maxLength={80}
          defaultValue={session?.title ?? ""}
          placeholder="Opening remarks"
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Start
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={session ? toLocalInputValue(session.startsAt) : ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          End
          <input
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={session ? toLocalInputValue(session.endsAt) : ""}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Location
        <input
          name="location"
          maxLength={80}
          defaultValue={session?.location ?? ""}
          placeholder="Main Stage (optional)"
          className={inputClass}
        />
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 active:scale-[.98]"
        >
          {pending ? "Saving…" : isEdit ? "Save session" : "Add session"}
        </button>
        {isEdit && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-xl border border-black/15 px-5 py-2.5 text-sm font-semibold dark:border-white/20"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
