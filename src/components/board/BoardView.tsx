"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSessionAction, moveSessionAction } from "@/actions/program";
import { formatClock } from "@/lib/program-time";
import type { SessionDTO } from "@/lib/program-types";
import { SessionForm } from "./SessionForm";

export function BoardView({
  eventId,
  eventName,
  sessions,
  isAdmin,
}: {
  eventId: string;
  eventName: string;
  sessions: SessionDTO[];
  isAdmin: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Board</h1>
        <p className="text-sm opacity-70">
          The running order for {eventName}. Edit sessions here; Schedule shows
          the same times hour by hour.
        </p>
      </header>

      {isAdmin && (
        <section className="flex flex-col gap-3 rounded-2xl border border-black/10 p-5 dark:border-white/15">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            New session
          </h2>
          <SessionForm eventId={eventId} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Running order
        </h2>
        {sessions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/10 px-5 py-10 text-center text-sm opacity-60 dark:border-white/15">
            {isAdmin
              ? "No sessions yet. Add the first one above."
              : "No sessions on the board yet."}
          </p>
        ) : (
          <ul
            aria-label="Running order"
            className="divide-y divide-black/10 overflow-hidden rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15"
          >
            {sessions.map((session, index) => (
              <SessionRow
                key={session.id}
                eventId={eventId}
                session={session}
                isAdmin={isAdmin}
                isFirst={index === 0}
                isLast={index === sessions.length - 1}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SessionRow({
  eventId,
  session,
  isAdmin,
  isFirst,
  isLast,
}: {
  eventId: string;
  session: SessionDTO;
  isAdmin: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await moveSessionAction(session.id, direction);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Delete "${session.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteSessionAction(session.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="bg-teal-700/5 p-4">
        <SessionForm eventId={eventId} session={session} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{session.title}</h3>
        <p className="mt-0.5 text-sm opacity-60">
          {formatClock(session.startsAt)} - {formatClock(session.endsAt)}
          {session.location ? ` · ${session.location}` : ""}
        </p>
      </div>
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => move("up")}
            disabled={pending || isFirst}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-white/20"
          >
            Move up
          </button>
          <button
            type="button"
            onClick={() => move("down")}
            disabled={pending || isLast}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-white/20"
          >
            Move down
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold dark:border-white/20"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
