"use client";

import { useEffect, useState } from "react";
import { EventSwitcher, type SwitchableEvent } from "./EventSwitcher";
import { SideNav } from "./SideNav";

const STORAGE_KEY = "yme.sidebar.collapsed";

/**
 * The console's left sidebar: an event switcher on top, then navigation. It
 * collapses to an icon rail on desktop (persisted in localStorage) and is
 * always a rail below lg. Shared across every dashboard screen, including the
 * map editor.
 */
export function DashboardSidebar({
  events,
  activeEventId,
  isAdmin,
}: {
  events: SwitchableEvent[];
  activeEventId: string | null;
  isAdmin: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-black/10 transition-[width] dark:border-white/10 max-lg:w-16 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className={collapsed ? "hidden" : "max-lg:hidden"}>
        <EventSwitcher events={events} activeEventId={activeEventId} isAdmin={isAdmin} />
      </div>

      <SideNav isAdmin={isAdmin} activeEventId={activeEventId} collapsed={collapsed} />

      <div
        className={`mt-auto flex px-2 pb-2 max-lg:hidden ${
          collapsed ? "justify-center" : "justify-end"
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-8 items-center justify-center rounded-lg text-sm opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          <span aria-hidden>{collapsed ? "»" : "«"}</span>
        </button>
      </div>
    </aside>
  );
}
