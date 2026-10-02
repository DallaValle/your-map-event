import type { Metadata } from "next";
import type { Messages } from "next-intl";
import { getTranslations } from "next-intl/server";

/** `export const generateMetadata = pageTitle("schedule")` for a translated tab title. */
export function pageTitle(key: keyof Messages["titles"]) {
  return async (): Promise<Metadata> => ({ title: (await getTranslations("titles"))(key) });
}
