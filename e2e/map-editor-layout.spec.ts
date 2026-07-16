import { test, expect } from "@playwright/test";
import { openFirstMapEditor } from "./helpers";

const PHONE_ASPECT = 390 / 844;

test.describe("map editor layout", () => {
  test("map card is phone-shaped and inside the viewport", async ({ page }) => {
    await openFirstMapEditor(page);

    const card = page.locator(".leaflet-container").locator("..");
    const box = await card.boundingBox();
    expect(box).not.toBeNull();

    // Phone aspect ratio, within a small tolerance.
    expect(box!.width / box!.height).toBeCloseTo(PHONE_ASPECT, 1);

    // Fully visible: never under the sticky header (56px) or off-screen.
    const viewport = page.viewportSize()!;
    expect(box!.y).toBeGreaterThanOrEqual(56);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  });

  test("map does not move while the form scrolls", async ({ page }, testInfo) => {
    await openFirstMapEditor(page);

    const card = page.locator(".leaflet-container").locator("..");
    const before = (await card.boundingBox())!;

    // Scroll over the form column (desktop: its own pane; mobile: the page).
    const nameInput = page.locator("input").first();
    await nameInput.hover();
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);

    const after = (await card.boundingBox())!;

    if (testInfo.project.name === "desktop") {
      // Fixed shell: the card must not move a single pixel.
      expect(after.y).toBe(before.y);
      expect(after.x).toBe(before.x);
    } else {
      // Mobile: sticky — the card may slide up to its sticky offset (68px)
      // but must never scroll out of view.
      expect(after.y).toBeGreaterThanOrEqual(60);
    }
  });

  test("desktop panes sit side by side with no page scroll", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only layout");
    await openFirstMapEditor(page);

    // The page body itself must not be scrollable — only the form pane is.
    const pageScrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight,
    );
    expect(pageScrollable).toBe(false);

    // Form and map top-aligned next to each other.
    const form = (await page.locator("input").first().boundingBox())!;
    const map = (await page.locator(".leaflet-container").boundingBox())!;
    expect(map.x).toBeGreaterThan(form.x + form.width);
  });

  test("add-points mode stays armed for multiple points", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");
    await openFirstMapEditor(page);

    await page.getByRole("button", { name: "+ Add points" }).click();
    await expect(page.getByText("Tap the map to add points")).toBeVisible();

    // First tap opens the create sheet with a draft position.
    await page.locator(".leaflet-container").click({ position: { x: 150, y: 300 } });
    await expect(page.getByRole("heading", { name: "New point" })).toBeVisible();

    // Dismissing the sheet keeps placement armed — the pill comes back.
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText("Tap the map to add points")).toBeVisible();
    await expect(page.getByRole("button", { name: "✓ Done adding" })).toBeVisible();

    // Done disarms.
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByText("Tap the map to add points")).toBeHidden();
  });
});
