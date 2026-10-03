import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

/**
 * Event logo is edited on the dashboard and shown in the attendee map top bar
 * (not the team logo).
 */
test("event logo field on dashboard; logo shows on live map bar", async ({ page }) => {
  // Same origin: an external image can disappear and leave a broken logo behind.
  const logoUrl = "http://localhost:3999/icons/icon-192.png";

  const event = await prisma.event.findFirst({
    where: { published: true },
    include: { team: true },
    orderBy: { updatedAt: "desc" },
  });
  test.skip(!event, "needs a published event");

  await prisma.event.update({
    where: { id: event!.id },
    data: { logoUrl },
  });

  try {
    await signIn(page);
    await page.goto("/dashboard");

    // Dashboard exposes an event-logo control (upload button or URL field).
    await expect(page.getByText("Event logo")).toBeVisible();

    await page.goto(`/${event!.team.slug}/${event!.slug}`);
    // Top bar uses the event logo, not the team logo, and it actually loads.
    const logo = page.locator(`img[src="${logoUrl}"]`).first();
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  } finally {
    // Later specs share this event: leave its logo as the seed had it.
    await prisma.event.update({ where: { id: event!.id }, data: { logoUrl: event!.logoUrl } });
    await prisma.$disconnect();
  }
});
