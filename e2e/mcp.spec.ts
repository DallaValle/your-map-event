import { test, expect, type APIRequestContext } from "@playwright/test";
import { signIn, signInViewer } from "./helpers";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/lib/mcp/auth";

/**
 * AI assistant: an admin creates a team token on the dashboard, an MCP client
 * builds a draft event from anchored photo pixels, and the points show up in
 * the map editor. Geocode and Overpass stay out (external, rate limited).
 */

const ENDPOINT = "/api/mcp/mcp";

type RpcResult = { result?: Record<string, unknown>; error?: { message: string } };

async function rpc(request: APIRequestContext, token: string, method: string, params: object = {}) {
  const res = await request.post(ENDPOINT, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "mcp-protocol-version": "2025-06-18",
    },
    data: { jsonrpc: "2.0", id: 1, method, params },
  });
  const body = await res.text();
  // Streamable HTTP answers either plain JSON or one SSE `data:` frame.
  const json = body.startsWith("{") ? body : body.split("\n").find((l) => l.startsWith("data: "))?.slice(6);
  return { status: res.status(), payload: json ? (JSON.parse(json) as RpcResult) : null };
}

async function callTool(request: APIRequestContext, token: string, name: string, args: object) {
  const { status, payload } = await rpc(request, token, "tools/call", { name, arguments: args });
  expect(status).toBe(200);
  const result = payload!.result as { isError?: boolean; content: { text: string }[] };
  return { isError: !!result.isError, data: JSON.parse(result.content[0].text) };
}

// Synthetic north up photo, 0.5 m per pixel: 800 px east = 400 m, 600 px south = 300 m.
const ANCHORS = [
  { x: 100, y: 100, lat: 44.648, lng: 11.374, label: "NW junction" },
  { x: 900, y: 100, lat: 44.648, lng: 11.379057, label: "NE gate" },
  { x: 100, y: 700, lat: 44.645302, lng: 11.374, label: "SW square" },
];
// Pixel (500, 400) sits 200 m east and 150 m south of the NW anchor.
const EXPECTED = { lat: 44.646651, lng: 11.376529 };

