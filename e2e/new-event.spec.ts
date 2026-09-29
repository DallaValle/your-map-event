import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

// The newest event becomes the dashboard default, so a leftover draft would
// hijack the seeded event in later specs (schedule, social).
test.afterAll(async () => {
  await prisma.event.deleteMany({ where: { name: { startsWith: "E2E Event " } } });
  await prisma.$disconnect();
});

/**
 * New-event funnel: mock pay → name only → land on dashboard overview with
 * the new event selected.
 */
test("pay, name an event, land on the dashboard overview", async ({ page }) => {
  await signIn(page);

  await page.goto("/dashboard/events/new");
  await expect(page.getByRole("heading", { name: "New event" })).toBeVisible();

  // Step 1: mock checkout.
  await page.getByRole("button", { name: /pay .* and continue/i }).click();
  await expect(page.getByText("Payment confirmed")).toBeVisible();

  // Step 2: name only — no venue/map picker on create.
  const uniqueName = `E2E Event ${Date.now()}`;
  await page.locator('input[name="name"]').fill(uniqueName);
  await page.getByRole("button", { name: /create event/i }).click();

  await page.waitForURL("**/dashboard");
  // Overview shows the new event as the active selection.
  await expect(page.locator("h1")).toHaveText(uniqueName);
  // Main content CTA (sidebar also has a "Map editor" link).
  await expect(
    page.getByRole("main").getByRole("link", { name: /map editor/i }),
  ).toBeVisible();
});
