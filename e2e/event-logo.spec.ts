import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

/**
 * Event logo is edited on the dashboard and shown in the attendee map top bar
 * (not the team logo).
 */
test("event logo field on dashboard; logo shows on live map bar", async ({ page }) => {
  const logoUrl =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/64px-React-icon.svg.png";

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

  await signIn(page);
  await page.goto("/dashboard");

  // Dashboard exposes an event-logo control (upload button or URL field).
  await expect(page.getByText("Event logo")).toBeVisible();

  await page.goto(`/${event!.team.slug}/${event!.slug}`);
  // Top bar uses the event logo, not the team logo.
  await expect(page.locator(`img[src="${logoUrl}"]`).first()).toBeVisible();
});
