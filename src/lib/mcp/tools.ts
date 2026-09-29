import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/server";
import { ACTIVITY_TYPE_IDS } from "@/lib/activity";
import { MAP_LAYOUT_IDS, type MapLayoutId } from "@/components/map/map-layouts";
import type { McpContext } from "./auth";
import * as events from "./events";
import { findStreet, geocode } from "./osm";

// Single registry: the MCP route registers these and the dashboard renders
// them, so docs never drift from what the server accepts. Descriptions are
// written for the model: when to call, units, and what to do next.

const lat = z.number().min(-90).max(90).describe("Latitude, WGS84 degrees");
const lng = z.number().min(-180).max(180).describe("Longitude, WGS84 degrees");
const px = (axis: "x" | "y") =>
  z
    .number()
    .min(0)
    .describe(axis === "x" ? "Pixel column on the photo, 0 = left edge" : "Pixel row on the photo, 0 = top edge");
const wallClock = z
  .string()
  .describe("Venue local time as YYYY-MM-DDTHH:mm, no timezone (e.g. 2026-04-25T18:00)");
const eventId = z.string().min(1).describe("Event id from get_team or create_event");
const importId = z
  .string()
  .describe("Photo transform id from set_image_anchors. Required when positions use x/y pixels");
const title = z.string().trim().min(1).max(80).describe("Point title as the legend writes it, e.g. \"12. Tenuta San Gallo, Soligo (TV)\"");
const description = z.string().max(500).describe("Optional detail shown when the attendee opens the point");
const icon = z.string().max(8).describe("One emoji for the marker, e.g. 🍷 wine, 🍝 food, ℹ️ info, 🅿️ parking, 🚻 toilets");

const positionShape = {
  lat: lat.optional(),
  lng: lng.optional(),
  x: px("x").optional(),
  y: px("y").optional(),
};
const position = z
  .object(positionShape)
  .describe("Either lat + lng, or x + y pixels on the anchored photo");

export type Position = z.infer<typeof position>;

const emptyInput = z.object({});

const geocodeInput = z.object({
  query: z.string().trim().min(2).describe("Place or address, include the town, e.g. \"Piazza Indipendenza, San Giorgio di Piano\""),
  limit: z.number().int().min(1).max(10).default(5).describe("Maximum results"),
});

const findStreetInput = z.object({
  name: z.string().trim().min(2).describe("Street name exactly as in OpenStreetMap, e.g. \"Via Libertà\""),
  lat: lat.describe("Latitude of a point near the street (venue center is fine)"),
  lng: lng.describe("Longitude of a point near the street"),
  radiusMeters: z.number().min(50).max(5000).default(1500).describe("Search radius around lat/lng in meters"),
});

const createEventInput = z.object({
  name: z.string().trim().min(2).max(80).describe("Event name, e.g. \"Sangiorgio diVino 2026\""),
  description: description.optional(),
  venueName: z.string().trim().min(1).max(80).describe("Short venue label shown to attendees, e.g. \"Centro storico, San Giorgio di Piano\""),
  lat: lat.describe("Venue center latitude (from geocode)"),
  lng: lng.describe("Venue center longitude (from geocode)"),
  zoom: z.number().int().min(3).max(19).default(17).describe("Initial map zoom, 16 to 18 fits a town center"),
  mapLayout: z.enum(MAP_LAYOUT_IDS as [MapLayoutId, ...MapLayoutId[]]).optional().describe("Basemap style, default streets"),
  startTime: wallClock.optional().describe("Event opening, venue local time YYYY-MM-DDTHH:mm"),
  endTime: wallClock.optional().describe("Event closing, venue local time YYYY-MM-DDTHH:mm"),
});
export type CreateEventInput = z.infer<typeof createEventInput>;

const boundsInput = z
  .object({ swLat: lat, swLng: lng, neLat: lat, neLng: lng })
  .describe("Box attendees cannot pan out of; null clears it");

