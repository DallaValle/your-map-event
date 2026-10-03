"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { readableTextOn } from "@/lib/color";

// Matches the app brand, so a first pick already looks intentional.
const STARTER_COLOR = "#163f3a";

const chip = "rounded-full border border-black/15 px-3 py-1.5 text-sm font-medium dark:border-white/20";
const swatch =
  "size-8 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0";

/** Live map bar color: theme default or one organizer color, previewed on a mini top bar. */
export function BarColorField({
  defaultValue,
  eventName,
  subtitle,
}: {
  defaultValue: string | null;
  eventName: string;
  subtitle: string;
}) {
  const t = useTranslations("eventInfo");
  const [color, setColor] = useState(defaultValue);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{t("bars")}</legend>
      <input type="hidden" name="barColor" value={color ?? ""} />

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("bars")}>
        <button
          type="button"
          role="radio"
          aria-checked={!color}
          onClick={() => setColor(null)}
          className={`${chip} ${!color ? "border-brand bg-brand-soft" : ""}`}
        >
          {t("barsDefault")}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!!color}
          onClick={() => !color && setColor(STARTER_COLOR)}
          className={`${chip} ${color ? "border-brand bg-brand-soft" : ""}`}
        >
          {t("barsOwn")}
        </button>
        {color && (
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label={t("barColor")}
            className={swatch}
          />
        )}
      </div>

      <div
        aria-hidden
        data-testid="bar-preview"
        className={`max-w-xs rounded-b-2xl px-4 pb-2.5 pt-2 shadow-md ${
          color ? "" : "bg-white text-foreground dark:bg-neutral-900"
        }`}
        style={color ? { background: color, color: readableTextOn(color) } : undefined}
      >
        <p className="truncate text-sm font-semibold leading-tight">{eventName}</p>
        <p className="truncate text-[11px] leading-tight opacity-70">{subtitle}</p>
      </div>

      <span className="text-xs opacity-60">{t("barsHint")}</span>
    </fieldset>
  );
}
