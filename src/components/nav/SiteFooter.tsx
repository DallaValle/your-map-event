import Link from "next/link";
import { BrandMark, Wordmark } from "./BrandMark";

export function SiteFooter({
  homeHref = "/",
  workspaceLinks = false,
}: {
  homeHref?: string;
  workspaceLinks?: boolean;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="shrink-0 border-t border-line bg-surface">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2.5">
          <BrandMark size={28} />
          <span className="min-w-0">
            <Wordmark className="block text-sm leading-none" />
            <span className="mt-0.5 hidden text-[11px] text-muted sm:block">
              Maps for live events
            </span>
          </span>
        </Link>

        <nav aria-label="Footer" className="flex items-center gap-3 text-[11px] font-medium text-muted">
          {workspaceLinks && (
            <>
              <Link href="/dashboard/team" className="hidden hover:text-foreground sm:inline">
                Team
              </Link>
              <Link href="/dashboard/settings" className="hover:text-foreground">
                Settings
              </Link>
            </>
          )}
          <span className="opacity-50">© {year}</span>
        </nav>
      </div>
    </footer>
  );
}
