import { test, expect, type Page } from "@playwright/test";
import { openFirstMapEditor, signIn } from "./helpers";

/** Open the Lakeside event's map editor (known points, deterministic). */
async function openLakesideEditor(page: Page) {
  // Always start from the overview: the switcher on an editor page does not
  // show the event heading the rest of this helper waits for.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Switch event" }).click();
  await page.getByRole("option", { name: /Lakeside Festival 2026/ }).click();
  // Wait for the overview to switch before opening the editor, else the
  // Map-editor link still points at the previously-active event.
  await expect(page.getByRole("heading", { name: "Lakeside Festival 2026" })).toBeVisible();
  // Sidebar link (scoped - the overview also has a "Map editor" card).
  await page.locator("aside").getByRole("link", { name: "Map editor" }).click();
  await page.waitForURL("**/dashboard/events/**");
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function setLakesideLock(page: Page, locked: boolean) {
  await openLakesideEditor(page);
  const target = locked
    ? page.getByRole("button", { name: /Lock this view/i })
    : page.getByRole("button", { name: /Unlock view/i });
  if (await target.isVisible().catch(() => false)) {
    await target.click();
    await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 10_000 });
  }
}

function markerGap(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

test.describe("editor: points", () => {
  test("new-point sheet fits without scrolling", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");
    await openFirstMapEditor(page);

    await page.getByRole("button", { name: "+ Add points" }).click();
    await page.locator(".leaflet-container").click({ position: { x: 160, y: 300 } });
    await expect(page.getByRole("heading", { name: "New point" })).toBeVisible();

    const box = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h2")].find((h) =>
        h.textContent?.includes("New point"),
      );
      const el = heading?.closest<HTMLElement>("[class*='overflow-y-auto']") ?? null;
      return el ? { scroll: el.scrollHeight, client: el.clientHeight } : null;
    });
    expect(box).not.toBeNull();
    expect(box!.scroll).toBeLessThanOrEqual(box!.client + 1);
  });

  test("clicking a point in the editor does not pan the map", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");

    await signIn(page);
    await setLakesideLock(page, true);

    const marker = page.locator(".leaflet-marker-icon").filter({ hasText: "🍺" }).first();
    await expect(marker).toBeVisible();
    const before = (await marker.boundingBox())!;

    await marker.click();
    await expect(page.getByRole("heading", { name: "Edit point" })).toBeVisible();
    await page.waitForTimeout(800);

    const after = (await marker.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await setLakesideLock(page, false);
  });

  test("editor can zoom while the attendee view is locked", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");

    await signIn(page);
    await setLakesideLock(page, true);

    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    const zoomOut = page.getByRole("button", { name: "Zoom out" });
    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();
    await expect(zoomIn).toBeEnabled();

    const beer = page.locator(".leaflet-marker-icon").filter({ hasText: "🍺" }).first();
    const water = page.locator(".leaflet-marker-icon").filter({ hasText: "💧" }).first();
    const gapBefore = markerGap((await beer.boundingBox())!, (await water.boundingBox())!);

    await zoomIn.click();
    await page.waitForTimeout(800);

    const gapAfter = markerGap((await beer.boundingBox())!, (await water.boundingBox())!);
    expect(gapAfter).toBeGreaterThan(gapBefore + 8);

    // Give auto-save time to fire if zoom were incorrectly persisted.
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);

    await expect(page.getByRole("button", { name: /Unlock view/i })).toBeVisible();
    const gapRestored = markerGap(
      (await page.locator(".leaflet-marker-icon").filter({ hasText: "🍺" }).first().boundingBox())!,
      (await page.locator(".leaflet-marker-icon").filter({ hasText: "💧" }).first().boundingBox())!,
    );
    expect(Math.abs(gapRestored - gapBefore)).toBeLessThan(24);

    await setLakesideLock(page, false);
  });

  test("preview opens the live page in a new tab and keeps the editor map", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");

    await signIn(page);
    await openLakesideEditor(page);

    const preview = page.getByRole("link", { name: "Preview attendee view" });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("target", "_blank");

    const popupPromise = page.waitForEvent("popup");
    await preview.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup).toHaveURL(/\/demo-team\/lakeside-festival-2026/);

    await expect(page.getByRole("dialog", { name: "Attendee preview" })).toHaveCount(0);
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Event location" })).toBeVisible();
  });

  test("locked attendee map: selecting a point never moves it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");

    await signIn(page);
    await setLakesideLock(page, true);

    // The real attendee view (now locked). A reference marker's screen position
    // is the reliable movement detector - the map-pane transform is reset by
    // Leaflet after any auto-pan, so it can't tell.
    await page.goto("/demo-team/lakeside-festival-2026");
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1200);

    const ref = page.locator(".leaflet-marker-icon").filter({ hasText: "💧" }).first();
    const before = (await ref.boundingBox())!;

    // Click a point near the edge - the classic auto-pan-to-the-right trigger.
    await page.locator(".leaflet-marker-icon").filter({ hasText: "🍺" }).first().click();
    await page.waitForTimeout(1200);

    const after = (await ref.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);

    // Restore the demo to unlocked.
    await page.goto("/dashboard");
    await setLakesideLock(page, false);
  });
});
