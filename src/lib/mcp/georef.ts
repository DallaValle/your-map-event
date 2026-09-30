/**
 * Photo georeferencing: fits a pixel to lat/lng transform from anchors
 * (points the AI located both on the photo and on the real map).
 *
 * Pure math, no I/O. Work happens in local meters around the anchor centroid
 * (equirectangular), which is accurate to centimeters at event scale.
 */

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

export interface Anchor {
  x: number;
  y: number;
  lat: number;
  lng: number;
  label?: string;
}

/**
 * east = a*u + b*v + c, north = d*u + e*v + f, with u = x and v = -y (image
 * y grows downward). Meters are relative to `origin`.
 */
export interface ImageTransform {
  kind: "similarity" | "affine";
  origin: { lat: number; lng: number };
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface AnchorResidual {
  label: string | null;
  meters: number;
}

export function toLocalMeters(origin: { lat: number; lng: number }, lat: number, lng: number) {
  return {
    east: (lng - origin.lng) * DEG * EARTH_RADIUS_M * Math.cos(origin.lat * DEG),
    north: (lat - origin.lat) * DEG * EARTH_RADIUS_M,
  };
}

export function fromLocalMeters(origin: { lat: number; lng: number }, east: number, north: number) {
  return {
    lat: origin.lat + north / EARTH_RADIUS_M / DEG,
    lng: origin.lng + east / (EARTH_RADIUS_M * Math.cos(origin.lat * DEG)) / DEG,
  };
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Solves a 3x3 system; null when (near) singular. */
function solve3(m: number[][], rhs: number[]): number[] | null {
  const a = m.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-9) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const factor = a[r][col] / a[col][col];
      for (let k = col; k < 4; k++) a[r][k] -= factor * a[col][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

/**
 * Least squares similarity (scale, rotation, translation). Exact for two
 * anchors, least squares for more.
 */
function fitSimilarity(
  pts: { u: number; v: number; east: number; north: number }[],
): Omit<ImageTransform, "origin"> | null {
  const n = pts.length;
  const mu = pts.reduce((s, p) => s + p.u, 0) / n;
  const mv = pts.reduce((s, p) => s + p.v, 0) / n;
  const me = pts.reduce((s, p) => s + p.east, 0) / n;
  const mn = pts.reduce((s, p) => s + p.north, 0) / n;
  let sxx = 0;
  let p = 0;
  let q = 0;
  for (const pt of pts) {
    const du = pt.u - mu;
    const dv = pt.v - mv;
    const de = pt.east - me;
    const dn = pt.north - mn;
    sxx += du * du + dv * dv;
    p += du * de + dv * dn;
    q += du * dn - dv * de;
  }
  if (sxx < 1e-9) return null;
  // Complex form: (east + i north) = (k1 + i k2)(u + i v) + t
  const k1 = p / sxx;
  const k2 = q / sxx;
  if (Math.hypot(k1, k2) < 1e-12) return null;
  return {
    kind: "similarity",
    a: k1,
    b: -k2,
    c: me - k1 * mu + k2 * mv,
    d: k2,
    e: k1,
    f: mn - k2 * mu - k1 * mv,
  };
}

function fitAffine(
  pts: { u: number; v: number; east: number; north: number }[],
): Omit<ImageTransform, "origin"> | null {
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const re = [0, 0, 0];
  const rn = [0, 0, 0];
  for (const pt of pts) {
    const row = [pt.u, pt.v, 1];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) m[i][j] += row[i] * row[j];
      re[i] += row[i] * pt.east;
      rn[i] += row[i] * pt.north;
    }
  }
  // Normalize so the singularity threshold is scale independent.
  const scale = Math.max(1, ...m.flat().map(Math.abs));
  const mn = m.map((row) => row.map((v) => v / scale));
  const east = solve3(mn, re.map((v) => v / scale));
  const north = solve3(mn, rn.map((v) => v / scale));
  if (!east || !north) return null;
  return { kind: "affine", a: east[0], b: east[1], c: east[2], d: north[0], e: north[1], f: north[2] };
}

// An affine fit has 6 unknowns: with 3 anchors it always matches exactly and
// hides a misread landmark, so it needs a 4th anchor to leave any residual.
const MIN_AFFINE_ANCHORS = 4;
// Flyers are drawn roughly to scale; beyond this stretch the fit is noise.
const MAX_AFFINE_ANISOTROPY = 1.5;

/** Rejects mirrored or strongly skewed fits, which come from bad anchors. */
function isPlausibleAffine(t: Omit<ImageTransform, "origin">) {
  const det = t.a * t.e - t.b * t.d;
  if (det <= 0) return false;
  // Singular values of [[a, b], [d, e]] from its Frobenius norm and determinant.
  const frob = t.a * t.a + t.b * t.b + t.d * t.d + t.e * t.e;
  const disc = Math.sqrt(Math.max(0, frob * frob - 4 * det * det));
  const s1 = Math.sqrt((frob + disc) / 2);
  const s2 = Math.sqrt(Math.max(0, (frob - disc) / 2));
  return s2 > 0 && s1 / s2 <= MAX_AFFINE_ANISOTROPY;
}

/**
 * Fits the transform, or throws with a message the model can act on.
 * Similarity (scale, rotation, translation) up to 3 anchors, so the third
 * one measures error; affine from 4 when it stays plausible.
 */
export function fitTransform(anchors: Anchor[]): ImageTransform {
  if (anchors.length < 2) throw new Error("At least 2 anchors are needed.");
  const origin = {
    lat: anchors.reduce((s, a) => s + a.lat, 0) / anchors.length,
    lng: anchors.reduce((s, a) => s + a.lng, 0) / anchors.length,
  };
  const pts = anchors.map((a) => ({ u: a.x, v: -a.y, ...toLocalMeters(origin, a.lat, a.lng) }));
  const similarity = fitSimilarity(pts);
  const affine = pts.length >= MIN_AFFINE_ANCHORS ? fitAffine(pts) : null;
  const fit = affine && isPlausibleAffine(affine) ? affine : similarity;
  if (!fit) {
    throw new Error(
      "Anchors are degenerate (same pixel or same place). Pick landmarks that are far apart on the photo.",
    );
  }
  return { ...fit, origin };
}

export function pixelToLatLng(t: ImageTransform, x: number, y: number) {
  const u = x;
  const v = -y;
  return fromLocalMeters(t.origin, t.a * u + t.b * v + t.c, t.d * u + t.e * v + t.f);
}

export function residuals(t: ImageTransform, anchors: Anchor[]): AnchorResidual[] {
  return anchors.map((a) => ({
    label: a.label ?? null,
    meters: distanceMeters(pixelToLatLng(t, a.x, a.y), a),
  }));
}

/**
 * Leave one out check: each anchor predicted from a fit of the others. Least
 * squares spreads one misread landmark over every residual; this does not.
 * Null with fewer than 3 anchors (nothing left to check against).
 */
export function crossCheck(anchors: Anchor[]): number[] | null {
  if (anchors.length < 3) return null;
  return anchors.map((a, i) => {
    try {
      const t = fitTransform(anchors.filter((_, j) => j !== i));
      return distanceMeters(pixelToLatLng(t, a.x, a.y), a);
    } catch {
      return Infinity;
    }
  });
}

/** Meters covered by one image pixel (geometric mean of both axes). */
export function metersPerPixel(t: ImageTransform) {
  return Math.sqrt(Math.abs(t.a * t.e - t.b * t.d));
}

/**
 * Compass direction the top of the photo points to, and the map `bearing`
 * that reproduces the photo orientation. leaflet-rotate turns the map
 * clockwise by `bearing`, so screen up points to compass (360 - bearing).
 */
export function photoOrientation(t: ImageTransform) {
  // Image up is (u, v) = (0, 1), which maps to (east, north) = (b, e).
  const up = (Math.atan2(t.b, t.e) / DEG + 360) % 360;
  // Wrap, round, then fold 360 back to 0 (359.96 rounds up to 360).
  const wrap = (deg: number) => {
    const r = round(((deg % 360) + 360) % 360, 1);
    return r === 360 ? 0 : r;
  };
  return {
    photoUpCompass: wrap(up),
    suggestedBearing: wrap(360 - up),
  };
}

export function round(value: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
