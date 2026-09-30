import type { ThemePreference } from "@/components/settings/prefs";

/** Resolve whether the document should use the dark class. */
export function schemeIsDark(theme: ThemePreference, prefersDark: boolean) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return prefersDark;
}

/** Tiny blocking script: applies .dark before first paint for `system` / `mono`. */
export const THEME_BOOTSTRAP = `(function(){
  var root = document.documentElement;
  var theme = root.getAttribute("data-theme") || "system";
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var dark = theme === "dark" || ((theme === "system" || theme === "mono") && prefersDark);
  root.classList.toggle("dark", dark);
})();`;

export function applyThemeClass(theme: ThemePreference) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", schemeIsDark(theme, prefersDark));
  root.style.colorScheme = root.classList.contains("dark") ? "dark" : "light";
}
