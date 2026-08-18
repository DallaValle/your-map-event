import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

const E2E_PREFIX = "E2E ";

/**
 * Organizer composes a live announcement; the header bell shows unread;
 * attendees see the latest one on the public map.
 */
test("send announcement, bell badge, attendee map banner", async ({ page }) => {
  const team = await prisma.team.findUnique({ where: { slug: "demo-team" } });
  test.skip(!team, "demo-team missing from database");

  const event = await prisma.event.findFirst({
    where: { teamId: team!.id, slug: "lakeside-festival-2026" },
  });
  test.skip(!event, "demo event missing from database");

  await prisma.notification.deleteMany({
    where: { eventId: event!.id, title: { startsWith: E2E_PREFIX } },
  });

  await prisma.notification.create({
    data: {
      eventId: event!.id,
      title: `${E2E_PREFIX}weather alert`,
      body: "Light rain after 18:00. Stages stay open.",
      authorName: "Stage manager",
    },
  });

  try {
    await signIn(page);

    const bell = page.getByRole("link", { name: /Notifications/ });
    await expect(bell).toHaveAttribute("aria-label", "Notifications, 1 unread");
    await expect(page.getByTestId("notif-badge")).toHaveText("1");

    await bell.click();
    await page.waitForURL("**/dashboard/notifications");
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: `${E2E_PREFIX}weather alert` })).toBeVisible();

    await expect(page.getByTestId("notif-badge")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();

    await page.locator('input[name="title"]').fill(`${E2E_PREFIX}gates closing in 10 minutes`);
    await page.locator('textarea[name="body"]').fill("Main entrance closes at 23:00.");
    await page.getByRole("button", { name: "Send announcement" }).click();

    await expect(page.getByRole("status")).toContainText("Sent to the live map");
    await expect(page.getByRole("heading", { name: `${E2E_PREFIX}gates closing in 10 minutes` })).toBeVisible();
    await expect(page.getByText("Main entrance closes at 23:00.")).toBeVisible();
    await expect(page.getByTestId("notif-badge")).toHaveCount(0);

    await page.goto("/demo-team/lakeside-festival-2026");
    const banner = page.getByRole("status", { name: "Live announcement" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(`${E2E_PREFIX}gates closing in 10 minutes`);
    await expect(banner).toContainText("Main entrance closes at 23:00.");
  } finally {
    await prisma.notification.deleteMany({
      where: { eventId: event!.id, title: { startsWith: E2E_PREFIX } },
    });
    await prisma.$disconnect();
  }
});