const updateEventInput = z.object({
  eventId,
  name: z.string().max(80).optional().describe("New event name"),
  description: description.nullable().optional(),
  centerName: z.string().max(80).optional().describe("Venue label"),
  centerLat: lat.optional(),
  centerLng: lng.optional(),
  zoom: z.number().int().min(3).max(19).optional().describe("Map zoom 3 to 19"),
  mapLayout: z.enum(MAP_LAYOUT_IDS as [MapLayoutId, ...MapLayoutId[]]).optional().describe("Basemap style"),
  bearing: z.number().min(-360).max(360).optional().describe("Map rotation in degrees; use suggestedBearing from set_image_anchors to match the photo"),
  bounds: boundsInput.nullable().optional(),
  startTime: wallClock.nullable().optional(),
  endTime: wallClock.nullable().optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventInput>;

const setImageAnchorsInput = z.object({
  eventId,
  imageWidth: z.number().int().positive().describe("Photo width in pixels, in the same pixel space as the anchors"),
  imageHeight: z.number().int().positive().describe("Photo height in pixels"),
  anchors: z
    .array(
      z.object({
        x: px("x"),
        y: px("y"),
        lat,
        lng,
        label: z.string().max(80).optional().describe("What the landmark is, e.g. \"Via Libertà x Via Roma\""),
      }),
    )
    .min(2)
    .max(20)
    .describe("2 to 20 landmarks located both on the photo and on the real map, spread far apart. 3+ lets the server measure error"),
});
export type SetImageAnchorsInput = z.infer<typeof setImageAnchorsInput>;

const pointInput = z.object({
  title,
  description: description.optional(),
  icon: icon.optional(),
  ...positionShape,
});

const addPointsInput = z.object({
  eventId,
  importId: importId.optional(),
  icon: icon.optional().describe("Default emoji for points that do not set their own"),
  points: z
    .array(pointInput)
    .min(1)
    .max(200)
    .describe("Up to 200 points. Each needs lat + lng, or x + y with importId. A point whose title already exists is moved, not duplicated"),
});
export type AddPointsInput = z.infer<typeof addPointsInput>;

const placeAlongStreetInput = z.object({
  eventId,
  importId: importId.optional(),
  streetName: z.string().optional().describe("Street to follow, looked up near start/end. Ignored when polyline is given"),
  polyline: z
    .array(z.tuple([lat, lng]))
    .min(2)
    .optional()
    .describe("[lat, lng] street geometry from find_street"),
  start: position.describe("Where the first item sits: lat + lng, or x + y on the photo"),
  end: position.describe("Where the last item sits: lat + lng, or x + y on the photo"),
  points: z
    .array(pointInput.pick({ title: true, description: true, icon: true }))
    .min(1)
    .max(200)
    .describe("Items in order from start to end, spread evenly by distance along the street"),
  icon: icon.optional().describe("Default emoji for points that do not set their own"),
  side: z.enum(["left", "right", "center"]).default("center").describe("Side of the street, seen walking from start to end"),
  offsetMeters: z.number().min(0).max(50).default(6).describe("Distance from the street centerline for left/right"),
});
export type PlaceAlongStreetInput = z.infer<typeof placeAlongStreetInput>;

const eventRefInput = z.object({ eventId });
export type EventRefInput = z.infer<typeof eventRefInput>;

const updatePointInput = z.object({
  eventId,
  poiId: z.string().min(1).describe("Point id from list_points"),
  importId: importId.optional(),
  title: title.optional(),
  description: description.optional(),
  icon: icon.optional(),
  ...positionShape,
});
export type UpdatePointInput = z.infer<typeof updatePointInput>;

const deletePointsInput = z.object({
  eventId,
  poiIds: z.array(z.string().min(1)).min(1).max(200).describe("Point ids from list_points"),
});
export type DeletePointsInput = z.infer<typeof deletePointsInput>;

const addActivitiesInput = z.object({
  eventId,
  activities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80).describe("Activity name, e.g. \"Gara del Salame\""),
        type: z.enum(ACTIVITY_TYPE_IDS).default("other").describe("Activity category"),
        startTime: wallClock.optional(),
        endTime: wallClock.optional().describe("Required with startTime; leave both out for an unscheduled act"),
        poiTitle: z.string().optional().describe("Title (or unique title prefix, e.g. \"GS\") of the point where it happens"),
      }),
    )
    .min(1)
    .max(100)
    .describe("Timed items from the legend. Identical retries are skipped"),
});
export type AddActivitiesInput = z.infer<typeof addActivitiesInput>;

