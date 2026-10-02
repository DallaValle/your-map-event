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

  const bar = page.getByTestId("live-map-header");
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

test("bar color picked on dashboard paints both live map bars with readable text", async ({ page }) => {
  const event = await prisma.event.findFirst({
    where: { published: true },
    include: { team: true },
    orderBy: { updatedAt: "desc" },
  });
  test.skip(!event, "needs a published event");
  await prisma.event.update({ where: { id: event!.id }, data: { barColor: null } });
  const live = `/${event!.team.slug}/${event!.slug}`;

  try {
    await signIn(page);
    await page.goto("/dashboard");
    await page.getByRole("radio", { name: "Own color" }).click();
    await page.getByLabel("Bar color", { exact: true }).fill("#c2410c");
    // The preview follows the pick before saving.
    await expect(page.getByTestId("bar-preview")).toHaveCSS("background-color", "rgb(194, 65, 12)");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved.");

    await page.goto(live);
    for (const id of ["live-map-header", "live-map-footer"]) {
      const bar = page.getByTestId(id);
      await expect(bar).toHaveCSS("background-color", "rgb(194, 65, 12)");
      await expect(bar).toHaveCSS("color", "rgb(255, 255, 255)");
    }
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#c2410c");

    // A light pick switches the text to dark.
    await prisma.event.update({ where: { id: event!.id }, data: { barColor: "#fde68a" } });
    await page.goto(live);
    await expect(page.getByTestId("live-map-header")).toHaveCSS("color", "rgb(12, 12, 12)");

    // Theme default brings the regular bars back.
    await page.goto("/dashboard");
    await page.getByRole("radio", { name: "Theme default" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved.");
    await page.goto(live);
    await expect(page.getByTestId("live-map-footer")).not.toHaveCSS("background-color", "rgb(253, 230, 138)");
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event!.id } })).barColor).toBeNull();
  } finally {
    await prisma.event.update({ where: { id: event!.id }, data: { barColor: null } });
  }
});
