"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

/** Per-event sections. Only "Event" is built today; the rest are stubs. */
const EVENT_SECTIONS: NavItem[] = [
  { href: "/dashboard", label: "Event", icon: "🗺️" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "🔔" },
  { href: "/dashboard/board", label: "Board", icon: "📋" },
  { href: "/dashboard/social", label: "Social campaign", icon: "📣" },
  { href: "/dashboard/history", label: "History", icon: "🕑" },
];

/**
 * Left sidebar navigation for the console. Two groups: the selected event's
 * sections on top, then workspace-level pages (Team, Settings). On narrow
 * screens it collapses to an icon rail.
 */
export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const workspace: NavItem[] = [
    ...(isAdmin ? [{ href: "/dashboard/team", label: "Team", icon: "👥" }] : []),
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
  ];

  const isActive = (item: NavItem) =>
    item.href === "/dashboard"
      ? pathname === "/dashboard" || pathname.startsWith("/dashboard/events")
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const renderItem = (item: NavItem) => (
    <li key={item.href}>
      <Link
        href={item.href}
        title={item.label}
        className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium max-lg:justify-center max-lg:px-0 ${
          isActive(item)
            ? "bg-teal-700/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-400"
            : "opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
        }`}
      >
        <span className="text-lg" aria-hidden>
          {item.icon}
        </span>
        <span className="max-lg:hidden">{item.label}</span>
      </Link>
    </li>
  );

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 pb-3">
      <ul className="flex flex-col gap-0.5">{EVENT_SECTIONS.map(renderItem)}</ul>

      <div className="my-2 h-px bg-black/10 dark:bg-white/10" role="separator" />

      <ul className="flex flex-col gap-0.5">{workspace.map(renderItem)}</ul>
    </nav>
  );
}
