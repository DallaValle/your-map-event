"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
 * Always-on app header: the `your map event` wordmark (left) and the account
 * avatar (right). The avatar opens a menu with the user's picture, name, email
 * and a sign-out button. Attendee announcements live on the live map, not here.
 */
export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const t = useTranslations("nav");
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
        {user && (
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={t("accountMenu")}
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
                    <p className="truncate font-semibold">{user.name || t("you")}</p>
                    <p className="truncate text-xs opacity-60">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full border-t border-line px-4 py-3 text-sm font-medium hover:bg-brand-soft"
                >
                  {t("logOut")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
