import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

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
 * Attendee (live) map chrome. The map must sit BETWEEN the top and bottom nav
 * bars — never under them — so points near an edge stay clickable and their
 * popups stay readable. The header shows the event's icon and name.
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
  const titleBox = (await eventTitle.boundingBox())!;
  const pointsBox = (await points.boundingBox())!;

  // Map starts below the header text and ends above the bottom bar (no overlap).
  expect(mapBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 4);
  expect(mapBox.y + mapBox.height).toBeLessThanOrEqual(pointsBox.y + 4);
});

test("live map: clicking a point opens a readable popup clear of the header", async ({ page }, testInfo) => {
  // Popup geometry is viewport-independent; run once. (On mobile the list→fly→
  // popup path is timing-flaky due to marker clustering.)
  test.skip(testInfo.project.name !== "desktop", "run once");
  await openLiveMap(page);
  await page.waitForTimeout(1000);

  // Open a point from the list (deterministic, unlike hunting markers).
  await page.getByRole("button", { name: /^Points \(\d+\)/ }).click();
  await page.getByRole("button", { name: /Beer Garden/ }).click();

  const popup = page.locator(".leaflet-popup");
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("Local craft beer");

  const mapBox = (await page.locator(".leaflet-container").boundingBox())!;
  const popupBox = (await popup.boundingBox())!;
  expect(popupBox.y).toBeGreaterThanOrEqual(mapBox.y);
  expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height + 1);
  expect(popupBox.x).toBeGreaterThanOrEqual(mapBox.x);
  expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(mapBox.x + mapBox.width + 1);

  // The popup tip points at the marker: its centre lines up with the marker's.
  const marker = page.locator(".leaflet-marker-icon").filter({ hasText: "🍺" }).first();
  const markerBox = (await marker.boundingBox())!;
  const tipBox = (await popup.locator(".leaflet-popup-tip-container").boundingBox())!;
  const markerCx = markerBox.x + markerBox.width / 2;
  const tipCx = tipBox.x + tipBox.width / 2;
  expect(Math.abs(tipCx - markerCx)).toBeLessThanOrEqual(8);
});

test("live map: popup of a point near the edge stays inside the map", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  // Borders disable auto-pan, so the bubble must be shifted, not the camera.
  const { id, prev } = await patchLakeside({ ...WIDE_BORDERS });
  try {
    await openLiveMap(page, `${LIVE}?e2e=edge-popup`);
    await page.waitForTimeout(800);

    const map = page.locator(".leaflet-container");
    const marker = page.locator(".leaflet-marker-icon").filter({ hasText: "🍺" }).first();
    await expect(marker).toBeVisible();

    await map.click({ position: { x: 200, y: 200 } });
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("ArrowDown");
    }
    await page.waitForTimeout(400);

    await marker.dispatchEvent("click");
    const popup = page.locator(".leaflet-popup");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("Local craft beer");

    const popupBox = (await popup.boundingBox())!;
    const mapAfter = (await map.boundingBox())!;
    expect(popupBox.x).toBeGreaterThanOrEqual(mapAfter.x - 1);
    expect(popupBox.y).toBeGreaterThanOrEqual(mapAfter.y - 1);
    expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(mapAfter.x + mapAfter.width + 1);
    expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(mapAfter.y + mapAfter.height + 1);
  } finally {
    await prisma.event.update({ where: { id }, data: prev });
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
