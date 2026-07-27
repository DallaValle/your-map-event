import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

/**
 * Sidebar selection + empty dashboard layout.
 * Regression: /dashboard/events/new used to highlight "Map editor".
 */
test.describe("console nav + empty event state", () => {
  test("Pricing is selected on new event; Map editor is not", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar labels are desktop-only");

    await signIn(page);
    await page.goto("/dashboard/events/new");

    const nav = page.getByRole("navigation", { name: "Dashboard" });
    const pricing = nav.getByRole("link", { name: "Pricing" });
    const mapEditor = nav.getByRole("link", { name: "Map editor" });

    await expect(pricing).toBeVisible();
    await expect(pricing).toHaveAttribute("aria-current", "page");
    // Map editor may still exist when an event is selected, but must not be current.
    if (await mapEditor.count()) {
      await expect(mapEditor).not.toHaveAttribute("aria-current", "page");
    }
  });

  test("empty dashboard is centered when no events exist", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "layout check is desktop-focused");

    const team = await prisma.team.findUnique({ where: { slug: "demo-team" } });
    test.skip(!team, "demo-team missing from database");
    await prisma.event.deleteMany({ where: { teamId: team!.id } });

    try {
      await signIn(page);
      await page.goto("/dashboard");

      // Sidebar empty card + main empty heading.
      await expect(page.locator("aside").getByText("No event yet")).toBeVisible();
      const heading = page.getByRole("heading", { name: "No event yet" });
      await expect(heading).toBeVisible();

      // Content pane centers the empty card (not stuck top-left of the main area).
      const main = page.getByRole("main");
      const card = main.locator(".max-w-md").filter({ has: heading });
      const mainBox = await main.boundingBox();
      const cardBox = await card.boundingBox();
      expect(mainBox).toBeTruthy();
      expect(cardBox).toBeTruthy();
      if (mainBox && cardBox) {
        const mainCenterX = mainBox.x + mainBox.width / 2;
        const cardCenterX = cardBox.x + cardBox.width / 2;
        expect(Math.abs(mainCenterX - cardCenterX)).toBeLessThan(24);

        const mainCenterY = mainBox.y + mainBox.height / 2;
        const cardCenterY = cardBox.y + cardBox.height / 2;
        expect(Math.abs(mainCenterY - cardCenterY)).toBeLessThan(80);
      }

      // Pricing is the create path; Map editor is hidden with no active event.
      const nav = page.getByRole("navigation", { name: "Dashboard" });
      await expect(nav.getByRole("link", { name: "Pricing" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Map editor" })).toHaveCount(0);
    } finally {
      // Restore Lakeside Festival + POIs for sibling suites.
      execSync("npx prisma db seed", { stdio: "inherit" });
      await prisma.$disconnect();
    }
  });
});
