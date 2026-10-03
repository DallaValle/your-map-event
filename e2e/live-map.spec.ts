import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { addCrowdedStands } from "./helpers";

const LIVE = "/demo-team/lakeside-festival-2026";
const HOME = { lat: 47.3548, lng: 8.5361, zoom: 17 };

async function openLiveMap(page: Page, path = LIVE) {
  await page.goto(path);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("live-map-view")).toHaveAttribute("data-zoom", /./);
}

async function readView(page: Page) {
  const el = page.getByTestId("live-map-view");
  return {
    lat: Number(await el.getAttribute("data-lat")),
    lng: Number(await el.getAttribute("data-lng")),
    zoom: Number(await el.getAttribute("data-zoom")),
    bearing: Number(await el.getAttribute("data-bearing")),
  };
}

async function patchLakeside(data: {
  boundsSWLat?: number | null;
  boundsSWLng?: number | null;
  boundsNELat?: number | null;
  boundsNELng?: number | null;
  bearing?: number;
  zoom?: number;
}) {
  const event = await prisma.event.findFirst({ where: { slug: "lakeside-festival-2026" } });
  if (!event) throw new Error("missing seeded Lakeside event");
  const prev = {
    boundsSWLat: event.boundsSWLat,
    boundsSWLng: event.boundsSWLng,
    boundsNELat: event.boundsNELat,
    boundsNELng: event.boundsNELng,
    bearing: event.bearing,
    zoom: event.zoom,
  };
  await prisma.event.update({ where: { id: event.id }, data });
  return { id: event.id, prev };
}

/** Wide box so fit-bounds would zoom out; recenter must restore zoom 17. */
const WIDE_BORDERS = {
  boundsSWLat: 47.34,
  boundsSWLng: 8.52,
  boundsNELat: 47.37,
  boundsNELng: 8.55,
};

/**
 * Attendee (live) map chrome. The map sits between the top and bottom nav bars,
 * reaching under the header only at its rounded corners, so points near an edge
 * stay clickable. The header shows the event's icon and name.
 */
test("live map: header shows the event, map sits between the nav bars", async ({ page }) => {
  await openLiveMap(page);

  // Header shows the event name (with the team as subtitle).
  const eventTitle = page.getByText("Lakeside Festival 2026", { exact: true });
  await expect(eventTitle).toBeVisible();

  // Bottom nav bar actions are present.
  const points = page.getByRole("button", { name: /^Points \(\d+\)/ });
  await expect(points).toBeVisible();
  await expect(page.getByRole("button", { name: "Recenter" })).toBeVisible();

  const mapBox = (await page.locator(".leaflet-container").boundingBox())!;
  const pointsBox = (await points.boundingBox())!;

  // The header is rounded and the map only tucks under its corners, never under the text.
  const header = page.getByTestId("live-map-header");
  await expect(header).toHaveCSS("border-bottom-left-radius", "24px");
  const headerBox = (await header.boundingBox())!;
  expect(mapBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 24 - 1);
  expect(mapBox.y + mapBox.height).toBeLessThanOrEqual(pointsBox.y + 4);
});

test("live map: picking a point from the list opens its details above the bottom bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  await openLiveMap(page);

  await page.getByRole("button", { name: /^Points \(\d+\)/ }).click();
  await page.getByRole("button", { name: /Beer Garden/ }).click();

  const sheet = page.getByRole("region", { name: "Point details" });
  await expect(sheet).toContainText("Local craft beer");
  await expect(sheet.getByRole("heading", { name: "Beer Garden" })).toBeVisible();

  // The sheet sits inside the map, and the chosen point is nudged above it.
  const mapBox = (await page.locator(".leaflet-container").boundingBox())!;
  const sheetBox = (await sheet.boundingBox())!;
  expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height + 1);
  const marker = page.locator('.leaflet-marker-icon[title="Beer Garden"]');
  await expect(marker.locator('[data-selected="true"]')).toBeVisible();
  await expect.poll(async () => {
    const box = (await marker.boundingBox())!;
    return box.y + box.height;
  }).toBeLessThanOrEqual(sheetBox.y);

  await page.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await expect(marker.locator('[data-selected="true"]')).toHaveCount(0);
});

test("live map: search finds points by name and flies to the match", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  await openLiveMap(page);

  await page.getByRole("button", { name: /^Points \(\d+\)/ }).click();
  const search = page.getByRole("searchbox", { name: "Search points" });
  const results = page.locator("ul li button");

  // Case insensitive, matches anywhere in the name.
  await search.fill("TOILETS");
  await expect(results).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Points of interest (2 of 10)" })).toBeVisible();
  await expect(results.nth(0)).toContainText("Toilets North");
  await expect(results.nth(1)).toContainText("Toilets South");

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(results).toHaveCount(10);

  await search.fill("pizza");
  await expect(results).toHaveCount(0);
  await expect(page.getByText("No points match “pizza”.")).toBeVisible();

  // Enter opens the first match.
  await search.fill("beer");
  await expect(results).toHaveCount(1);
  await search.press("Enter");
  await expect(search).toBeHidden();
  await expect(page.getByRole("region", { name: "Point details" })).toContainText("Local craft beer");

  // Reopening starts from the full list.
  await page.getByRole("button", { name: /^Points \(\d+\)/ }).click();
  await expect(page.getByRole("searchbox", { name: "Search points" })).toHaveValue("");
  await expect(results).toHaveCount(10);
});

