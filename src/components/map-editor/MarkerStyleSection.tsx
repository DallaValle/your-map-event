"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, type Messages } from "next-intl";
import { Plus, Trash2, X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import {
  createCategoryAction,
  createSuggestedCategoriesAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/actions/categories";
import type { ActionState } from "@/actions/types";
import { categoryNameKey, suggestCategories } from "@/components/map/poi-badge";
import { DEFAULT_POI_ICON, type MarkerLabel, type PoiCategoryData, type PoiData } from "@/components/map/types";

const LABEL_OPTIONS: MarkerLabel[] = ["auto", "number", "icon"];

const DEFAULT_BRAND_COLOR = "#0f766e";

const swatch =
  "size-8 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0";

const chip =
  "flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm hover:border-foreground/30 disabled:opacity-50";

/**
 * Admin controls for how markers look: number or icon, one brand color or
 * category colors, and the categories themselves (the attendee legend).
 */
export function MarkerStyleSection({
  eventId,
  pois,
  categories,
  markerLabel,
  markerColor,
  onStyleChange,
  styleError,
}: {
  eventId: string;
  pois: PoiData[];
  categories: PoiCategoryData[];
  markerLabel: MarkerLabel;
  markerColor: string | null;
  /** `debounce` while a color is being dragged; a click saves at once. */
  onStyleChange: (
    style: { markerLabel: MarkerLabel; markerColor: string | null },
    options?: { debounce?: boolean },
  ) => void;
  /** Why the last marker style save failed. */
  styleError?: string | null;
}) {
  const t = useTranslations("markers");
  const names = useTranslations("categoryNames");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionState>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const countFor = (categoryId: string) => pois.filter((p) => p.categoryId === categoryId).length;

  // The easy start: icon groups already on the map that no category covers yet.
  const nameOf = (english: string) => {
    const key = categoryNameKey(english) as keyof Messages["categoryNames"];
    return names.has(key) ? names(key) : english;
  };
  const suggestions = suggestCategories(pois, nameOf).map((suggestion) => ({
    ...suggestion,
    match: categories.find((c) => c.name.toLowerCase() === suggestion.name.toLowerCase()),
  }));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="markers-heading">
      <div>
        <h2 id="markers-heading" className="text-sm font-semibold">
          {t("title")}
        </h2>
        <p className="mt-0.5 text-xs opacity-60">{t("hint")}</p>
      </div>

      <div role="radiogroup" aria-label={t("showOn")} className="grid grid-cols-3 gap-2">
        {LABEL_OPTIONS.map((option) => {
          const selected = markerLabel === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              title={t(`labels.${option}.hint`)}
              onClick={() => onStyleChange({ markerLabel: option, markerColor })}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                selected ? "border-brand bg-brand-soft ring-1 ring-brand/40" : "border-line hover:border-foreground/30"
              }`}
            >
              <span className="block text-sm font-semibold">{t(`labels.${option}.label`)}</span>
              <span className="mt-0.5 block text-[11px] leading-tight opacity-60">{t(`labels.${option}.hint`)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("colors")}>
        <span className="mr-1 text-sm font-medium">{t("colorsShort")}</span>
        <button
          type="button"
          role="radio"
          aria-checked={!markerColor}
          onClick={() => onStyleChange({ markerLabel, markerColor: null })}
          className={`${chip} ${!markerColor ? "border-brand bg-brand-soft" : ""}`}
        >
          {t("byCategory")}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!!markerColor}
          onClick={() => !markerColor && onStyleChange({ markerLabel, markerColor: DEFAULT_BRAND_COLOR })}
          className={`${chip} ${markerColor ? "border-brand bg-brand-soft" : ""}`}
        >
          {t("oneColor")}
        </button>
        {markerColor && (
          <input
            type="color"
            value={markerColor}
            onChange={(e) => onStyleChange({ markerLabel, markerColor: e.target.value }, { debounce: true })}
            aria-label={t("markerColor")}
            className={swatch}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t("categories")}</h3>
          <span className="text-xs opacity-60">{t("categoriesHint")}</span>
        </div>

        {categories.length > 0 && (
          <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
            {categories.map((category) => (
              <CategoryRow
                // By id only: a refresh after autosave must not remount the row being typed in.
                key={category.id}
                category={category}
                count={countFor(category.id)}
                onSave={(next) => run(() => updateCategoryAction(category.id, next))}
                onDelete={() => run(() => deleteCategoryAction(category.id))}
              />
            ))}
          </ul>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-black/20 p-3 dark:border-white/25">
            <p className="text-xs opacity-70">
              {categories.length === 0
                ? t("startFromIcons")
                : t("uncategorized")}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(({ key, name, icons, color, count, match }) => (
                <button
                  key={key}
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => createSuggestedCategoriesAction(eventId, [key]))}
                  className={chip}
                >
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: match?.color ?? color }} />
                  <span aria-hidden>{icons.slice(0, 3).join("")}</span>
                  {match ? t("addTo", { count, name: match.name }) : `${name} (${count})`}
                </button>
              ))}
              {suggestions.length > 1 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => createSuggestedCategoriesAction(eventId, suggestions.map((s) => s.key)))}
                  className={`${chip} font-semibold text-brand`}
                >
                  {t("createAll", { count: suggestions.length })}
                </button>
              )}
            </div>
          </div>
        )}

        <NewCategory disabled={pending} onCreate={(input) => run(() => createCategoryAction(eventId, input))} />
        {(error || styleError) && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error ?? styleError}
          </p>
        )}
      </div>
    </section>
  );
}

type CategoryInput = { name: string; icon: string; color: string };

function CategoryFields({
  value,
  onChange,
  disabled,
}: {
  value: CategoryInput;
  onChange: (next: CategoryInput) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("markers");
  return (
    <>
      <input
        type="color"
        value={value.color}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, color: e.target.value })}
        aria-label={t("categoryColor")}
        className={swatch}
      />
      <input
        value={value.icon}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, icon: e.target.value })}
        aria-label={t("categoryIcon")}
        maxLength={8}
        className="w-12 shrink-0 rounded-lg border border-black/15 px-1 py-1.5 text-center text-lg dark:border-white/20 dark:bg-white/5"
      />
      <input
        value={value.name}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        aria-label={t("categoryName")}
        placeholder={t("categoryName")}
        maxLength={40}
        className="min-w-0 flex-1 rounded-lg border border-black/15 px-2.5 py-1.5 text-sm dark:border-white/20 dark:bg-white/5"
      />
    </>
  );
}

function sameCategory(a: CategoryInput, b: CategoryInput) {
  return a.name === b.name && a.icon === b.icon && a.color === b.color;
}

function CategoryRow({
  category,
  count,
  onSave,
  onDelete,
}: {
  category: PoiCategoryData;
  count: number;
  onSave: (next: CategoryInput) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("markers");
  const [value, setValue] = useState<CategoryInput>(category);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);

  // Take saved values from the server only while the admin is not typing here
  // and nothing local is still waiting to save, so a refresh never rolls a field back.
  const [synced, setSynced] = useState<CategoryInput>(category);
  if (!editing && !sameCategory(synced, category)) {
    setSynced(category);
    if (sameCategory(value, synced)) setValue(category);
  }

  // Saves shortly after the last keystroke or color drag, like the rest of the editor.
  const changed = !sameCategory(value, category);
  const valid = !!value.name.trim() && !!value.icon.trim();
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });
  useEffect(() => {
    if (!changed || !valid) return;
    const timer = window.setTimeout(() => onSaveRef.current(value), 600);
    return () => window.clearTimeout(timer);
  }, [changed, valid, value]);

  return (
    <li
      className="flex items-center gap-2 px-3 py-2"
      aria-label={t("categoryRow", { name: category.name })}
      onFocus={() => setEditing(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditing(false);
      }}
    >
      <CategoryFields value={value} onChange={setValue} />
      <span className="w-8 shrink-0 text-right text-xs tabular-nums opacity-60" title={t("pointCount", { count })}>
        {count}
      </span>
      {confirming ? (
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onDelete} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-red-600 dark:text-red-400">
            {t("delete")}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-lg px-2 text-xs opacity-70">
            {t("keep")}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={t("deleteCategory", { name: category.name })}
          className="flex size-11 shrink-0 items-center justify-center rounded-full opacity-50 hover:opacity-80"
        >
          <Icon icon={Trash2} size="sm" />
        </button>
      )}
    </li>
  );
}

function NewCategory({ disabled, onCreate }: { disabled: boolean; onCreate: (input: CategoryInput) => void }) {
  const t = useTranslations("markers");
  const [draft, setDraft] = useState<CategoryInput | null>(null);
  if (!draft) {
    return (
      <button
        type="button"
        onClick={() => setDraft({ name: "", icon: DEFAULT_POI_ICON, color: DEFAULT_BRAND_COLOR })}
        className="flex items-center gap-1.5 self-start text-sm font-semibold text-brand"
      >
        <Icon icon={Plus} size="sm" />
        {t("addCategory")}
      </button>
    );
  }
  return (
    <form
      aria-label={t("newCategory")}
      className="flex items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 dark:border-white/15"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.name.trim()) return;
        onCreate(draft);
        setDraft(null);
      }}
    >
      <CategoryFields value={draft} onChange={setDraft} disabled={disabled} />
      <button type="submit" disabled={disabled || !draft.name.trim()} className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-fg disabled:opacity-40">
        {t("add")}
      </button>
      <button type="button" onClick={() => setDraft(null)} aria-label={t("cancel")} className="flex shrink-0 px-1 opacity-60">
        <Icon icon={X} size="sm" />
      </button>
    </form>
  );
}
