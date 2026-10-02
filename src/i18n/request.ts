import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { asLocale, DEFAULT_LOCALE, LOCALE_COOKIE, negotiateLocale } from "./config";

type Catalog = { [key: string]: string | Catalog };

// A key missing from a translation shows the English text instead of the key.
function withFallback(base: Catalog, override: Catalog): Catalog {
  const merged: Catalog = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const fallback = base[key];
    merged[key] =
      typeof value === "object" && typeof fallback === "object" ? withFallback(fallback, value) : value;
  }
  return merged;
}

// No locale in the URL: the organizer's saved choice (cookie) wins, otherwise
// the device language. Attendees never have the cookie, so they get their phone's.
export default getRequestConfig(async () => {
  const saved = asLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const locale = saved ?? negotiateLocale((await headers()).get("accept-language"));
  const english: Catalog = (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
  const messages =
    locale === DEFAULT_LOCALE
      ? english
      : withFallback(english, (await import(`../../messages/${locale}.json`)).default);
  return { locale, messages, timeZone: "UTC" };
});