test.describe("AI assistant (MCP)", () => {
  const createdEventIds: string[] = [];
  let otherTeamId: string | null = null;

  test.afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.mcpToken.deleteMany({ where: { name: { startsWith: "e2e " } } });
    if (otherTeamId) await prisma.team.delete({ where: { id: otherTeamId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("admin connects a client that builds a map from photo pixels", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar labels are desktop-only");

    await signIn(page);
    await page.locator("aside").getByRole("link", { name: "AI assistant" }).click();
    await page.waitForURL("**/dashboard/ai");
    await expect(page.getByRole("heading", { name: "AI assistant", level: 1 })).toBeVisible();
    await expect(page.getByText(/\/api\/mcp\/mcp$/).first()).toBeVisible();
    // The literal <token> placeholder must survive message formatting.
    await expect(page.getByText("in place of <token>.", { exact: false })).toBeVisible();

    // Token is shown once, then only its prefix remains.
    const tokenName = `e2e ${Date.now()}`;
    await page.getByLabel("Token name").fill(tokenName);
    await page.getByRole("button", { name: "Create token" }).click();
    const tokenCode = page.getByTestId("new-mcp-token");
    await expect(tokenCode).toHaveText(/^yme_[A-Za-z0-9_-]{43}$/);
    const token = (await tokenCode.textContent())!;
    const tokens = page.getByRole("list", { name: "Active tokens" });
    await expect(tokens.getByText(tokenName)).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("new-mcp-token")).toHaveCount(0);
    await expect(tokens.getByText(tokenName)).toBeVisible();
    await expect(tokens.getByText(`${token.slice(0, 12)}…`)).toBeVisible();

    // Tool docs come from the registry, parameters included.
    await expect(page.getByText("create_event_from_map_photo")).toBeVisible();
    const addPoints = page.locator('details[data-tool="add_points"]');
    await addPoints.locator("summary").click();
    await expect(addPoints.getByRole("cell", { name: "points[].x" })).toBeVisible();
    await expect(addPoints.getByRole("cell", { name: /^importId/ })).toBeVisible();

    // MCP handshake.
    const init = await rpc(request, token, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "e2e", version: "1" },
    });
    expect(init.status).toBe(200);
    expect((init.payload!.result!.serverInfo as { name: string }).name).toBe("your-map-event");

    const list = await rpc(request, token, "tools/list");
    const names = (list.payload!.result!.tools as { name: string }[]).map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "get_team",
        "geocode",
        "find_street",
        "create_event",
        "update_event",
        "set_image_anchors",
        "add_points",
        "place_points_along_street",
        "list_points",
        "update_point",
        "delete_points",
        "add_activities",
      ]),
    );

    // Build a draft from photo pixels.
    const created = await callTool(request, token, "create_event", {
      name: `MCP import ${Date.now()}`,
      venueName: "San Giorgio di Piano",
      lat: 44.6468,
      lng: 11.3754,
      startTime: "2026-04-25T16:00",
      endTime: "2026-04-26T23:00",
    });
    expect(created.isError).toBe(false);
    expect(created.data.published).toBe(false);
    const eventId: string = created.data.eventId;
    createdEventIds.push(eventId);

    const anchored = await callTool(request, token, "set_image_anchors", {
      eventId,
      imageWidth: 1000,
      imageHeight: 800,
      anchors: ANCHORS,
    });
    expect(anchored.isError).toBe(false);
    expect(anchored.data.metersPerPixel).toBeCloseTo(0.5, 2);
    expect(anchored.data.maxResidualMeters).toBeLessThan(1);
    expect(anchored.data.suggestedBearing).toBe(0);
    expect(anchored.data.quality).toBe("good");

    // A fourth landmark misread by ~30 m is named instead of hiding in the fit.
    const misread = await callTool(request, token, "set_image_anchors", {
      eventId,
      imageWidth: 1000,
      imageHeight: 800,
      anchors: [...ANCHORS, { x: 900, y: 700, lat: 44.645302, lng: 11.379057 + 0.0004, label: "SE misread" }],
    });
    expect(misread.data.quality).toBe("check_anchors");
    expect(misread.data.maxCheckMeters).toBeGreaterThan(15);
    expect(misread.data.note).toContain("SE misread");

    const added = await callTool(request, token, "add_points", {
      eventId,
      importId: anchored.data.importId,
      points: [
        { title: "D. Stand gastronomico", icon: "🍝", category: "Ristoro", x: 500, y: 400 },
        { title: "1. Info point", icon: "ℹ️", category: "Servizi", description: "Maps and wristbands", x: 100, y: 100 },
      ],
    });
    expect(added.isError).toBe(false);
    expect(added.data.created).toBe(2);
    const stand = added.data.points[0];
    // 1e-5 degrees is about 1 m.
    expect(Math.abs(stand.lat - EXPECTED.lat)).toBeLessThan(1e-5);
    expect(Math.abs(stand.lng - EXPECTED.lng)).toBeLessThan(1e-5);

    // Retrying the batch moves points instead of duplicating them, and a
    // move without description or icon keeps the ones already saved.
    const retried = await callTool(request, token, "add_points", {
      eventId,
      importId: anchored.data.importId,
      points: [{ title: "1. Info point", x: 120, y: 100 }],
    });
    expect(retried.data).toMatchObject({ created: 0, updated: 1 });
    expect(retried.data.points[0].icon).toBe("ℹ️");

    // Parallel batches with the same titles must not both insert.
    const batch = {
      eventId,
      points: [
        { title: "Z. Parallel stand", lat: 44.6466, lng: 11.3752 },
        { title: "Y. Parallel stand", lat: 44.6467, lng: 11.3753 },
      ],
    };
    await Promise.all([
      callTool(request, token, "add_points", batch),
      callTool(request, token, "add_points", batch),
    ]);
    const listed = await callTool(request, token, "list_points", { eventId });
    expect(listed.data.count).toBe(4);
    const info = listed.data.points.find((p: { title: string }) => p.title === "1. Info point");
    expect(info.description).toBe("Maps and wristbands");
    expect(info.category).toBe("Servizi");

    // Legend names become categories once, with the icon of their first point.
    const categories = await prisma.poiCategory.findMany({ where: { eventId }, orderBy: { position: "asc" } });
    expect(categories.map((c) => [c.name, c.icon])).toEqual([
      ["Ristoro", "🍝"],
      ["Servizi", "ℹ️"],
    ]);
    const styled = await callTool(request, token, "update_event", { eventId, markerLabel: "number" });
    expect(styled.data.markerLabel).toBe("number");
    const parallelIds = listed.data.points
      .filter((p: { title: string }) => p.title.endsWith("Parallel stand"))
      .map((p: { id: string }) => p.id);
    await callTool(request, token, "delete_points", { eventId, poiIds: parallelIds });

    // The organizer reviews the result in the map editor.
    await page.goto(new URL(created.data.editorUrl).pathname);
    await expect(page.getByRole("heading", { name: "Points of interest (2)" })).toBeVisible();
    await expect(page.getByText("D. Stand gastronomico")).toBeVisible();
    await expect(page.getByText("1. Info point")).toBeVisible();

    // A token of another team cannot touch this event.
    const other = await prisma.team.create({
      data: { orgId: `e2e-other-${Date.now()}`, slug: `e2e-other-${Date.now()}`, name: "E2E other team" },
    });
    otherTeamId = other.id;
    const foreign = generateToken();
    await prisma.mcpToken.create({
      data: {
        teamId: other.id,
        name: "e2e foreign",
        tokenHash: foreign.tokenHash,
        prefix: foreign.prefix,
        createdByEmail: "e2e@test.com",
      },
    });
    const denied = await callTool(request, foreign.raw, "list_points", { eventId });
    expect(denied.isError).toBe(true);
    expect(denied.data.error).toMatch(/not found for this team/);
    const foreignUpdate = await callTool(request, foreign.raw, "update_point", {
      eventId,
      poiId: stand.id,
      title: "Hijacked",
    });
    expect(foreignUpdate.isError).toBe(true);
    const foreignDelete = await callTool(request, foreign.raw, "delete_points", { eventId, poiIds: [stand.id] });
    expect(foreignDelete.isError).toBe(true);
    expect(await prisma.pointOfInterest.findUnique({ where: { id: stand.id } })).toMatchObject({
      title: "D. Stand gastronomico",
    });
    const foreignTeam = await callTool(request, foreign.raw, "get_team", {});
    expect(foreignTeam.data.events).toEqual([]);

    // Revoked tokens get a 401 on the next call.
    await page.goto("/dashboard/ai");
    page.once("dialog", (dialog) => dialog.accept());
    await tokens.getByRole("button", { name: `Revoke ${tokenName}` }).click();
    await expect(tokens.getByText(tokenName)).toHaveCount(0);
    const revoked = await rpc(request, token, "tools/list");
    expect(revoked.status).toBe(401);

    const anonymous = await request.post(ENDPOINT, { data: {} });
    expect(anonymous.status()).toBe(401);
  });

  test("viewers see how to connect but cannot manage tokens", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar labels are desktop-only");

    await signInViewer(page);
    await page.locator("aside").getByRole("link", { name: "AI assistant" }).click();
    await page.waitForURL("**/dashboard/ai");
    await expect(page.getByRole("heading", { name: "Connect" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tools" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Access tokens" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create token" })).toHaveCount(0);
  });
});
