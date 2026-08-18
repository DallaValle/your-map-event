import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

/**
 * Organizer flow on Social campaign: share the published map (card + QR),
 * then move a post through draft → scheduled → done. No live social API.
 */
test.describe("social campaign", () => {
  test.beforeEach(async () => {
    const event = await prisma.event.findFirst({
      where: { slug: "lakeside-festival-2026" },
      include: { campaign: true },
    });
    if (event?.campaign) {
      await prisma.scheduledPost.deleteMany({ where: { campaignId: event.campaign.id } });
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("share assets and post planner for the published map", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signIn(page);
    await page.goto("/dashboard/social");

    await expect(page.getByRole("heading", { name: "Social campaign" })).toBeVisible();
    await expect(page.getByText("Attendees open your map here")).toBeVisible();
    await expect(
      page.locator("code").filter({ hasText: "demo-team/lakeside-festival-2026" }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /QR code/i }).click();
    await expect(page.getByAltText(/QR code for /i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Download PNG/i })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Poster QR" })).toBeVisible();
    await expect(page.getByAltText("Poster QR for Lakeside Festival 2026")).toBeVisible();
    await expect(page.getByRole("link", { name: "Download poster PNG" })).toBeVisible();

    const body = `Gates open at 16:00. Grab the map. ${Date.now()}`;
    await page.getByPlaceholder(/Gates open at 16:00/i).fill(body);
    await page.getByLabel("Schedule time").first().fill("2026-09-01T10:00");
    await page.getByRole("button", { name: "Save draft" }).click();

    const draft = page.locator('[data-status="draft"]');
    await expect(draft.getByText(body)).toBeVisible();

    await draft.getByRole("button", { name: "Schedule" }).click();
    const scheduled = page.locator('[data-status="scheduled"]');
    await expect(scheduled.getByText(body)).toBeVisible();
    await expect(draft.getByText(body)).toHaveCount(0);

    await scheduled.getByRole("button", { name: "Mark done" }).click();
    const done = page.locator('[data-status="done"]');
    await expect(done.getByText(body)).toBeVisible();
    await expect(scheduled.getByText(body)).toHaveCount(0);
  });
});
