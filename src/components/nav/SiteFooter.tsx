import Link from "next/link";
import { BrandMark, Wordmark } from "./BrandMark";

/**
 * Always-on console footer: mark, wordmark, tagline, and a few workspace links.
 * Kept to one row so the map editor still gets the remaining viewport.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="shrink-0 border-t border-line bg-surface">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <BrandMark size={28} />
          <span className="min-w-0">
            <Wordmark className="block text-sm leading-none" />
            <span className="mt-0.5 hidden text-[11px] text-muted sm:block">
              Maps for live events
            </span>
          </span>
        </Link>

        <nav aria-label="Footer" className="flex items-center gap-3 text-[11px] font-medium text-muted">
          <Link href="/dashboard/team" className="hidden hover:text-foreground sm:inline">
            Team
          </Link>
          <Link href="/dashboard/settings" className="hover:text-foreground">
            Settings
          </Link>
          <span className="opacity-50">© {year}</span>
        </nav>
      </div>
    </footer>
  );
}
