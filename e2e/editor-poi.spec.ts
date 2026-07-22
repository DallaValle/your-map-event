import { test, expect, type Page } from "@playwright/test";
import { openFirstMapEditor, signIn } from "./helpers";

/** Open the Lakeside event's map editor (known points, deterministic). */
async function openLakesideEditor(page: Page) {
  await page.locator("aside").getByRole("button").first().click();
  await page.getByRole("option", { name: /Lakeside Festival 2026/ }).click();
  // Wait for the overview to switch before opening the editor, else the
  // Map-editor link still points at the previously-active event.
  await expect(page.getByRole("heading", { name: "Lakeside Festival 2026" })).toBeVisible();
  await page.getByRole("link", { name: /Map editor/i }).click();
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

  test("locked attendee map: selecting a point never moves it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");

    await signIn(page);
    await setLakesideLock(page, true);

    // The real attendee view (now locked). A reference marker's screen position
    // is the reliable movement detector — the map-pane transform is reset by
    // Leaflet after any auto-pan, so it can't tell.
    await page.goto("/demo-team/lakeside-festival-2026");
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1200);

    const ref = page.locator(".leaflet-marker-icon").filter({ hasText: "💧" }).first();
    const before = (await ref.boundingBox())!;

    // Click a point near the edge — the classic auto-pan-to-the-right trigger.
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
