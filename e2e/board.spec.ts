import { test, expect } from "@playwright/test";
import { signIn, signInViewer } from "./helpers";
import { clearE2EActivities, disconnectPrisma } from "./activity-fixtures";

test.describe("board", () => {
  test.beforeEach(clearE2EActivities);
  test.afterAll(disconnectPrisma);

  test("admin creates and edits activities", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signIn(page);
    await page.goto("/dashboard/board");
    await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();

    const stamp = Date.now();
    const title = `E2E Soundcheck ${stamp}`;
    const edited = `${title} (doors)`;

    await page.getByRole("button", { name: "Add activity", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add activity" });
    await dialog.getByLabel("Name").fill(title);
    await dialog.getByLabel("Type").selectOption("other");
    await dialog.getByLabel("Location").selectOption({ label: "🎤 Main Stage" });
    await dialog.getByLabel("Start").fill("2026-07-18T17:00");
    await dialog.getByLabel("End").fill("2026-07-18T17:30");
    await dialog.getByRole("button", { name: "Add activity" }).click();

    const row = page.getByRole("listitem").filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row).toContainText("17:00 - 17:30");
    await expect(row).toContainText("Main Stage");

    await row.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: "Edit activity" });
    await expect(edit.getByLabel("Start")).toHaveValue("2026-07-18T17:00");
    await expect(edit.getByLabel("End")).toHaveValue("2026-07-18T17:30");
    await edit.getByLabel("Name").fill(edited);
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: edited })).toBeVisible();
  });

  test("viewer can read the board but cannot edit", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signInViewer(page);
    await page.goto("/dashboard/board");
    await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add activity", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  });
});
