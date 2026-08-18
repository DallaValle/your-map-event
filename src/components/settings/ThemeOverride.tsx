"use client";

import { useLayoutEffect } from "react";
import type { ThemePreference } from "@/components/settings/prefs";

const TOKENS = {
  light: { background: "#ffffff", foreground: "#171717" },
  dark: { background: "#0a0a0a", foreground: "#ededed" },
} as const;

/** Applies the saved theme override on this page without rewriting global tokens. */
export function ThemeOverride({ theme }: { theme: ThemePreference }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.style.removeProperty("color-scheme");
      root.style.removeProperty("--background");
      root.style.removeProperty("--foreground");
      return;
    }
    const tokens = TOKENS[theme];
    root.style.colorScheme = theme;
    root.style.setProperty("--background", tokens.background);
    root.style.setProperty("--foreground", tokens.foreground);
  }, [theme]);

  return null;
}
