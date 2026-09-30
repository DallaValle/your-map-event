"use client";

import { useLayoutEffect } from "react";
import type { ThemePreference } from "@/components/settings/prefs";
import { applyThemeClass } from "./apply-theme";
import { syncThemeCookieAction } from "@/actions/settings";

export function ThemeSync({ theme }: { theme: ThemePreference }) {
  useLayoutEffect(() => {
    applyThemeClass(theme);
    if (theme !== "system" && theme !== "mono") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeClass(theme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useLayoutEffect(() => {
    void syncThemeCookieAction().then((result) => {
      if (result.theme !== theme) applyThemeClass(result.theme);
    });
  }, [theme]);

  return null;
}
