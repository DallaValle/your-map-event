import { test, expect, type Page } from "@playwright/test";
import { openFirstMapEditor, signIn } from "./helpers";

/** Open the Lakeside event's map editor (known points, deterministic). */
async function openLakesideEditor(page: Page) {
  await page.getByRole("button", { name: "Switch event" }).click();
  await page.getByRole("option", { name: /Lakeside Festival 2026/ }).click();
  // Wait for the overview to switch before opening the editor, else the
  // Map-editor link still points at the previously-active event.
  await expect(page.getByRole("heading", { name: "Lakeside Festival 2026" })).toBeVisible();
  // Sidebar link (scoped — the overview also has a "Map editor" card).
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

  test("locked attendee map: selecting a point keeps details on screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once");

    await signIn(page);
    await setLakesideLock(page, true);

    await page.goto("/demo-team/lakeside-festival-2026");
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1200);

    await page.locator(".leaflet-marker-icon").filter({ hasText: "🍺" }).first().click();
    const popup = page.locator(".leaflet-popup");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("Local craft beer");

    const mapBox = (await page.locator(".leaflet-container").boundingBox())!;
    const popupBox = (await popup.boundingBox())!;
    expect(popupBox.x).toBeGreaterThanOrEqual(mapBox.x - 1);
    expect(popupBox.y).toBeGreaterThanOrEqual(mapBox.y - 1);
    expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(mapBox.x + mapBox.width + 1);
    expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height + 1);

    await page.goto("/dashboard");
    await setLakesideLock(page, false);
  });
});
