"use client";

import { useLayoutEffect } from "react";
import type { ThemePreference } from "@/components/settings/prefs";
import { applyThemeClass } from "./apply-theme";

/** Keeps data-theme and .dark in sync after a server render or theme save. */
export function ThemeSync({ theme }: { theme: ThemePreference }) {
  useLayoutEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  return null;
}
