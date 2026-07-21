"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setActiveEventAction } from "@/actions/active-event";

export interface SwitchableEvent {
  id: string;
  name: string;
  published: boolean;
  centerName: string;
}

/**
 * Event selector at the top of the sidebar. The whole dashboard operates on
 * one selected event; switching is rare (a team running two events, or a
 * draft next to the live edition), so it's a compact dropdown rather than a
 * permanent list.
 */
export function EventSwitcher({
  events,
  activeEventId,
  isAdmin,
}: {
  events: SwitchableEvent[];
  activeEventId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const active = events.find((event) => event.id === activeEventId) ?? null;

  // Close on outside click / Escape, like a native menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function select(eventId: string) {
    setOpen(false);
    if (eventId === activeEventId) return;
    startTransition(async () => {
      await setActiveEventAction(eventId);
      router.refresh();
    });
  }

  if (events.length === 0) {
    return isAdmin ? (
      <Link
        href="/dashboard/events/new"
        className="m-3 rounded-xl border border-dashed border-teal-700/50 px-3 py-2.5 text-center text-sm font-semibold text-teal-700 dark:text-teal-400"
      >
        + New event
      </Link>
    ) : null;
  }

  return (
    <div ref={ref} className="relative m-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2.5 rounded-xl border border-black/10 px-3 py-2.5 text-left hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/5"
      >
        <span
          className={`size-2 shrink-0 rounded-full ${
            active?.published ? "bg-teal-600" : "bg-neutral-400"
          }`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {pending ? "Switching…" : (active?.name ?? "Select an event")}
          </span>
          <span className="block truncate text-[11px] opacity-60">
            {active ? (active.published ? "Live" : "Draft") : `${events.length} events`}
          </span>
        </span>
        <span className="shrink-0 text-xs opacity-50" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/15 dark:bg-neutral-900"
        >
          <ul className="max-h-72 overflow-y-auto py-1">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={event.id === activeEventId}
                  onClick={() => select(event.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      event.published ? "bg-teal-600" : "bg-neutral-400"
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{event.name}</span>
                    <span className="block truncate text-[11px] opacity-60">
                      {event.centerName}
                    </span>
                  </span>
                  {event.id === activeEventId && (
                    <span className="shrink-0 text-teal-700 dark:text-teal-400" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {isAdmin && (
            <Link
              href="/dashboard/events/new"
              onClick={() => setOpen(false)}
              className="block border-t border-black/10 px-3 py-2.5 text-sm font-semibold text-teal-700 hover:bg-black/5 dark:border-white/15 dark:text-teal-400 dark:hover:bg-white/10"
            >
              + New event
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
