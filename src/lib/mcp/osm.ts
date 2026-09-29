import type { GeocodeResult } from "@/components/map/GeocodeSearch";
import { distanceMeters, fromLocalMeters, toLocalMeters } from "./georef";

type LatLng = { lat: number; lng: number };

// HTTP: both OSM services ask for an identifying User-Agent and at most
// 1 request per second, so every call goes through one throttled queue.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Public Overpass instances are often overloaded: fall through to the next.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const MIN_INTERVAL_MS = 1_100;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

function userAgent() {
  const contact = process.env.BETTER_AUTH_URL ?? "https://github.com/DallaValle/your-map-event";
  return process.env.OSM_USER_AGENT || `your-map-event/0.1 (+${contact})`;
}

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await throttled(load);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function osmFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": userAgent(), Accept: "application/json", ...init?.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`OpenStreetMap service answered ${res.status}. Try again in a moment.`);
  return res.json();
}

// Nominatim search, same result shape as the dashboard GeocodeSearch.

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
}

export async function geocode(query: string, limit = 5): Promise<GeocodeResult[]> {
  const q = query.trim();
  return cached(`geo:${limit}:${q.toLowerCase()}`, async () => {
    const url = `${NOMINATIM_URL}?format=json&limit=${limit}&q=${encodeURIComponent(q)}`;
    const items = (await osmFetch(url)) as NominatimItem[];
    return items.map((item) => ({
      lat: Number(item.lat),
      lng: Number(item.lon),
      label: item.display_name,
      bounds: item.boundingbox
        ? {
            swLat: Number(item.boundingbox[0]),
            neLat: Number(item.boundingbox[1]),
            swLng: Number(item.boundingbox[2]),
            neLng: Number(item.boundingbox[3]),
          }
        : undefined,
    }));
  });
}

// Overpass: a named street near a point, merged into one polyline.

export interface Street {
  name: string;
  polyline: [number, number][];
  lengthMeters: number;
  /** OSM ways merged into the polyline; separate pieces are dropped. */
  ways: number;
  droppedPieces: number;
}

interface OverpassWay {
  type: "way";
  tags?: { name?: string };
  geometry?: { lat: number; lon: number }[];
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");

export async function findStreet(
  name: string,
  near: LatLng,
  radiusMeters = 1500,
): Promise<Street | null> {
  const clean = name.trim();
  const key = `street:${clean.toLowerCase()}:${near.lat.toFixed(4)},${near.lng.toFixed(4)}:${radiusMeters}`;
  const ways = await cached(key, async () => {
    const query = `[out:json][timeout:20];way["highway"]["name"~"^${escapeRegex(clean)}$",i](around:${Math.round(radiusMeters)},${near.lat},${near.lng});out geom;`;
    let body: unknown;
    for (const [i, url] of OVERPASS_URLS.entries()) {
      try {
        body = await osmFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
        });
        break;
      } catch (error) {
        if (i === OVERPASS_URLS.length - 1) throw error;
      }
    }
    return ((body as { elements?: OverpassWay[] }).elements ?? []).filter(
      (el) => el.type === "way" && (el.geometry?.length ?? 0) >= 2,
    );
  });
  if (ways.length === 0) return null;

  const pieces = mergeWays(ways.map((w) => w.geometry!.map((g) => ({ lat: g.lat, lng: g.lon }))));
  const longest = pieces.reduce((best, p) => (p.length > best.length ? p : best));
  return {
    name: ways[0].tags?.name ?? clean,
    polyline: longest.points.map((p) => [round6(p.lat), round6(p.lng)]),
    lengthMeters: Math.round(longest.length),
    ways: longest.ways,
    droppedPieces: pieces.length - 1,
  };
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Chains ways that share endpoints (within 2 m) into continuous pieces. */
export function mergeWays(ways: LatLng[][]) {
  const close = (a: LatLng, b: LatLng) => distanceMeters(a, b) < 2;
  const pieces: { points: LatLng[]; ways: number }[] = [];
  const remaining = ways.map((w) => [...w]);

  while (remaining.length > 0) {
    const piece = { points: remaining.shift()!, ways: 1 };
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < remaining.length; i++) {
        const w = remaining[i];
        const head = piece.points[0];
        const tail = piece.points[piece.points.length - 1];
        let joined: LatLng[] | null = null;
        if (close(tail, w[0])) joined = [...piece.points, ...w.slice(1)];
        else if (close(tail, w[w.length - 1])) joined = [...piece.points, ...w.slice(0, -1).reverse()];
        else if (close(head, w[w.length - 1])) joined = [...w.slice(0, -1), ...piece.points];
        else if (close(head, w[0])) joined = [...w.slice(1).reverse(), ...piece.points];
        if (joined) {
          piece.points = joined;
          piece.ways++;
          remaining.splice(i, 1);
          grew = true;
          break;
        }
      }
    }
    pieces.push(piece);
  }
  return pieces.map((p) => ({ ...p, length: polylineLength(p.points) }));
}

