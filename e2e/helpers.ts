import { expect, type Page } from "@playwright/test";

/** Signs in through the real form, exactly like a user would. */
export async function signIn(
  page: Page,
  email = "admin@test.com",
  password = "password",
) {
  await page.goto("/sign-in");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

export async function signInViewer(page: Page) {
  await signIn(page, "view@test.com");
}

/** Opens the first map of the seeded team in the editor. */
export async function openFirstMapEditor(page: Page) {
  await signIn(page);
  const mapLink = page.locator('a[href^="/dashboard/events/"]:not([href$="/new"])').first();
  await expect(mapLink).toBeVisible();
  await mapLink.click();
  await page.waitForURL("**/dashboard/events/**");
  // The Leaflet canvas mounts client-side — wait for real tiles.
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({
    timeout: 20_000,
  });
}
