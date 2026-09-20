"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { clearThemeCookieAction } from "@/actions/settings";
import { BrandMark, Wordmark } from "./BrandMark";

export interface HeaderUser {
  name: string;
  email: string;
  image: string | null;
}

/** Up to two initials from the user's name (or email as a fallback). */
function initials(user: HeaderUser): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function Avatar({ user, className }: { user: HeaderUser; className: string }) {
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.image} alt="" className={`${className} object-cover`} />;
  }
  return (
    <span className={`${className} flex items-center justify-center bg-brand font-semibold text-brand-fg`}>
      {initials(user)}
    </span>
  );
}

/**
 * Always-on app header: the `your map event` wordmark (left), a notifications
 * bell and the account avatar (right). The avatar opens a menu with the user's
 * picture, name, email and a sign-out button.
 */
export function SiteHeader({
  user,
  unreadCount = 0,
}: {
  user: HeaderUser | null;
  /** Unread announcements for the selected event. Hidden when 0. */
  unreadCount?: number;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    await clearThemeCookieAction();
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-[1200] flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4">
      <Link href="/dashboard" className="flex items-center gap-2 text-sm">
        <BrandMark size={28} />
        <Wordmark />
      </Link>

      <div className="flex items-center gap-1">
        <Link
          href="/dashboard/notifications"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          title="Notifications"
          className="relative flex size-9 items-center justify-center rounded-full text-lg hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span aria-hidden>🔔</span>
          {unreadCount > 0 && (
            <span
              data-testid="notif-badge"
              className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-brand-fg"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {user && (
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex size-9 overflow-hidden rounded-full ring-1 ring-line"
            >
              <Avatar user={user} className="size-full text-xs" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-11 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
              >
                <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
                  <Avatar user={user} className="size-16 rounded-full text-xl" />
                  <div className="min-w-0 self-stretch">
                    <p className="truncate font-semibold">{user.name || "You"}</p>
                    <p className="truncate text-xs opacity-60">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full border-t border-line px-4 py-3 text-sm font-medium hover:bg-brand-soft"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
