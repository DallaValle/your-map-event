import { test, expect, type Browser } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Full collaboration loop, exactly as two real users would live it:
 * the admin invites a teammate and copies the link; the teammate opens it in
 * a fresh browser, creates an account and joins; the dashboard then treats
 * them as a Viewer (no Team nav, no editing).
 */
test.describe("team invite flow", () => {
  test("invite → sign-up → join as Viewer", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");
    // The dev server keeps auth in memory across test runs — a unique email
    // per run avoids "already registered" clashes.
    const email = `invited-${Date.now()}@test.com`;

    // 1. Admin invites a Viewer and copies the link.
    await signIn(page);
    await page.goto("/dashboard/team");
    await page.locator('input[type="email"]').fill(email);
    await page.getByRole("button", { name: "Invite" }).click();
    await expect(page.getByText("Invitation created", { exact: false })).toBeVisible();
    const inviteLink = (await page.locator("code").first().textContent())!.trim();
    expect(inviteLink).toContain("/accept-invitation/");

    // The pending invitation is listed with its management controls.
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole("button", { name: "Revoke" })).toBeVisible();

    // 2. The invitee opens the link in a clean browser: no session yet.
    const invitee = await freshPage(browser);
    await invitee.goto(inviteLink);
    await expect(invitee.getByRole("heading", { name: "Team invitation" })).toBeVisible();

    // 3. They create an account (the redirect returns them to the invite)…
    await invitee.getByRole("link", { name: "Create an account" }).click();
    await invitee.locator('input[name="name"]').fill("Invited Viewer");
    await invitee.locator('input[type="email"]').fill(email);
    await invitee.locator('input[type="password"]').fill("password123");
    await invitee.getByRole("button", { name: "Create account" }).click();
    await invitee.waitForURL("**/accept-invitation/**");

    // …see who invited them, and join.
    await expect(invitee.getByText("invited you to join", { exact: false })).toBeVisible();
    await invitee.getByRole("button", { name: "Join the team" }).click();
    await invitee.waitForURL("**/dashboard");

    // 4. They're a member now (no "create your team" onboarding) — but a
    // Viewer: the Team section is admin-only and must not be offered.
    await expect(invitee.getByText("Create your team")).toBeHidden();
    await expect(invitee.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(invitee.getByRole("link", { name: "Team", exact: true })).toBeHidden();

    await invitee.context().close();
  });
});

/** A page in its own browser context — separate cookies, like another person. */
async function freshPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}