// Registry

export interface McpTool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  annotations: ToolAnnotations;
  handler: (ctx: McpContext, input: z.output<S>) => Promise<unknown>;
}

const defineTool = <S extends z.ZodObject>(tool: McpTool<S>) => tool as unknown as McpTool;

const readOnly: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const lookup: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };
const write: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const upsert: ToolAnnotations = { ...write, idempotentHint: true };

export const MCP_TOOLS: McpTool[] = [
  defineTool({
    name: "get_team",
    title: "Get team",
    description:
      "Start here. Returns the team (name, public URL) and its events with ids, published state and point counts. Use an event id to keep working on an existing map.",
    inputSchema: emptyInput,
    annotations: readOnly,
    handler: (ctx) => events.getTeam(ctx),
  }),
  defineTool({
    name: "geocode",
    title: "Geocode a place",
    description:
      "Search OpenStreetMap (Nominatim) for a place or address. Returns up to `limit` matches with lat, lng, label and bounds. Confirm the right match with the organizer before creating the event. Rate limited to 1 request per second.",
    inputSchema: geocodeInput,
    annotations: lookup,
    handler: (_ctx, input) => geocode(input.query, input.limit).then((results) => ({ results })),
  }),
  defineTool({
    name: "find_street",
    title: "Find a street",
    description:
      "Fetch a named street near a point from OpenStreetMap (Overpass) and merge its segments into one polyline ([lat, lng] pairs) with its length in meters. Use it to locate anchor landmarks along a street, or pass the polyline to place_points_along_street.",
    inputSchema: findStreetInput,
    annotations: lookup,
    handler: async (_ctx, input) => {
      const street = await findStreet(input.name, { lat: input.lat, lng: input.lng }, input.radiusMeters);
      if (!street) {
        throw new events.ToolError(
          `No street named "${input.name}" within ${input.radiusMeters} m. Check the OSM spelling (accents included) or widen radiusMeters.`,
        );
      }
      return street;
    },
  }),
  defineTool({
    name: "create_event",
    title: "Create a draft event",
    description:
      "Create a new unpublished event for the team, centered on the venue. Returns eventId and the editor link. Publishing stays a manual step for the organizer in the dashboard.",
    inputSchema: createEventInput,
    annotations: write,
    handler: (ctx, input) => events.createEvent(ctx, input),
  }),
  defineTool({
    name: "update_event",
    title: "Update event",
    description:
      "Change event info and map view: name, description, opening window, venue center, zoom, basemap, rotation (bearing) and pan borders. Only the fields you pass change.",
    inputSchema: updateEventInput,
    annotations: upsert,
    handler: (ctx, input) => events.updateEvent(ctx, input),
  }),
  defineTool({
    name: "set_image_anchors",
    title: "Anchor the map photo",
    description:
      "Georeference the organizer's map photo. Give the image size and 2 or more landmarks with their pixel position on the photo and their real lat/lng (from geocode or find_street). Returns importId for pixel based placement, the error per anchor in meters, and suggestedBearing to rotate the map like the photo. Re-anchor when an error exceeds ~15 m.",
    inputSchema: setImageAnchorsInput,
    annotations: write,
    handler: (ctx, input) => events.setImageAnchors(ctx, input),
  }),
  defineTool({
    name: "add_points",
    title: "Add points",
    description:
      "Add up to 200 points of interest in one call. Each point uses lat/lng, or x/y pixels on the anchored photo together with importId. Titles are unique per event: sending an existing title moves and updates that point, so retries are safe.",
    inputSchema: addPointsInput,
    annotations: upsert,
    handler: (ctx, input) => events.addPoints(ctx, input),
  }),
  defineTool({
    name: "place_points_along_street",
    title: "Place a row along a street",
    description:
      "Place an ordered row of points (e.g. stalls 2 to 15) along a street between a start and an end position, evenly spaced by distance and snapped to the real street geometry. Positions are lat/lng or photo pixels with importId. Use side + offsetMeters for stalls lining one side.",
    inputSchema: placeAlongStreetInput,
    annotations: upsert,
    handler: (ctx, input) => events.placePointsAlongStreet(ctx, input),
  }),
  defineTool({
    name: "list_points",
    title: "List points",
    description: "List the event's points (id, title, icon, lat, lng) to review counts, spot mistakes and get ids for update_point or delete_points.",
    inputSchema: eventRefInput,
    annotations: readOnly,
    handler: (ctx, input) => events.listPoints(ctx, input),
  }),
  defineTool({
    name: "update_point",
    title: "Update a point",
    description: "Fix one point: title, description, icon, or position (lat/lng, or x/y with importId). Omitted fields stay as they are.",
    inputSchema: updatePointInput,
    annotations: upsert,
    handler: (ctx, input) => events.updatePoint(ctx, input),
  }),
  defineTool({
    name: "delete_points",
    title: "Delete points",
    description: "Delete points by id. Their activities stay on the schedule without a location.",
    inputSchema: deletePointsInput,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    handler: (ctx, input) => events.deletePoints(ctx, input),
  }),
  defineTool({
    name: "add_activities",
    title: "Add activities",
    description:
      "Add timed legend entries (e.g. \"Gara del Salame, Sunday 15:00\") to the event schedule, optionally pinned to a point by title. Times are venue local wall clock. Add points first so poiTitle can resolve.",
    inputSchema: addActivitiesInput,
    annotations: write,
    handler: (ctx, input) => events.addActivities(ctx, input),
  }),
];