export function polylineLength(points: LatLng[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i]);
  return total;
}

// Snapping: spread N points between two positions along a polyline.

export type StreetSide = "left" | "right" | "center";

type Vec = { east: number; north: number };

function projectOnPolyline(line: Vec[], p: Vec) {
  let best = { distance: Infinity, along: 0 };
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const dx = b.east - a.east;
    const dy = b.north - a.north;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.east - a.east) * dx + (p.north - a.north) * dy) / len2));
    const cx = a.east + t * dx;
    const cy = a.north + t * dy;
    const d = Math.hypot(p.east - cx, p.north - cy);
    if (d < best.distance) best = { distance: d, along: walked + t * len };
    walked += len;
  }
  return best;
}

function pointAlong(line: Vec[], along: number) {
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const len = Math.hypot(b.east - a.east, b.north - a.north);
    if (len === 0) continue;
    if (walked + len >= along || i === line.length - 1) {
      const t = Math.max(0, Math.min(1, (along - walked) / len));
      return {
        east: a.east + t * (b.east - a.east),
        north: a.north + t * (b.north - a.north),
        dir: { east: (b.east - a.east) / len, north: (b.north - a.north) / len },
      };
    }
    walked += len;
  }
  return { ...line[0], dir: { east: 0, north: 1 } };
}

/**
 * Evenly spaced positions from the projection of `start` to the projection
 * of `end`. "left"/"right" is relative to walking from start to end.
 */
export function placeAlongPolyline(
  polyline: LatLng[],
  start: LatLng,
  end: LatLng,
  count: number,
  side: StreetSide,
  offsetMeters: number,
) {
  if (polyline.length < 2) throw new Error("The street polyline needs at least 2 points.");
  const origin = polyline[0];
  const line = polyline.map((p) => toLocalMeters(origin, p.lat, p.lng));
  const s = projectOnPolyline(line, toLocalMeters(origin, start.lat, start.lng));
  const e = projectOnPolyline(line, toLocalMeters(origin, end.lat, end.lng));
  const forward = e.along >= s.along ? 1 : -1;
  const offset = side === "center" ? 0 : side === "left" ? offsetMeters : -offsetMeters;

  const points = Array.from({ length: count }, (_, i) => {
    const along = count === 1 ? (s.along + e.along) / 2 : s.along + ((e.along - s.along) * i) / (count - 1);
    const p = pointAlong(line, along);
    // Left normal of the travel direction.
    const dirE = p.dir.east * forward;
    const dirN = p.dir.north * forward;
    return fromLocalMeters(origin, p.east - dirN * offset, p.north + dirE * offset);
  });

  return {
    points,
    startSnapMeters: s.distance,
    endSnapMeters: e.distance,
    spanMeters: Math.abs(e.along - s.along),
  };
}
