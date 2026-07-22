"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen modal that embeds the real attendee page inside an iPhone frame,
 * so an admin sees exactly what visitors get - the live route itself, in an
 * iframe, not a re-render. Only the published page is reachable; a draft has no
 * live page yet, so we prompt to publish instead.
 */
export function PhonePreview({
  liveUrl,
  published,
  onClose,
}: {
  liveUrl: string;
  published: boolean;
  onClose: () => void;
}) {
  // Cache-bust so the iframe always loads the latest saved state (the editor
  // auto-saves before this opens). Set on mount - client-only, no SSR.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setVersion(Date.now());
  }, []);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const src = version ? `${liveUrl}?preview=${version}` : liveUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Attendee preview"
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-4 bg-black/70 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/15 text-xl text-white backdrop-blur transition hover:bg-white/25"
      >
        ✕
      </button>

      <p className="text-sm font-medium text-white/80">
        The live attendee page, exactly as visitors see it
      </p>

      {/* iPhone frame. Tapping inside must not bubble up and close the modal. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative aspect-[390/844] h-[min(88dvh,880px)] rounded-[3rem] border-[11px] border-neutral-800 bg-neutral-800 shadow-2xl ring-1 ring-black/40"
      >
        {/* Dynamic Island */}
        <div className="pointer-events-none absolute left-1/2 top-2 z-[10] h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        {/* Screen. The live page has no notch awareness, so simulated status-bar
            and home-indicator strips keep its top bar clear of the Dynamic
            Island and its bottom bar clear of the rounded corners. */}
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[2.15rem] bg-neutral-900">
          <div className="h-8 shrink-0" aria-hidden />
          <div className="min-h-0 flex-1 bg-neutral-100 dark:bg-neutral-900">
            {published ? (
              version ? (
                <iframe
                  key={src}
                  src={src}
                  title="Attendee preview"
                  className="h-full w-full border-0"
                />
              ) : null
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                <span className="text-4xl" aria-hidden>
                  🚧
                </span>
                <p className="font-semibold">Not published yet</p>
                <p className="text-sm opacity-60">
                  Publish the event to preview its live attendee page here.
                </p>
              </div>
            )}
          </div>
          <div className="h-5 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
