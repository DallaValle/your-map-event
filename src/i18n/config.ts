// Locales come from the files in messages/ (see next.config.ts), so a new
// language is one new catalog and no code change.
export const LOCALES = (process.env.NEXT_PUBLIC_LOCALES ?? "en").split(",");
export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "user-locale";

export type AppLocale = string;

export function asLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  const base = value.toLowerCase().split("-")[0];
  return LOCALES.includes(base) ? base : null;
}

/** Best supported match for an Accept-Language header, English otherwise. */
export function negotiateLocale(header: string | null | undefined): AppLocale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag, q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const match = asLocale(tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

/** "Italiano", "English": each language named in its own words. */
export function localeName(locale: AppLocale): string {
  const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** BCP 47 tag for Intl formatters ("it" formats as it-IT). */
export function intlTag(locale: AppLocale): string {
  return locale === "en" ? "en-GB" : locale;
}
