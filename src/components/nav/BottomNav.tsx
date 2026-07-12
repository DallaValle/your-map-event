"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Mobile-first bottom navigation for the dashboard. Fixed to the bottom with
 * safe-area padding; every target is ≥48px tall for comfortable touch use.
 */
export function BottomNav({
  teamSlug,
  isAdmin,
}: {
  teamSlug?: string | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const linkClass = (active: boolean) =>
    `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium ${
      active ? "text-teal-700 dark:text-teal-400" : "opacity-60"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/15 dark:bg-neutral-950/95">
      <div className="mx-auto flex max-w-lg items-stretch gap-1 px-2 py-1.5">
        <Link href="/dashboard" className={linkClass(pathname === "/dashboard" || pathname.startsWith("/dashboard/maps"))}>
          <span className="text-xl" aria-hidden>🗺️</span>
          Maps
        </Link>
        {isAdmin && (
          <Link href="/dashboard/team" className={linkClass(pathname === "/dashboard/team")}>
            <span className="text-xl" aria-hidden>👥</span>
            Team
          </Link>
        )}
        {teamSlug && (
          <Link href={`/${teamSlug}`} className={linkClass(false)}>
            <span className="text-xl" aria-hidden>📍</span>
            Live map
          </Link>
        )}
        <button type="button" onClick={handleSignOut} className={linkClass(false)}>
          <span className="text-xl" aria-hidden>🚪</span>
          Sign out
        </button>
      </div>
    </nav>
  );
}
