"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setMapPublishedAction } from "@/actions/maps";
import { EditorMapCanvas } from "@/components/map/MapCanvas";
import type { LatLng, PoiData } from "@/components/map/types";
import { PoiSheet, type PoiSheetMode } from "./PoiSheet";
import { MapSettingsForm } from "./MapSettingsForm";

export interface EditorMapData {
  id: string;
  name: string;
  description: string | null;
  centerLat: number;
  centerLng: number;
  centerName: string;
  zoom: number;
  published: boolean;
}

export function MapEditor({
  map,
  pois,
  teamSlug,
  uploadsEnabled,
}: {
  map: EditorMapData;
  pois: PoiData[];
  teamSlug: string;
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<PoiSheetMode | null>(null);
  const [filter, setFilter] = useState("");
  const [publishPending, startPublish] = useTransition();

  const draftPosition: LatLng | null =
    sheet?.type === "create" ? sheet.position : null;

  const filtered = filter.trim()
    ? pois.filter((poi) =>
        poi.title.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : pois;

  function togglePublished() {
    startPublish(async () => {
      await setMapPublishedAction(map.id, !map.published);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 px-5 py-4">
        <Link href="/dashboard" aria-label="Back to maps" className="text-xl">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{map.name}</h1>
          <p className="truncate text-xs opacity-60">{map.centerName}</p>
        </div>
        <button
          type="button"
          onClick={togglePublished}
          disabled={publishPending}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
            map.published
              ? "bg-teal-700/10 text-teal-700 dark:text-teal-400"
              : "bg-black/5 dark:bg-white/10"
          }`}
        >
          {publishPending ? "…" : map.published ? "Published ✓" : "Publish"}
        </button>
      </header>

      <div className="relative h-[55dvh]">
        <EditorMapCanvas
          center={{ lat: map.centerLat, lng: map.centerLng }}
          zoom={map.zoom}
          pois={pois}
          draftPosition={draftPosition}
          onMapClick={(position) => setSheet({ type: "create", position })}
          onPoiClick={(poi) => setSheet({ type: "edit", poi })}
        />
        <p className="pointer-events-none absolute inset-x-0 bottom-2 z-[1000] mx-auto w-fit rounded-full bg-black/70 px-4 py-1.5 text-xs font-medium text-white">
          Tap the map to add a point
        </p>
      </div>

      <section className="flex flex-col gap-3 px-5 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            Points of interest ({pois.length})
          </h2>
          {map.published && (
            <Link
              href={`/${teamSlug}`}
              className="text-sm font-semibold text-teal-700 dark:text-teal-400"
            >
              View live →
            </Link>
          )}
        </div>

        {pois.length > 3 && (
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter points…"
            className="rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5"
          />
        )}

        {pois.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 px-4 py-8 text-center text-sm opacity-60 dark:border-white/25">
            No points yet — tap anywhere on the map above.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
            {filtered.map((poi) => (
              <li key={poi.id}>
                <button
                  type="button"
                  onClick={() => setSheet({ type: "edit", poi })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10"
                >
                  {poi.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poi.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-lg bg-teal-700/10">📌</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{poi.title}</p>
                    {poi.description && (
                      <p className="truncate text-xs opacity-60">{poi.description}</p>
                    )}
                  </div>
                  <span className="text-sm opacity-40">Edit</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm opacity-60">No matches.</li>
            )}
          </ul>
        )}
      </section>

      <section className="px-5 pb-8">
        <details className="rounded-2xl border border-black/10 dark:border-white/15">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
            Map settings
          </summary>
          <div className="border-t border-black/10 px-4 py-4 dark:border-white/15">
            <MapSettingsForm map={map} />
          </div>
        </details>
      </section>

      {sheet && (
        <PoiSheet
          mapId={map.id}
          mode={sheet}
          uploadsEnabled={uploadsEnabled}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
