import { test, expect } from "@playwright/test";
import { signIn, signInViewer } from "./helpers";

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
    await firstRow.getByRole("button", { name: "Edit" }).click();
    const editForm = page.getByRole("form", { name: "Edit session" });
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
