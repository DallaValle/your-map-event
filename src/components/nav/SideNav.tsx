"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  isActive: (pathname: string) => boolean;
}

/**
 * Left sidebar navigation for the console. Two groups: the selected event's
 * sections (Dashboard, Schedule, Map editor, and the planned sections) then
 * workspace pages (Team, Settings). Notifications live in the header bell.
 * Collapses to an icon rail via `collapsed` (or automatically below lg).
 */
export function SideNav({
  isAdmin,
  activeEventId,
  collapsed = false,
}: {
  isAdmin: boolean;
  activeEventId: string | null;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const mapEditorHref = activeEventId
    ? `/dashboard/events/${activeEventId}`
    : "/dashboard/events/new";

  const eventSections: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "🎫", isActive: (p) => p === "/dashboard" },
    { href: "/dashboard/schedule", label: "Schedule", icon: "🗓️", isActive: (p) => p.startsWith("/dashboard/schedule") },
    ...(isAdmin
      ? [
          {
            href: mapEditorHref,
            label: "Map editor",
            icon: "🗺️",
            isActive: (p: string) => p.startsWith("/dashboard/events"),
          },
        ]
      : []),
    { href: "/dashboard/board", label: "Board", icon: "📋", isActive: (p) => p.startsWith("/dashboard/board") },
    { href: "/dashboard/social", label: "Social campaign", icon: "📣", isActive: (p) => p.startsWith("/dashboard/social") },
    { href: "/dashboard/analytics", label: "Analytics", icon: "📊", isActive: (p) => p.startsWith("/dashboard/analytics") },
    { href: "/dashboard/history", label: "History", icon: "🕑", isActive: (p) => p.startsWith("/dashboard/history") },
  ];

  const workspace: NavItem[] = [
    ...(isAdmin
      ? [{ href: "/dashboard/team", label: "Team", icon: "👥", isActive: (p: string) => p.startsWith("/dashboard/team") }]
      : []),
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️", isActive: (p) => p.startsWith("/dashboard/settings") },
  ];

  const renderItem = (item: NavItem) => (
    <li key={`${item.label}-${item.href}`}>
      <Link
        href={item.href}
        title={item.label}
        className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
          collapsed ? "justify-center px-0" : "max-lg:justify-center max-lg:px-0"
        } ${
          item.isActive(pathname)
            ? "bg-teal-700/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-400"
            : "opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
        }`}
      >
        <span className="text-lg" aria-hidden>
          {item.icon}
        </span>
        <span className={collapsed ? "hidden" : "max-lg:hidden"}>{item.label}</span>
      </Link>
    </li>
  );

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 pb-3">
      <ul className="flex flex-col gap-0.5">{eventSections.map(renderItem)}</ul>

      <div className="my-2 h-px bg-black/10 dark:bg-white/10" role="separator" />

      <ul className="flex flex-col gap-0.5">{workspace.map(renderItem)}</ul>
    </nav>
  );
}
