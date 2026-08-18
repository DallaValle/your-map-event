export const THEME_COOKIE = "user-theme";
export const THEMES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEMES)[number];

export const DEFAULT_PREFS = {
  emailNotifications: true,
  pushNotifications: true,
  eventAnnouncements: true,
  theme: "system" as ThemePreference,
};

export function asTheme(value: string | null | undefined): ThemePreference {
  return THEMES.includes(value as ThemePreference) ? (value as ThemePreference) : DEFAULT_PREFS.theme;
}
