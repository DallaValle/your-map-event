import { expect, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

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

/**
 * Three wine stands 4.5 m apart on the Lakeside map, like a street of stalls:
 * pins could never separate them. Returns a cleanup that removes them.
 */
export async function addCrowdedStands() {
  const event = await prisma.event.findFirstOrThrow({ where: { slug: "lakeside-festival-2026" } });
  const base = { lat: event.centerLat + 0.0005, lng: event.centerLng - 0.0005 };
  const stands = await prisma.$transaction(
    ["3. Charlie Wines", "1. Alpha Wines", "2. Bravo Wines"].map((title) =>
      prisma.pointOfInterest.create({
        data: {
          mapId: event.id,
          title,
          icon: "🍷",
          description: "Banco vini.",
          lat: base.lat - Number(title[0]) * 0.00004,
          lng: base.lng,
        },
      }),
    ),
  );
  return () => prisma.pointOfInterest.deleteMany({ where: { id: { in: stands.map((s) => s.id) } } });
}
