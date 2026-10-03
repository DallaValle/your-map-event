"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  MapIcon,
  Megaphone,
  RadioTower,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

const isEventEditorPath = (pathname: string) =>
  pathname.startsWith("/dashboard/events/") && pathname !== "/dashboard/events/new";

const isPricingPath = (pathname: string) => pathname === "/dashboard/events/new";

/**
 * Left sidebar navigation for the console. Two groups: the selected event's
 * sections (Dashboard, Schedule, Map editor, …) then workspace pages
 * (Pricing, Team, Settings).
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
  const t = useTranslations("nav");
  const pathname = usePathname();

  const eventSections: NavItem[] = [
    {
      href: "/dashboard",
      label: t("dashboard"),
      icon: LayoutDashboard,
      isActive: (p) => p === "/dashboard",
    },
    {
      href: "/dashboard/schedule",
      label: t("schedule"),
      icon: CalendarDays,
      isActive: (p) => p.startsWith("/dashboard/schedule"),
    },
    // Map editor needs a selected event — hide the item when there isn't one
    // so /events/new is never mistaken for the editor.
    ...(isAdmin && activeEventId
      ? [
          {
            href: `/dashboard/events/${activeEventId}`,
            label: t("mapEditor"),
            icon: MapIcon,
            isActive: isEventEditorPath,
          },
        ]
      : []),
    {
      href: "/dashboard/board",
      label: t("board"),
      icon: ClipboardList,
      isActive: (p) => p.startsWith("/dashboard/board"),
    },
    {
      href: "/dashboard/announcements",
      label: t("announcements"),
      icon: RadioTower,
      isActive: (p) => p.startsWith("/dashboard/announcements"),
    },
    {
      href: "/dashboard/social",
      label: t("social"),
      icon: Megaphone,
      isActive: (p) => p.startsWith("/dashboard/social"),
    },
    {
      href: "/dashboard/analytics",
      label: t("analytics"),
      icon: ChartColumn,
      isActive: (p) => p.startsWith("/dashboard/analytics"),
    },
    {
      href: "/dashboard/history",
      label: t("history"),
      icon: History,
      isActive: (p) => p.startsWith("/dashboard/history"),
    },
  ];

  const workspace: NavItem[] = [
    ...(isAdmin
      ? [
          {
            href: "/dashboard/events/new",
            label: t("pricing"),
            icon: CreditCard,
            isActive: isPricingPath,
          },
          {
            href: "/dashboard/team",
            label: t("team"),
            icon: Users,
            isActive: (p: string) => p.startsWith("/dashboard/team"),
          },
        ]
      : []),
    {
      href: "/dashboard/ai",
      label: t("ai"),
      icon: Sparkles,
      isActive: (p) => p.startsWith("/dashboard/ai"),
    },
    {
      href: "/dashboard/settings",
      label: t("settings"),
      icon: Settings,
      isActive: (p) => p.startsWith("/dashboard/settings"),
    },
  ];

  const renderItem = (item: NavItem) => {
    const active = item.isActive(pathname);
    return (
      <li key={`${item.label}-${item.href}`}>
        <Link
          href={item.href}
          title={item.label}
          aria-current={active ? "page" : undefined}
          className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
            collapsed ? "justify-center px-0" : "max-lg:justify-center max-lg:px-0"
          } ${
            active
              ? "bg-brand-soft text-brand"
              : "text-muted hover:bg-brand-soft hover:text-foreground"
          }`}
        >
          <NavIcon icon={item.icon} />
          <span className={collapsed ? "hidden" : "max-lg:hidden"}>{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label={t("dashboard")} className="flex flex-1 flex-col gap-1 px-3 pb-3">
      <ul className="flex flex-col gap-0.5">{eventSections.map(renderItem)}</ul>

      <div className="my-2 h-px bg-black/10 dark:bg-white/10" role="separator" />

      <ul className="flex flex-col gap-0.5">{workspace.map(renderItem)}</ul>
    </nav>
  );
}

/** Spins over the icon while the click waits on the server; overlaid so labels never shift. */
function NavIcon({ icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return (
    <span className="relative flex" aria-hidden>
      <Icon icon={icon} className={pending ? "invisible" : undefined} />
      {pending ? (
        <Spinner className="absolute inset-0 m-auto size-[1.125rem] text-brand" />
      ) : null}
    </span>
  );
}
