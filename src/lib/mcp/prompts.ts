import { z } from "zod";

export interface McpPrompt {
  name: string;
  title: string;
  description: string;
  argsSchema: z.ZodObject;
  render: (args: Record<string, string | undefined>) => string;
}

const createFromPhotoArgs = z.object({
  eventId: z.string().optional().describe("Existing event to fill instead of creating a new one"),
});

export const MCP_PROMPTS: McpPrompt[] = [
  {
    name: "create_event_from_map_photo",
    title: "Create an event map from a photo",
    description:
      "Guided chat: read the organizer's map flyer or photo, ask only what it does not say, then build the event map with all its points.",
    argsSchema: createFromPhotoArgs,
    render: ({ eventId }) => `You are helping an event organizer turn their printed event map (a photo, flyer or PDF they attach) into an interactive map on Your Map Event.

Work in this order and keep the chat short.

1. Read the photo carefully: title, dates and hours, town, legend, numbered items, lettered items, symbols (info, toilets, parking, first aid), street names and squares. Note the pixel size of the image you see; every x/y you send later must use that same pixel space.
2. Ask the organizer, one short question at a time, only what the photo does not answer: event name, days and opening hours, town, and ${eventId ? `confirm that we are filling the existing event ${eventId}` : "whether to create a new event or reuse one from get_team"}. Do not ask for anything you can read yourself.
3. ${eventId ? `Use event ${eventId} (check it with get_team).` : "Call geocode for the venue, show the organizer the match you picked and let them confirm it, then call create_event (it creates an unpublished draft)."}
4. Pick 3 or 4 clear landmarks that are far apart on the photo and not along one street: street junctions, gates, church squares, roundabouts. Locate them with geocode or find_street, then call set_image_anchors with their pixel x/y. Report quality and the largest checkMeters in one line. If quality is check_anchors, re-read or replace the anchor the note names and anchor again. Offer to apply suggestedBearing with update_event so the map is rotated like the photo.
5. Place the items:
   - Rows of numbered items along a street (stalls 2 to 15 on one side of a street): place_points_along_street with the first and last item positions, the ordered titles, and side + offsetMeters.
   - Isolated items: add_points with pixel x/y and the importId, in batches of up to 200.
   - Titles copy the legend, number first: "12. Tenuta San Gallo, Soligo (TV)". Letters too: "D. Stand gastronomico".
   - Icons by category: 🍷 wine, 🍝 food, 🍺 beer, ℹ️ info, 🚻 toilets, 🅿️ parking, ⛑️ first aid, 🎵 music, 📌 anything else.
6. Timed legend entries (for example "Gara del Salame, Sunday 15:00" on point GS): add_activities with venue local times and poiTitle.
7. Finish with list_points. Summarize counts per category, mention anything you could not place, and give the editor link so the organizer can check, drag points and publish from the dashboard. Never claim the map is published: publishing is their click.

Tools are idempotent by title, so if a call fails midway you can resend the same batch.`,
  },
];
