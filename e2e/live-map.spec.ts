import { test, expect } from "@playwright/test";

/**
 * Attendee (live) map chrome. The map must sit BETWEEN the top and bottom nav
 * bars — never under them — so points near an edge stay clickable and their
 * popups stay readable. The header shows the event's icon and name.
 */
test("live map: header shows the event, map sits between the nav bars", async ({ page }) => {
  await page.goto("/demo-team/lakeside-festival-2026");
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });

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
  await page.goto("/demo-team/lakeside-festival-2026");
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1000);

  // Open a point from the list (deterministic, unlike hunting markers).
  await page.getByRole("button", { name: /^Points \(\d+\)/ }).click();
  await page.getByRole("button", { name: /Beer Garden/ }).click();

  const popup = page.locator(".leaflet-popup");
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("Local craft beer");

  // The header bar is ~50px tall; the popup must clear it to be readable.
  const popupBox = (await popup.boundingBox())!;
  expect(popupBox.y).toBeGreaterThanOrEqual(50);

  // The popup tip points at the marker: its centre lines up with the marker's.
  const marker = page.locator(".leaflet-marker-icon").filter({ hasText: "🍺" }).first();
  const markerBox = (await marker.boundingBox())!;
  const tipBox = (await popup.locator(".leaflet-popup-tip-container").boundingBox())!;
  const markerCx = markerBox.x + markerBox.width / 2;
  const tipCx = tipBox.x + tipBox.width / 2;
  expect(Math.abs(tipCx - markerCx)).toBeLessThanOrEqual(8);
});