// Dashboard view of the registry

export interface ToolParam {
  name: string;
  type: string;
  required: boolean;
  description: string | null;
}

type JsonSchema = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema | JsonSchema[];
  prefixItems?: JsonSchema[];
  enum?: unknown[];
  anyOf?: JsonSchema[];
};

function typeLabel(schema: JsonSchema): string {
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (schema.anyOf) return schema.anyOf.map(typeLabel).filter((t) => t !== "null").join(" | ") || "null";
  if (schema.type === "array") {
    if (schema.prefixItems) return `[${schema.prefixItems.map(typeLabel).join(", ")}][]`.replace(/^\[(.*)\]\[\]$/, "[$1]");
    const item = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    return `${item ? typeLabel(item) : "unknown"}[]`;
  }
  if (Array.isArray(schema.type)) return schema.type.filter((t) => t !== "null").join(" | ");
  return schema.type ?? "unknown";
}

/** Flattens one level of nesting: `points[].title`, `start.lat`. */
function paramsOf(schema: JsonSchema, prefix = "", parentRequired = true): ToolParam[] {
  const out: ToolParam[] = [];
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const name = prefix ? `${prefix}.${key}` : key;
    const required = parentRequired && (schema.required ?? []).includes(key);
    const inner = prop.anyOf?.find((s) => s.type === "object") ?? prop;
    const item = !Array.isArray(inner.items) ? inner.items : undefined;
    const isObject = inner.type === "object" && inner.properties;
    const isObjectArray = inner.type === "array" && item?.type === "object" && item.properties;
    out.push({
      name,
      type: isObject ? "object" : isObjectArray ? "object[]" : typeLabel(prop),
      required,
      description: prop.description ?? null,
    });
    if (!prefix && isObject) out.push(...paramsOf(inner, name, required));
    if (!prefix && isObjectArray) out.push(...paramsOf(item!, `${name}[]`, required));
  }
  return out;
}

export function describeTools() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    readOnly: tool.annotations.readOnlyHint === true,
    params: paramsOf(z.toJSONSchema(tool.inputSchema, { io: "input" }) as JsonSchema),
  }));
}