test("live map: open details survive panning and location updates", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  // Every pan and GPS fix re-renders the map; the selection must not reset.
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: HOME.lat, longitude: HOME.lng });
  await openLiveMap(page);
  await expect(page.getByRole("button", { name: "Locate" })).toBeEnabled();

  const marker = page.locator('.leaflet-marker-icon[title="Beer Garden"]');
  await marker.click();
  const sheet = page.getByRole("region", { name: "Point details" });
  await expect(sheet).toContainText("Local craft beer");

  const mapBox = (await page.locator(".leaflet-container").boundingBox())!;
  await page.mouse.move(mapBox.x + 120, mapBox.y + 120);
  await page.mouse.down();
  await page.mouse.move(mapBox.x + 170, mapBox.y + 160, { steps: 8 });
  await page.mouse.up();
  for (let i = 1; i <= 3; i += 1) {
    await context.setGeolocation({ latitude: HOME.lat + i * 0.00005, longitude: HOME.lng });
    await page.waitForTimeout(250);
  }

  await expect(sheet).toContainText("Local craft beer");
  await expect(marker.locator('[data-selected="true"]')).toBeVisible();
});

test("live map: a focused marker opens with the keyboard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "keyboard flow");
  await openLiveMap(page);
  await page.locator('.leaflet-marker-icon[title="Beer Garden"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Point details" })).toContainText("Local craft beer");
});

test("live map: points on the same spot still show their numbers when zoomed in", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  const event = await prisma.event.findFirstOrThrow({ where: { slug: "lakeside-festival-2026" } });
  const spot = { lat: HOME.lat + 0.0006, lng: HOME.lng + 0.0006 };
  const twins = await prisma.$transaction(
    ["7. Twin Alpha", "8. Twin Bravo"].map((title) =>
      prisma.pointOfInterest.create({ data: { mapId: event.id, title, icon: "🍷", ...spot } }),
    ),
  );
  try {
    await openLiveMap(page, `${LIVE}?e2e=twins`);
    await page.getByRole("button", { name: /^Points \(\d+\)/ }).click();
    await page.locator("ul li button", { hasText: "Twin Alpha" }).click();
    await expect.poll(async () => (await readView(page)).zoom).toBe(19);
    await page.getByRole("button", { name: "Close" }).click();
    await page.locator(".leaflet-container").focus();
    await page.keyboard.press("Equal");
    await expect.poll(async () => (await readView(page)).zoom).toBe(20);
    await expect(page.locator('.leaflet-marker-icon[title="7 Twin Alpha"]')).toHaveText("7");
    await expect(page.locator('.leaflet-marker-icon[title="8 Twin Bravo"]')).toHaveText("8");
  } finally {
    await prisma.pointOfInterest.deleteMany({ where: { id: { in: twins.map((t) => t.id) } } });
  }
});

test("live map: a tap on a crowded row lists every stand under the finger", async ({ page }) => {
  const { id: eventId, prev } = await patchLakeside({
    boundsSWLat: null,
    boundsSWLng: null,
    boundsNELat: null,
    boundsNELng: null,
    zoom: 17,
  });
  const removeStands = await addCrowdedStands();
  try {
    await openLiveMap(page, `${LIVE}?e2e=crowded`);
    const bravo = page.locator('.leaflet-marker-icon[title="2 Bravo Wines"]');
    await expect(bravo).toBeVisible();

    // At the default zoom they are plain dots with no code.
    expect((await bravo.boundingBox())!.width).toBeLessThanOrEqual(12);
    await expect(bravo).toHaveText("");

    await bravo.click();
    const chooser = page.getByRole("region", { name: "Points here" });
    await expect(chooser.getByRole("heading")).toHaveText("3 points here");
    await expect(chooser.getByRole("button", { name: /Wines/ })).toHaveText([
      /Alpha Wines/,
      /Bravo Wines/,
      /Charlie Wines/,
    ]);

    await chooser.getByRole("button", { name: /Bravo Wines/ }).click();
    const sheet = page.getByRole("region", { name: "Point details" });
    await expect(sheet.getByRole("heading")).toHaveText("Bravo Wines");
    await expect(sheet.getByRole("button", { name: "Previous: 1. Alpha Wines" })).toBeVisible();
    await sheet.getByRole("button", { name: "Next: 3. Charlie Wines" }).click();
    await expect(sheet.getByRole("heading")).toHaveText("Charlie Wines");
    await expect(page.locator('.leaflet-marker-icon[title="3 Charlie Wines"] [data-selected="true"]')).toBeVisible();

    // Zooming past the tile server's last level separates the row and shows codes.
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: /^Points \(\d+\)/ }).click();
    // Listed by stand number, not by creation order (Charlie was added first).
    await expect(page.locator("ul li button").nth(0)).toContainText("1. Alpha Wines");
    await expect(page.locator("ul li button").nth(1)).toContainText("2. Bravo Wines");
    await expect(page.locator("ul li button").nth(2)).toContainText("3. Charlie Wines");
    await page.locator("ul li button", { hasText: "Alpha Wines" }).click();
    await expect.poll(async () => (await readView(page)).zoom).toBe(19);
    // Keyboard zoom keeps the row centred, unlike a double-click in a corner.
    await page.locator(".leaflet-container").focus();
    for (let zoom = 20; zoom <= 21; zoom += 1) {
      await page.keyboard.press("Equal");
      await expect.poll(async () => (await readView(page)).zoom).toBe(zoom);
    }
    await page.keyboard.press("Equal");
    await page.waitForTimeout(400);
    expect((await readView(page)).zoom).toBe(21);
    await expect(bravo).toHaveText("2");
    await bravo.click();
    await expect(sheet.getByRole("heading")).toHaveText("Bravo Wines");
  } finally {
    await removeStands();
    await prisma.event.update({ where: { id: eventId }, data: prev });
  }
});

