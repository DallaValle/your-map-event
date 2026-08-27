import { test, expect } from "@playwright/test";
import { signIn, signInViewer } from "./helpers";
import { clearE2ESessions, disconnectPrisma } from "./program-fixtures";

test.describe("schedule", () => {
  test.beforeEach(clearE2ESessions);
  test.afterAll(disconnectPrisma);

  test("shows the same board sessions hour by hour", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signIn(page);
    await page.goto("/dashboard/board");
    await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();

    const title = `E2E Workshop ${Date.now()}`;
    const form = page.getByRole("form", { name: "Add session" });
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Start").fill("2026-07-19T11:00");
    await form.getByLabel("End").fill("2026-07-19T12:30");
    await form.getByLabel("Location").fill("Tent A");
    await form.getByRole("button", { name: "Add session" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.goto("/dashboard/schedule");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

    // Scope by day: the demo programme owns hour rows on other days.
    const day = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Sunday 19 Jul 2026" }) });

    const hour = day.getByRole("listitem", { name: "11:00" });
    await expect(hour).toBeVisible();
    await expect(hour.getByRole("heading", { name: title })).toBeVisible();
    await expect(hour).toContainText("Tent A");
    await expect(hour).toContainText("11:00 - 12:30");

    // A session is listed in every hour it runs, not only the hour it starts:
    // 12:00 must not read as free while the workshop is still on.
    const nextHour = day.getByRole("listitem", { name: "12:00" });
    await expect(nextHour).toBeVisible();
    await expect(nextHour.getByRole("heading", { name: title })).toBeVisible();
  });

  test("a session crossing midnight lands under both days", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signIn(page);
    await page.goto("/dashboard/board");

    const title = `E2E Afterparty ${Date.now()}`;
    const form = page.getByRole("form", { name: "Add session" });
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Start").fill("2026-07-21T23:00");
    await form.getByLabel("End").fill("2026-07-22T01:00");
    await form.getByRole("button", { name: "Add session" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.goto("/dashboard/schedule");

    // 23:00 belongs to the 21st; 00:00 must sit under the 22nd, never as a
    // stray "00:00" row appended to the 21st.
    const tuesday = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Tuesday 21 Jul 2026" }) });
    const wednesday = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Wednesday 22 Jul 2026" }) });

    await expect(tuesday.getByRole("listitem", { name: "23:00" })).toContainText(title);
    await expect(tuesday.getByRole("listitem", { name: "00:00" })).toHaveCount(0);
    await expect(wednesday.getByRole("listitem", { name: "00:00" })).toContainText(title);
  });

  test("viewer can read the schedule but cannot edit", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signInViewer(page);
    await page.goto("/dashboard/schedule");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Add session" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Board", exact: true })).toBeVisible();
  });
});
