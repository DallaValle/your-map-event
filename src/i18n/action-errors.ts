import "server-only";

import { getLocale, getTranslations } from "next-intl/server";
import en from "../../messages/en.json";
import { DEFAULT_LOCALE } from "./config";

// Schemas and validators stay in English (the MCP tools share them), so an
// action error is matched back to its catalog key by the English text.
const KEY_BY_TEXT = new Map<string, keyof typeof en.errors>(
  Object.entries(en.errors).map(([key, text]) => [text, key as keyof typeof en.errors]),
);

// Messages that carry a value, matched by shape.
const PATTERNS: [RegExp, "slugReserved" | "addressTaken" | "teamAddressTaken" | "activityTooLong", string][] = [
  [/^"([^"]+)" is reserved\. Please pick another slug\.$/, "slugReserved", "slug"],
  [/^The address "([^"]+)" is already taken\.$/, "teamAddressTaken", "address"],
  [/^"([^"]+)" is already taken\.$/, "addressTaken", "address"],
  [/^An activity cannot run longer than (\d+) days$/, "activityTooLong", "days"],
];

export async function localizeError(message: string): Promise<string> {
  const t = await getTranslations("errors");
  const key = KEY_BY_TEXT.get(message);
  if (key) return t(key);
  for (const [pattern, patternKey, param] of PATTERNS) {
    const match = pattern.exec(message);
    if (match) return t(patternKey, { [param]: match[1] } as never);
  }
  if ((await getLocale()) === DEFAULT_LOCALE) return message;
  return t("generic");
}

/** Failed action state with the message in the reader's language. */
export async function fail(message: string): Promise<{ ok: false; error: string }> {
  return { ok: false, error: await localizeError(message) };
}
