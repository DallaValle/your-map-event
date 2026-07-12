import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

// Service-worker fallback for uncached navigations while offline.
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-4xl" aria-hidden>
        📡
      </span>
      <h1 className="text-xl font-bold">You’re offline</h1>
      <p className="max-w-xs text-sm opacity-70">
        This page isn’t cached yet. Map areas you already viewed keep working
        offline — reconnect to load new ones.
      </p>
    </main>
  );
}
