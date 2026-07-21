"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Always-on app header: the `your map event` wordmark (small, top-left) and the
 * sign-in / sign-out control (top-right). Rendered on every dashboard screen.
 */
export function SiteHeader({
  teamName,
  signedIn,
}: {
  teamName?: string | null;
  signedIn: boolean;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-[1200] border-b border-black/10 bg-white/95 backdrop-blur dark:border-white/15 dark:bg-neutral-950/95">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-5">
        <Link
          href="/dashboard"
          className="flex items-baseline gap-1.5 text-sm font-semibold tracking-tight"
        >
          <span aria-hidden>📍</span>
          <span>
            your map <span className="text-teal-700 dark:text-teal-400">event</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Plain text on purpose: for viewers /dashboard/team just bounces
              back, and admins reach it from the sidebar. */}
          {teamName && (
            <span className="hidden max-w-[12rem] truncate text-xs opacity-60 sm:block">
              {teamName}
            </span>
          )}
          {signedIn ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white active:scale-[.98]"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
