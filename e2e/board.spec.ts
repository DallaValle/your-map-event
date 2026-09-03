import { test, expect } from "@playwright/test";
import { signIn, signInViewer } from "./helpers";
import { clearE2ESessions, disconnectPrisma } from "./program-fixtures";

async function addSession(
  page: import("@playwright/test").Page,
  title: string,
  start: string,
  end: string,
  location: string,
) {
  const form = page.getByRole("form", { name: "Add session" });
  await form.getByLabel("Title").fill(title);
  await form.getByLabel("Start").fill(start);
  await form.getByLabel("End").fill(end);
  await form.getByLabel("Location").fill(location);
  await form.getByRole("button", { name: "Add session" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

test.describe("board", () => {
  test.beforeEach(clearE2ESessions);
  test.afterAll(disconnectPrisma);

  test("admin creates, edits and reorders sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signIn(page);
    await page.goto("/dashboard/board");
    await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();

    const stamp = Date.now();
    const first = `E2E Soundcheck ${stamp}`;
    const second = `E2E Headliner ${stamp}`;
    const edited = `${first} (doors)`;

    await addSession(page, first, "2026-07-18T17:00", "2026-07-18T17:30", "Main Stage");
    await expect(page.getByText("Main Stage").first()).toBeVisible();

    const firstRow = page.getByRole("listitem").filter({ hasText: first });
    // The hours typed are the hours shown back, whatever the server's timezone.
    await expect(firstRow).toContainText("17:00 - 17:30");

    await firstRow.getByRole("button", { name: "Edit" }).click();
    const editForm = page.getByRole("form", { name: "Edit session" });
    // ...and the same hours pre-fill the edit form, rather than a shifted one.
    await expect(editForm.getByLabel("Start")).toHaveValue("2026-07-18T17:00");
    await expect(editForm.getByLabel("End")).toHaveValue("2026-07-18T17:30");
    await editForm.getByLabel("Title").fill(edited);
    await editForm.getByRole("button", { name: "Save session" }).click();
    await expect(page.getByRole("heading", { name: edited })).toBeVisible();

    await addSession(page, second, "2026-07-18T21:00", "2026-07-18T22:00", "Main Stage");

    const runningOrder = page.getByRole("list", { name: "Running order" });
    const secondRow = runningOrder.getByRole("listitem").filter({ hasText: second });
    await secondRow.getByRole("button", { name: "Move up" }).click();

    await expect
      .poll(async () => {
        const names = await runningOrder.getByRole("heading").allTextContents();
        return names.indexOf(second) < names.indexOf(edited) && names.indexOf(second) >= 0;
      })
      .toBe(true);
  });

  test("viewer can read the board but cannot edit", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signInViewer(page);
    await page.goto("/dashboard/board");
    await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Add session" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Move up" })).toHaveCount(0);
  });
});

/**
 * A browser deliberately far from the server's timezone. Board is a client
 * component and Schedule is a server one, so a time read with getHours()
 * renders differently in each - the reader would see two different programmes.
 */
test.describe("board and schedule in a distant timezone", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  test.beforeEach(clearE2ESessions);
  test.afterAll(disconnectPrisma);

  test("the hours typed survive the server/browser timezone gap", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signIn(page);
    await page.goto("/dashboard/board");

    const title = `E2E Timezone ${Date.now()}`;
    await addSession(page, title, "2026-07-23T17:00", "2026-07-23T18:30", "Main Stage");

    const row = page.getByRole("listitem").filter({ hasText: title });
    await expect(row).toContainText("17:00 - 18:30");

    // The edit form is pre-filled from the same value, in the same hours.
    await row.getByRole("button", { name: "Edit" }).click();
    const editForm = page.getByRole("form", { name: "Edit session" });
    await expect(editForm.getByLabel("Start")).toHaveValue("2026-07-23T17:00");
    await expect(editForm.getByLabel("End")).toHaveValue("2026-07-23T18:30");
    await editForm.getByRole("button", { name: "Cancel" }).click();

    // Schedule renders on the server: it must agree with the Board above.
    await page.goto("/dashboard/schedule");
    const day = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Thursday 23 Jul 2026" }) });
    await expect(day.getByRole("listitem", { name: "17:00" })).toContainText("17:00 - 18:30");
    // ...and the session is still listed in the hour it runs into.
    await expect(day.getByRole("listitem", { name: "18:00" })).toContainText(title);
  });
});
