"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { createPoiAction, updatePoiAction, deletePoiAction } from "@/actions/pois";
import { ImageField } from "@/components/upload/ImageField";
import { DEFAULT_POI_ICON, POI_ICONS, type LatLng, type PoiCategoryData, type PoiData } from "@/components/map/types";
import { poiCode, suggestedColor } from "@/components/map/poi-badge";
import type { ActivityDTO } from "@/lib/activity";
import { PoiScheduleSection } from "./PoiScheduleSection";
import type { ActionState } from "@/actions/types";
import { PendingLabel } from "@/components/ui/Spinner";

export type PoiSheetMode =
  | { type: "create" }
  | { type: "edit"; poi: PoiData };

/**
 * Compact floating POI form. It deliberately does NOT cover the map: while
 * it's open the admin can keep tapping the map to reposition the point
 * (the parent feeds taps back in through the controlled `position` prop),
 * or type exact coordinates here.
 */
export function PoiSheet({
  mapId,
  mode,
  position,
  uploadsEnabled,
  activities = [],
  categories = [],
  markerColor = null,
  eventStartTime = null,
  eventEndTime = null,
  onClose,
  onPositionChange,
}: {
  mapId: string;
  mode: PoiSheetMode;
  position: LatLng;
  uploadsEnabled: boolean;
  activities?: ActivityDTO[];
  categories?: PoiCategoryData[];
  /** Event wide marker color; it wins over category colors, like on the map. */
  markerColor?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  onClose: () => void;
  onPositionChange: (position: LatLng) => void;
}) {
  const t = useTranslations("poiSheet");
  const router = useRouter();
  const isEdit = mode.type === "edit";

  const [lat, setLat] = useState(position.lat.toFixed(6));
  const [lng, setLng] = useState(position.lng.toFixed(6));
  const [icon, setIcon] = useState(isEdit ? (mode.poi.icon ?? DEFAULT_POI_ICON) : DEFAULT_POI_ICON);
  const [title, setTitle] = useState(isEdit ? mode.poi.title : "");
  const [categoryId, setCategoryId] = useState(isEdit ? (mode.poi.categoryId ?? "") : "");
  const category = categories.find((c) => c.id === categoryId);
  const [ownColor, setOwnColor] = useState<string | null>(isEdit ? (mode.poi.color ?? null) : null);
  // Icons in use come first, so a 🍷 imported from a flyer stays selectable.
  const iconChoices = [...new Set([icon, ...categories.map((c) => c.icon), ...POI_ICONS])];
  const titleCode = poiCode({ title, code: null }).code;

  // Map taps update `position` from outside — mirror them into the inputs.
  // Manual typing round-trips through onPositionChange to the same value,
  // so this only rewrites the fields when the map actually moved the point.
  useEffect(() => {
    if (parseFloat(lat) !== position.lat) setLat(position.lat.toFixed(6));
    if (parseFloat(lng) !== position.lng) setLng(position.lng.toFixed(6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  function updateCoord(which: "lat" | "lng", raw: string) {
    if (which === "lat") setLat(raw);
    else setLng(raw);
    const parsedLat = parseFloat(which === "lat" ? raw : lat);
    const parsedLng = parseFloat(which === "lng" ? raw : lng);
    if (
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      Math.abs(parsedLat) <= 90 &&
      Math.abs(parsedLng) <= 180
    ) {
      onPositionChange({ lat: parsedLat, lng: parsedLng });
    }
  }

  const action = isEdit
    ? updatePoiAction.bind(null, mode.poi.id)
    : createPoiAction.bind(null, mapId);

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result?.ok) {
        router.refresh();
        onClose();
      }
      return result;
    },
    null,
  );

  const [deleting, setDeleting] = useState(false);
  // The description is always shown (every point should have one); the photo
  // stays optional behind a toggle, pre-opened when the point already has one.
  const [showPhoto, setShowPhoto] = useState(isEdit && !!mode.poi.imageUrl);

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm(t("confirmDelete", { name: mode.poi.title }))) return;
    setDeleting(true);
    const result = await deletePoiAction(mode.poi.id);
    setDeleting(false);
    if (result?.ok) {
      router.refresh();
      onClose();
    }
  }

  const inputClass =
    "rounded-xl border border-black/15 px-3 py-2.5 text-base outline-brand dark:border-white/20 dark:bg-white/5";

  return (
    <div className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[1100] mx-auto max-w-md">
      {/* 15rem = app header + event header above, bottom offset below: the title and close button stay visible. */}
      <div className="max-h-[calc(100dvh-15rem)] overflow-y-auto rounded-2xl border border-black/15 bg-white/97 p-4 shadow-2xl backdrop-blur dark:border-white/20 dark:bg-neutral-950/97">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold">
            {isEdit ? t("editTitle") : t("newTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex size-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>

        <p className="mb-3 text-xs opacity-60">
          {t("hint")}
        </p>

        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="title"
            required
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            aria-label={t("title")}
            autoFocus={!isEdit}
            className={inputClass}
          />

          <div className="flex gap-2">
            <label className="flex w-24 shrink-0 flex-col gap-0.5 text-xs font-medium opacity-70">
              {t("number")}
              <input
                name="code"
                maxLength={6}
                defaultValue={isEdit ? (mode.poi.code ?? "") : ""}
                // A "12." title prefix already counts; the field overrides it.
                placeholder={titleCode ?? "12"}
                aria-label={t("number")}
                className={`${inputClass} font-normal text-black dark:text-white`}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs font-medium opacity-70">
              {t("category")}
              <select
                name="categoryId"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  const next = categories.find((c) => c.id === e.target.value);
                  if (next) setIcon(next.icon);
                }}
                aria-label={t("category")}
                className={`${inputClass} font-normal text-black dark:text-white`}
              >
                <option value="">{t("noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Marker icon */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium opacity-70">{t("icon")}</span>
            <div className="flex flex-wrap gap-1">
              {iconChoices.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={t("useIcon", { icon: emoji })}
                  aria-pressed={icon === emoji}
                  onClick={() => setIcon(emoji)}
                  className={`flex size-9 items-center justify-center rounded-full border text-lg ${
                    icon === emoji
                      ? "border-brand bg-brand-soft"
                      : "border-black/10 dark:border-white/15"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input type="hidden" name="icon" value={icon} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="opacity-70">{t("color")}</span>
            <button
              type="button"
              aria-pressed={!ownColor}
              onClick={() => setOwnColor(null)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                !ownColor ? "border-brand bg-brand-soft" : "border-black/10 dark:border-white/15"
              }`}
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: markerColor ?? category?.color ?? suggestedColor(icon) }}
              />
              {markerColor ? t("eventColor") : category ? t("categoryColor") : t("automatic")}
            </button>
            <button
              type="button"
              aria-pressed={!!ownColor}
              onClick={() => setOwnColor(ownColor ?? markerColor ?? category?.color ?? suggestedColor(icon))}
              className={`rounded-full border px-2.5 py-1 ${
                ownColor ? "border-brand bg-brand-soft" : "border-black/10 dark:border-white/15"
              }`}
            >
              {t("ownColor")}
            </button>
            {ownColor && (
              <input
                type="color"
                value={ownColor}
                onChange={(e) => setOwnColor(e.target.value)}
                aria-label={t("ownColorLabel")}
                className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
              />
            )}
            <input type="hidden" name="color" value={ownColor ?? ""} />
          </div>

          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs opacity-70">
              {t("latitude")}
              <input
                name="lat"
                type="number"
                step="any"
                min={-90}
                max={90}
                required
                value={lat}
                onChange={(e) => updateCoord("lat", e.target.value)}
                className={`${inputClass} text-black dark:text-white`}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs opacity-70">
              {t("longitude")}
              <input
                name="lng"
                type="number"
                step="any"
                min={-180}
                max={180}
                required
                value={lng}
                onChange={(e) => updateCoord("lng", e.target.value)}
                className={`${inputClass} text-black dark:text-white`}
              />
            </label>
          </div>

          {/* Description: always shown so every point gets one. */}
          <label className="flex flex-col gap-1 text-xs font-medium opacity-70">
            {t("description")}
            <textarea
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={isEdit ? (mode.poi.description ?? "") : ""}
              placeholder={t("descriptionPlaceholder")}
              aria-label={t("description")}
              className={`${inputClass} font-normal`}
            />
          </label>

          {/* Photo stays optional to keep the card compact. */}
          {showPhoto ? (
            <ImageField
              name="imageUrl"
              label={t("photo")}
              endpoint="poiImage"
              uploadsEnabled={uploadsEnabled}
              defaultValue={isEdit ? mode.poi.imageUrl : null}
            />
          ) : (
            <>
              {/* Keep the value submitted even while the field is collapsed. */}
              <input
                type="hidden"
                name="imageUrl"
                value={isEdit ? (mode.poi.imageUrl ?? "") : ""}
                readOnly
              />
              <button
                type="button"
                onClick={() => setShowPhoto(true)}
                className="flex items-center gap-1.5 self-start text-sm font-semibold text-brand"
              >
                <Icon icon={Plus} size="sm" />
                {t("addPhoto")}
              </button>
            </>
          )}

          {state && !state.ok && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          )}

          <div className="flex gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-busy={deleting}
                className="rounded-xl border border-red-300 px-4 py-3 font-semibold text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
              >
                <PendingLabel pending={deleting} label={t("delete")} pendingLabel={t("deleting")} />
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="flex-1 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
            >
              <PendingLabel
                pending={pending}
                label={isEdit ? t("save") : t("add")}
                pendingLabel={t("saving")}
              />
            </button>
          </div>
        </form>

        {isEdit && (
          <PoiScheduleSection
            eventId={mapId}
            poiId={mode.poi.id}
            poiTitle={mode.poi.title}
            activities={activities}
            defaultStart={eventStartTime}
            defaultEnd={eventEndTime}
          />
        )}
      </div>
    </div>
  );
}
