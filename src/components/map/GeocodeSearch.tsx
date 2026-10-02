"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  /** Bounding box of the found place, when Nominatim provides one. */
  bounds?: { swLat: number; swLng: number; neLat: number; neLng: number };
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
}

/**
 * Place search backed by OSM Nominatim. Searches only on explicit submit
 * (Enter / button) — Nominatim's usage policy caps at 1 req/s, so no
 * per-keystroke autocomplete.
 */
export function GeocodeSearch({
  placeholder,
  onSelect,
}: {
  placeholder?: string;
  onSelect: (result: GeocodeResult) => void;
}) {
  const t = useTranslations("geocode");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSearch = useRef(0);

  async function search() {
    const q = query.trim();
    if (q.length < 3) {
      setError(t("tooShort"));
      return;
    }
    // Client-side throttle to stay well within Nominatim's 1 req/s policy.
    const now = Date.now();
    if (now - lastSearch.current < 1100) return;
    lastSearch.current = now;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=${locale}&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error(t("failedStatus", { status: response.status }));
      const items = (await response.json()) as NominatimItem[];
      setResults(
        items.map((item) => ({
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          label: item.display_name,
          bounds: item.boundingbox
            ? {
                swLat: parseFloat(item.boundingbox[0]),
                neLat: parseFloat(item.boundingbox[1]),
                swLng: parseFloat(item.boundingbox[2]),
                neLng: parseFloat(item.boundingbox[3]),
              }
            : undefined,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder={placeholder ?? t("placeholder")}
          aria-label={t("label")}
          className="min-w-0 flex-1 rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="shrink-0 rounded-xl bg-brand px-4 py-3 font-semibold text-brand-fg disabled:opacity-60"
        >
          {loading ? "…" : "🔍"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {results && (
        <ul className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/15 dark:bg-neutral-900">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm opacity-60">
              {t("none")}
            </li>
          ) : (
            results.map((result, index) => (
              <li key={index} className={index > 0 ? "border-t border-black/10 dark:border-white/15" : ""}>
                <button
                  type="button"
                  onClick={() => {
                    setResults(null);
                    setQuery("");
                    onSelect(result);
                  }}
                  className="w-full px-4 py-3 text-left text-sm active:bg-black/5 dark:active:bg-white/10"
                >
                  📍 {result.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <p className="text-[10px] opacity-40">
        {t("by")}{" "}
        <a href="https://nominatim.openstreetmap.org" target="_blank" rel="noreferrer" className="underline">
          Nominatim / OpenStreetMap
        </a>
      </p>
    </div>
  );
}