test("live map: recenter restores the editor center, zoom and bearing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  const { id, prev } = await patchLakeside({ ...WIDE_BORDERS, bearing: 25, zoom: 17 });
  try {
    await openLiveMap(page, `${LIVE}?e2e=recenter`);
    await page.waitForTimeout(600);

    const home = await readView(page);
    expect(home.lat).toBeCloseTo(HOME.lat, 3);
    expect(home.lng).toBeCloseTo(HOME.lng, 3);
    expect(home.zoom).toBe(HOME.zoom);
    expect(home.bearing).toBeCloseTo(25, 0);

    const map = page.locator(".leaflet-container");
    const mapBox = (await map.boundingBox())!;
    await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(mapBox.x + mapBox.width / 2 + 140, mapBox.y + mapBox.height / 2 + 80, {
      steps: 12,
    });
    await page.mouse.up();
    await map.dblclick({ position: { x: 70, y: 70 } });
    await expect.poll(async () => (await readView(page)).zoom).toBeGreaterThan(HOME.zoom);

    const moved = await readView(page);
    expect(Math.abs(moved.lat - home.lat) + Math.abs(moved.lng - home.lng)).toBeGreaterThan(0.0002);

    await page.getByRole("button", { name: "Recenter" }).click();
    await expect.poll(async () => {
      const v = await readView(page);
      return Math.abs(v.lat - HOME.lat) + Math.abs(v.lng - HOME.lng);
    }).toBeLessThan(0.001);
    const restored = await readView(page);
    expect(restored.zoom).toBe(HOME.zoom);
    expect(restored.bearing).toBeCloseTo(25, 0);
  } finally {
    await prisma.event.update({ where: { id }, data: prev });
  }
});

test("live map: double-click zooms in one step inside the borders", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  const { id, prev } = await patchLakeside({ ...WIDE_BORDERS, zoom: 17 });
  try {
    await openLiveMap(page, `${LIVE}?e2e=dblclick`);
    await page.waitForTimeout(600);

    const before = await readView(page);
    expect(before.zoom).toBe(17);

    const map = page.locator(".leaflet-container");
    await map.dblclick({ position: { x: 70, y: 70 } });
    await expect.poll(async () => (await readView(page)).zoom).toBeGreaterThan(before.zoom);

    const after = await readView(page);
    expect(after.zoom).toBeCloseTo(before.zoom + 1, 0);
    expect(after.lat).toBeGreaterThan(WIDE_BORDERS.boundsSWLat);
    expect(after.lat).toBeLessThan(WIDE_BORDERS.boundsNELat);
    expect(after.lng).toBeGreaterThan(WIDE_BORDERS.boundsSWLng);
    expect(after.lng).toBeLessThan(WIDE_BORDERS.boundsNELng);
  } finally {
    await prisma.event.update({ where: { id }, data: prev });
  }
});

test.describe("live map: locate", () => {
  test.use({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ["geolocation"],
  });

  test("tells the attendee they are not on the map", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");
    const { id, prev } = await patchLakeside({ ...WIDE_BORDERS });
    try {
      await openLiveMap(page, `${LIVE}?e2e=locate`);
      const locate = page.getByRole("button", { name: "Locate" });
      await expect(locate).toBeEnabled({ timeout: 15_000 });

      const before = await readView(page);
      await locate.click();

      await expect(page.getByRole("status")).toHaveText("You are not on the map");
      const after = await readView(page);
      expect(after.lat).toBeCloseTo(before.lat, 4);
      expect(after.lng).toBeCloseTo(before.lng, 4);
      expect(after.lat).toBeCloseTo(HOME.lat, 2);
    } finally {
      await prisma.event.update({ where: { id }, data: prev });
    }
  });
});
