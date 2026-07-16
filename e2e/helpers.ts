import { expect, type Page } from "@playwright/test";

/** Signs in through the real form, exactly like a user would. */
export async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.locator('input[type="email"]').fill("admin@test.com");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

/** Opens the first map of the seeded team in the editor. */
export async function openFirstMapEditor(page: Page) {
  await signIn(page);
  const mapLink = page.locator('a[href^="/dashboard/maps/"]:not([href$="/new"])').first();
  await expect(mapLink).toBeVisible();
  await mapLink.click();
  await page.waitForURL("**/dashboard/maps/**");
  // The Leaflet canvas mounts client-side — wait for real tiles.
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({
    timeout: 20_000,
  });
}
