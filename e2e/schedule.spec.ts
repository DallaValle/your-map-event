import { test, expect } from "@playwright/test";
import { signIn, signInViewer } from "./helpers";
import { clearE2EActivities, disconnectPrisma } from "./activity-fixtures";

test.describe("schedule", () => {
  test.beforeEach(clearE2EActivities);
  test.afterAll(disconnectPrisma);

  test("timeline builder shows seeded acts on map locations", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "layout is desktop-first");

    await signIn(page);
    await page.goto("/dashboard/schedule");
    await expect(page.getByRole("heading", { name: "Timeline Builder" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Day 1/ })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "DJ Solaris" })).toBeVisible();
    await expect(page.getByText("Midnight Bloom")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Unscheduled/ })).toBeVisible();
    await expect(page.getByText("Main Stage").first()).toBeVisible();
  });

  test("admin adds an activity and it lands on the timeline", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "layout is desktop-first");

    await signIn(page);
    await page.goto("/dashboard/schedule");

    const title = `E2E Workshop ${Date.now()}`;
    await page.getByRole("button", { name: "+ Add activity" }).click();
    const dialog = page.getByRole("dialog", { name: "Add activity" });
    await dialog.getByLabel("Name").fill(title);
    await dialog.getByLabel("Type").selectOption("workshop");
    await dialog.getByLabel("Location").selectOption({ label: "🎤 Main Stage" });
    await dialog.getByLabel("Start").fill("2026-07-18T13:00");
    await dialog.getByLabel("End").fill("2026-07-18T14:00");
    await dialog.getByRole("button", { name: "Add activity" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    const block = page.getByRole("article").filter({ hasText: title });
    await expect(block).toBeVisible();
    await expect(block).toContainText("13:00 - 14:00");
  });

  test("activity created on a map point appears on the schedule", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "layout is desktop-first");

    await signIn(page);
    await page.goto("/dashboard");
    await page.locator("aside").getByRole("link", { name: "Map editor" }).click();
    await page.waitForURL("**/dashboard/events/**");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await page.getByRole("button", { name: /Main Stage/ }).click();
    await expect(page.getByRole("heading", { name: "Edit point" })).toBeVisible();

    const title = `E2E Map Act ${Date.now()}`;
    const form = page.getByRole("form", { name: "Add activity at Main Stage" });
    await form.getByLabel("Activity name").fill(title);
    await form.getByLabel("Activity type").selectOption("talk");
    await form.getByLabel("Start").fill("2026-07-18T11:00");
    await form.getByLabel("End").fill("2026-07-18T11:45");
    await form.getByRole("button", { name: "+ Add to schedule" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();

    await page.locator("aside").getByRole("link", { name: "Schedule" }).click();
    await expect(page.getByRole("heading", { name: "Timeline Builder" })).toBeVisible();
    const block = page.getByRole("article").filter({ hasText: title });
    await expect(block).toBeVisible();
    // 45 min is a short card at the default zoom: it shows the start, the title holds the range.
    await expect(block).toContainText("11:00");
    await expect(block).toHaveAttribute("title", `${title} · 11:00 - 11:45`);
  });

  test("viewer can read the schedule but cannot edit", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signInViewer(page);
    await page.goto("/dashboard/schedule");
    await expect(page.getByRole("heading", { name: "Timeline Builder" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add activity" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Add act" })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("schedule in a distant timezone", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  test.beforeEach(clearE2EActivities);
  test.afterAll(disconnectPrisma);

  test("the hours typed survive the server/browser timezone gap", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signIn(page);
    await page.goto("/dashboard/schedule");

    const title = `E2E Timezone ${Date.now()}`;
    await page.getByRole("button", { name: "+ Add activity" }).click();
    const dialog = page.getByRole("dialog", { name: "Add activity" });
    await dialog.getByLabel("Name").fill(title);
    await dialog.getByLabel("Location").selectOption({ label: "🎤 Main Stage" });
    await dialog.getByLabel("Start").fill("2026-07-18T13:00");
    await dialog.getByLabel("End").fill("2026-07-18T14:00");
    await dialog.getByRole("button", { name: "Add activity" }).click();

    const block = page.getByRole("article").filter({ hasText: title });
    await expect(block).toBeVisible();
    await expect(block).toContainText("13:00 - 14:00");

    await page.goto("/dashboard/board");
    const row = page.getByRole("listitem").filter({ hasText: title });
    await expect(row).toContainText("13:00 - 14:00");
  });
});
