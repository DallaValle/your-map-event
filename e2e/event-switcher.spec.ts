import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

/**
 * The dashboard operates on ONE selected event; the sidebar switcher changes
 * it. Regression: the Basic info form is uncontrolled and must remount when
 * the selection changes — otherwise it keeps showing the previous event.
 */
test("switching events updates the whole overview, form included", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "switcher is desktop-only UI");

  // The seed ships one event; add a second so the switcher has somewhere to go.
  const team = await prisma.team.findUnique({ where: { slug: "demo-team" } });
  test.skip(!team, "demo-team missing from database");
  const extra = await prisma.event.create({
    data: {
      teamId: team!.id,
      name: "Switcher Test Event",
      slug: `switcher-test-${Date.now()}`,
      centerName: "Test venue",
      centerLat: 47.36,
      centerLng: 8.54,
    },
  });

  try {
    await signIn(page);

    await page.getByRole("button", { name: "Switch event" }).click();
    const options = page.getByRole("option");
    await expect(options).toHaveCount(await prisma.event.count({ where: { teamId: team!.id } }));

    // Pick whichever option is not currently selected.
    const target = page.locator('[role="option"][aria-selected="false"]').first();
    const targetName = (await target.locator("span.font-medium").textContent())!.trim();
    await target.click();

    // Header and the (remounted) basic-info form both follow the selection.
    await expect(page.locator("h1")).toHaveText(targetName);
    await expect(page.locator('input[name="name"]')).toHaveValue(targetName);
  } finally {
    await prisma.event.delete({ where: { id: extra.id } });
    await prisma.$disconnect();
  }
});
