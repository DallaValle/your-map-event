import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * The dashboard operates on ONE selected event; the sidebar switcher changes
 * it. Regression: the Basic info form is uncontrolled and must remount when
 * the selection changes — otherwise it keeps showing the previous event.
 */
test("switching events updates the whole overview, form included", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "switcher is desktop-only UI");

  await signIn(page);

  // Open the switcher; need at least two events to switch between.
  await page.locator("aside").getByRole("button").first().click();
  const options = page.getByRole("option");
  const count = await options.count();
  test.skip(count < 2, "needs a second event in the dev database");

  // Pick whichever option is not currently selected.
  const target = options.filter({ hasNot: page.getByText("✓") }).first();
  const targetName = (await target.locator("span.font-medium").textContent())!.trim();
  await target.click();

  // Header and the (remounted) basic-info form both follow the selection.
  await expect(page.locator("h1")).toHaveText(targetName);
  await expect(page.locator('input[name="name"]')).toHaveValue(targetName);
});
