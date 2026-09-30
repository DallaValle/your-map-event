import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MAP_LAYOUT,
  MAP_LAYOUT_IDS,
  type MapLayoutId,
} from "@/components/map/map-layouts";

// Shared by the server actions and the MCP tools. Lives outside "use server"
// files because those may only export async actions.

/** First free slug for a team, trying base, base-2, base-3, … */
export async function uniqueMapSlug(teamId: string, base: string, excludeMapId?: string) {
  const candidate = base || "map";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? candidate : `${candidate}-${n}`;
    const clash = await prisma.event.findUnique({
      where: { teamId_slug: { teamId, slug } },
    });
    if (!clash || clash.id === excludeMapId) return slug;
  }
}

const optionalCoord = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(min).max(max).optional(),
  );

const mapLayoutSchema = z
  .string()
  .optional()
  .transform((v) => {
    if (v && (MAP_LAYOUT_IDS as string[]).includes(v)) return v as MapLayoutId;
    return DEFAULT_MAP_LAYOUT;
  });

export const mapViewSchema = z
  .object({
    centerName: z.string().trim().min(1, "Give the event location a name").max(80),
    centerLat: z.coerce.number().min(-90).max(90),
    centerLng: z.coerce.number().min(-180).max(180),
    zoom: z.coerce.number().int().min(3).max(19).default(17),
    mapLayout: mapLayoutSchema,
    bearing: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.number().optional(),
    ),
    boundsSWLat: optionalCoord(-90, 90),
    boundsSWLng: optionalCoord(-180, 180),
    boundsNELat: optionalCoord(-90, 90),
    boundsNELng: optionalCoord(-180, 180),
  })
  .refine(
    (data) => {
      const bounds = [data.boundsSWLat, data.boundsSWLng, data.boundsNELat, data.boundsNELng];
      const set = bounds.filter((v) => v !== undefined).length;
      return set === 0 || set === 4;
    },
    { message: "Map borders are incomplete — set them again or clear them." },
  )
  .transform((data) => {
    // Normalize so SW is really south-west of NE regardless of drag direction,
    // and store explicit nulls so clearing borders persists.
    const hasBounds = data.boundsSWLat !== undefined;
    return {
      ...data,
      // Leave bearing untouched when absent so updates don't reset rotation.
      bearing:
        data.bearing === undefined
          ? undefined
          : ((data.bearing % 360) + 360) % 360,
      boundsSWLat: hasBounds ? Math.min(data.boundsSWLat!, data.boundsNELat!) : null,
      boundsNELat: hasBounds ? Math.max(data.boundsSWLat!, data.boundsNELat!) : null,
      boundsSWLng: hasBounds ? Math.min(data.boundsSWLng!, data.boundsNELng!) : null,
      boundsNELng: hasBounds ? Math.max(data.boundsSWLng!, data.boundsNELng!) : null,
    };
  });

// Neutral defaults until the admin frames the venue in the map editor.
// (Zurich-ish center, same fallback the old create form used.)
export const NEW_EVENT_MAP_DEFAULTS = {
  centerLat: 47.3769,
  centerLng: 8.5417,
  centerName: "Set in map editor",
  zoom: 16,
  bearing: 0,
  mapLayout: DEFAULT_MAP_LAYOUT,
} as const;

export const poiSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(80),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.union([z.url(), z.literal("")]).nullish(),
  // Emoji for the marker; a couple of code points at most.
  icon: z.string().trim().max(8).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
