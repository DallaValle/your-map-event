import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

const AVATAR_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/64px-React-icon.svg.png";

/**
 * Personal Settings as an organizer actually clicks it.
 * Profile / prefs use the seeded admin so we reuse helpers.signIn.
 * Password change uses a unique account so we never mutate admin@test.com.
 */
test.describe("settings", () => {
  test("admin can edit profile, prefs and connected accounts", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    await signIn(page);
    await page.getByRole("navigation", { name: "Dashboard" }).getByRole("link", { name: "Settings" }).click();
    await page.waitForURL("**/dashboard/settings");

    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByText("Coming soon")).toHaveCount(0);

    await page.getByLabel("Name").fill("Ada Organizer");
    await page.getByLabel("Avatar URL").fill(AVATAR_URL);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menu").getByText("Ada Organizer")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue("Ada Organizer");
    await expect(page.getByLabel("Avatar URL")).toHaveValue(AVATAR_URL);
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("admin@test.com");

    await expect(page.getByText("Email & password")).toBeVisible();
    await expect(page.getByText("Connected").first()).toBeVisible();

    await page.getByLabel("Email notifications").uncheck();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Preferences saved.")).toBeVisible();

    await page.getByRole("radio", { name: "Dark" }).check();
    await page.getByRole("button", { name: "Save appearance" }).click();
    await expect(page.getByText("Appearance saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Email notifications")).not.toBeChecked();
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();

    await page.getByLabel("Current password").fill("wrong-password");
    await page.getByLabel("New password", { exact: true }).fill("password456");
    await page.getByLabel("Confirm new password").fill("password456");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    // Restore the seeded display name so sibling suites still see Demo Admin.
    await page.getByLabel("Name").fill("Demo Admin");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
  });

  test("user can change password and sign back in", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");

    const email = `settings-${Date.now()}@test.com`;
    const password = "password123";
    const nextPassword = "password456";

    await page.goto("/sign-up");
    await page.locator('input[name="name"]').fill("Settings User");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/dashboard");

    await page.goto("/dashboard/settings");
    await page.getByLabel("Current password").fill(password);
    await page.getByLabel("New password", { exact: true }).fill(nextPassword);
    await page.getByLabel("Confirm new password").fill(nextPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Password updated.")).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("button", { name: "Log out" }).click();

    await page.goto("/sign-in");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(nextPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");
  });
});
