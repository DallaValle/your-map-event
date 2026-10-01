import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { signIn } from "./helpers";

const LIVE = "/demo-team/lakeside-festival-2026";

async function lakeside() {
  return prisma.event.findFirstOrThrow({ where: { slug: "lakeside-festival-2026" } });
}

/** Put the demo back the way the seed left it: no categories, default look. */
async function resetMarkers() {
  const event = await lakeside();
  await prisma.poiCategory.deleteMany({ where: { eventId: event.id } });
  await prisma.pointOfInterest.updateMany({ where: { mapId: event.id }, data: { code: null, color: null } });
  await prisma.event.update({ where: { id: event.id }, data: { markerLabel: "auto", markerColor: null } });
}

async function openEditor(page: Page) {
  const event = await lakeside();
  await page.goto(`/dashboard/events/${event.id}`);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
  return page.getByRole("region", { name: "Markers" });
}

test.describe("map markers", () => {
  test.beforeEach(resetMarkers);
  test.afterAll(resetMarkers);

  test("categories start from the icons on the map and filter the live map", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");
    await signIn(page);
    const markers = await openEditor(page);

    // Related icons are grouped: the four service icons become one category.
    await expect(markers.getByRole("button", { name: /Services \(5\)/ })).toBeVisible();
    await markers.getByRole("button", { name: /Create all/ }).click();
    const rows = markers.getByRole("listitem");
    await expect(rows).toHaveCount(5);
    const names = markers.getByRole("textbox", { name: "Category name" });
    await expect
      .poll(() => names.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value)))
      .toEqual(["Services", "Drinks", "Stages", "Food", "Shops"]);

    // Renaming saves on its own, like the rest of the editor.
    const drinks = names.nth(1);
    await drinks.fill("Bars");
    await expect.poll(async () => (await prisma.poiCategory.findFirst({ where: { name: "Bars" } }))?.icon).toBeTruthy();

    // Attendees filter by category; the map keeps only those points.
    await page.goto(LIVE);
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^Points \(\d+\)/ }).click();
    const chips = page.getByRole("group", { name: "Categories" });
    await chips.getByRole("button", { name: /Services/ }).click();
    await expect(page.getByRole("heading", { name: "Points of interest (5 of 10)" })).toBeVisible();
    await page.getByRole("button", { name: "Collapse list" }).click();
    await expect(page.locator(".leaflet-marker-icon.poi-badge")).toHaveCount(5);

    await page.getByRole("button", { name: /Only .*Services/ }).click();
    await expect(page.locator(".leaflet-marker-icon.poi-badge")).toHaveCount(10);
  });

  test("numbers, own colors and the event look reach the attendee", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");
    await signIn(page);
    const markers = await openEditor(page);

    // Give one point a stand number and its own color.
    await page.locator("ul li button", { hasText: "Beer Garden" }).click();
    await page.getByRole("textbox", { name: "Number" }).fill("B1");
    await page.getByRole("button", { name: "Own color" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Edit point" })).toBeHidden();
    const saved = await prisma.pointOfInterest.findFirstOrThrow({ where: { title: "Beer Garden" } });
    expect(saved.code).toBe("B1");
    expect(saved.color).toMatch(/^#[0-9a-f]{6}$/i);

    // Numbers only: the stand shows its number, points without one are plain dots.
    await markers.getByRole("radio", { name: /Numbers/ }).click();
    await expect.poll(async () => (await lakeside()).markerLabel).toBe("number");

    await page.goto(LIVE);
    const beer = page.locator('.leaflet-marker-icon[title="B1 Beer Garden"]');
    await expect(beer).toHaveText("B1");
    await expect(page.locator('.leaflet-marker-icon[title="Main Stage"]')).toHaveText("");

    // Icons: every marker shows its emoji, the number moves to the title only.
    await openEditor(page);
    await markers.getByRole("radio", { name: /Icons/ }).click();
    await expect.poll(async () => (await lakeside()).markerLabel).toBe("icon");
    await page.goto(LIVE);
    await expect(beer).toHaveText("🍺");
    await expect(page.locator('.leaflet-marker-icon[title="Main Stage"]')).toHaveText("🎤");
  });
});
