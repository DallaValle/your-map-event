import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

/**
 * The live map top bar subtitle is edited in the dashboard Basic info form
 * and falls back to the team name when cleared.
 */
test("event subtitle edited on dashboard shows on live map bar", async ({ page }) => {
  const event = await prisma.event.findFirst({
    where: { published: true },
    include: { team: true },
    orderBy: { updatedAt: "desc" },
  });
  test.skip(!event, "needs a published event");
  // Make it the dashboard's selected event.
  await prisma.event.update({ where: { id: event!.id }, data: { subtitle: null } });

  await signIn(page);
  await page.goto("/dashboard");

  const field = page.getByLabel("Subtitle");
  await expect(field).toHaveAttribute("placeholder", event!.team.name);
  await field.fill("Main square, 12 to 14 June");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  const bar = page.locator("div.z-\\[1000\\]").first();
  await page.goto(`/${event!.team.slug}/${event!.slug}`);
  await expect(bar.getByText("Main square, 12 to 14 June")).toBeVisible();

  // Clearing it restores the team name.
  await page.goto("/dashboard");
  await page.getByLabel("Subtitle").fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  await page.goto(`/${event!.team.slug}/${event!.slug}`);
  await expect(bar.getByText(event!.team.name, { exact: true })).toBeVisible();
});
