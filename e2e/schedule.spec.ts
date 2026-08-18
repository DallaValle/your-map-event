import { test, expect } from "@playwright/test";
import { signIn, signInViewer } from "./helpers";

test.describe("schedule", () => {
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

    const hour = page.getByRole("listitem", { name: "11:00" });
    await expect(hour).toBeVisible();
    await expect(hour.getByRole("heading", { name: title })).toBeVisible();
    await expect(hour.getByText("Tent A")).toBeVisible();
    await expect(hour.getByText("11:00 - 12:30")).toBeVisible();

    // The hour after start is on the grid (session runs into 12:00) and empty of this title.
    const nextHour = page.getByRole("listitem", { name: "12:00" });
    await expect(nextHour).toBeVisible();
    await expect(nextHour.getByRole("heading", { name: title })).toHaveCount(0);
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
