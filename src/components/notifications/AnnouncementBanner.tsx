"use client";

import { useState } from "react";

/** Dismissible live banner for the attendee map. Session-only; next visit shows it again. */
export function AnnouncementBanner({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <aside
      role="status"
      aria-label="Live announcement"
      className="rounded-2xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-white/15 dark:bg-neutral-900/95"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-700/10 text-sm"
          aria-hidden
        >
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{title}</p>
          <p className="mt-0.5 text-sm leading-snug opacity-70">{body}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss announcement"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm opacity-50 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
