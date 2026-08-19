import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

/**
 * Admins can switch the map basemap layout; the choice is persisted on the event.
 */
test("map layout can be changed and is saved", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");

  await signIn(page);
  // Sidebar "Map editor" (overview also has a Map editor card).
  await page.locator("aside").getByRole("link", { name: "Map editor" }).click();
  await page.waitForURL("**/dashboard/events/**");
  await expect(page.locator(".leaflet-container")).toBeVisible();

  const group = page.getByRole("radiogroup", { name: "Map layout" });
  await expect(group).toBeVisible();

  const satellite = group.getByRole("radio", { name: /satellite/i });
  await satellite.click();
  await expect(satellite).toHaveAttribute("aria-checked", "true");

  // Auto-save settles.
  await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 15_000 });

  // Confirm the phone map is still present after the tile layer swap.
  await expect(page.locator(".leaflet-container")).toBeVisible();

  const event = await prisma.event.findFirst({
    where: { mapLayout: "satellite" },
    orderBy: { updatedAt: "desc" },
  });
  expect(event).toBeTruthy();
});
