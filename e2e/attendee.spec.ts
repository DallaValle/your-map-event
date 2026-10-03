import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { attendeeFromProvider } from "../src/lib/attendee/accounts";

const LIVE = "/demo-team/lakeside-festival-2026";
const PASSWORD = "festival-pass";

// Unique per run and project so reruns never collide with leftovers.
function testEmail(tag: string) {
  return `attendee-${tag}-${Date.now()}@example.com`;
}

async function openLiveMap(page: Page, path = LIVE) {
  await page.goto(path);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
}

async function signUp(page: Page, name: string, email: string) {
  await page.getByRole("button", { name: "Sign in" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign in" });
  await sheet.getByRole("button", { name: "Create an account" }).click();
  const form = page.getByRole("dialog", { name: "Create your account" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Create account" }).click();
  // Signing in closes every panel; the account menu must not pop open on its own.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("attendee-avatar")).toHaveAccessibleName(`Account of ${name}`);
}

// Provider identities made up by these tests; Facebook ones carry no email.
const PROVIDER_ID = "e2e-provider-";

test.afterAll(async () => {
  await prisma.attendee.deleteMany({
    where: {
      OR: [
        { email: { startsWith: "attendee-", endsWith: "@example.com" } },
        { accounts: { some: { providerAccountId: { startsWith: PROVIDER_ID } } } },
      ],
    },
  });
});

function providerProfile(tag: string, email: string | null, emailVerified: boolean) {
  return { id: `${PROVIDER_ID}${tag}-${Date.now()}`, name: "Provider Person", email, emailVerified, image: null };
}

async function lakesideId() {
  return (await prisma.event.findFirstOrThrow({ where: { slug: "lakeside-festival-2026" } })).id;
}

test("attendee: sign up, sign out and sign in again from the top left avatar", async ({ page }) => {
  const email = testEmail("loop");
  await openLiveMap(page);

  // Signed out: a neutral avatar sits first in the top bar, left of the event name.
  const avatar = page.getByTestId("attendee-avatar");
  await expect(avatar).toHaveAccessibleName("Sign in");
  const header = page.getByText("Lakeside Festival 2026", { exact: true });
  expect((await avatar.boundingBox())!.x).toBeLessThan((await header.boundingBox())!.x);
  expect((await avatar.boundingBox())!.x).toBeLessThan(40);

  await signUp(page, "Ada Lovelace", email);
  await expect(avatar).toHaveAccessibleName("Account of Ada Lovelace");
  await expect(avatar).toHaveText("AL");

  // The session survives a reload.
  await openLiveMap(page);
  await avatar.click();
  const menu = page.getByRole("dialog", { name: "Your account" });
  await expect(menu).toContainText("Ada Lovelace");
  await expect(menu).toContainText(email);
  await menu.getByRole("button", { name: "Sign out" }).click();
  await expect(avatar).toHaveAccessibleName("Sign in");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await openLiveMap(page);
  await expect(avatar).toHaveAccessibleName("Sign in");

  // Wrong password is refused, the right one signs back in.
  await avatar.click();
  const sheet = page.getByRole("dialog", { name: "Sign in" });
  await sheet.getByLabel("Email").fill(email.toUpperCase());
  await sheet.getByLabel("Password").fill("not-the-password");
  await sheet.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Invalid email or password");

  await sheet.getByLabel("Email").fill(email);
  await sheet.getByLabel("Password").fill(PASSWORD);
  await sheet.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(avatar).toHaveAccessibleName("Account of Ada Lovelace");
});

test("attendee: accounts belong to one event and are not organizer accounts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  const lakeside = await prisma.event.findFirstOrThrow({
    where: { slug: "lakeside-festival-2026" },
    include: { team: true },
  });
  const other = await prisma.event.create({
    data: {
      teamId: lakeside.teamId,
      name: "Attendee Scope Fair",
      slug: `attendee-scope-${Date.now()}`,
      centerLat: lakeside.centerLat,
      centerLng: lakeside.centerLng,
      centerName: lakeside.centerName,
      published: true,
    },
  });
  const otherPath = `/${lakeside.team.slug}/${other.slug}`;

  try {
    const email = testEmail("scope");
    await openLiveMap(page);
    await signUp(page, "Grace Hopper", email);

    // Another event knows nothing of this attendee: no session, no password.
    await openLiveMap(page, otherPath);
    const avatar = page.getByTestId("attendee-avatar");
    await expect(avatar).toHaveAccessibleName("Sign in");
    await avatar.click();
    const sheet = page.getByRole("dialog", { name: "Sign in" });
    await expect(sheet).toContainText("Your account for Attendee Scope Fair");
    await sheet.getByLabel("Email").fill(email);
    await sheet.getByLabel("Password").fill(PASSWORD);
    await sheet.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(sheet.getByRole("alert")).toHaveText("Invalid email or password");

    // Organizer credentials do not open an attendee session either.
    await sheet.getByLabel("Email").fill("admin@test.com");
    await sheet.getByLabel("Password").fill("password");
    await sheet.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(sheet.getByRole("alert")).toHaveText("Invalid email or password");

    // The same email can sign up again here as a separate attendee.
    await page.keyboard.press("Escape");
    await signUp(page, "Grace H.", email);
    await expect(avatar).toHaveAccessibleName("Account of Grace H.");
    expect(await prisma.attendee.count({ where: { email } })).toBe(2);

    // Lakeside still shows its own attendee.
    await openLiveMap(page);
    await expect(avatar).toHaveAccessibleName("Account of Grace Hopper");
  } finally {
    await prisma.event.delete({ where: { id: other.id } });
  }
});

test("attendee: a failed Google or Facebook round trip reopens sign in with an error", async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  const lakeside = await prisma.event.findFirstOrThrow({ where: { slug: "lakeside-festival-2026" } });

  // Stands in for the cookie the start route sets; the provider sends back a different state.
  await context.addCookies([
    {
      name: "yme_attendee_oauth",
      value: JSON.stringify({ provider: "google", state: "expected", verifier: "v", eventId: lakeside.id }),
      url: `${baseURL}/api/attendee-auth`,
    },
  ]);
  await page.goto("/api/attendee-auth/google/callback?code=abc&state=forged");
  await page.waitForURL(`**${LIVE}`);

  const sheet = page.getByRole("dialog", { name: "Sign in" });
  await expect(sheet.getByRole("alert")).toHaveText("Sign in did not complete. Please try again.");
  // The flag is consumed, so a reload does not show the error again.
  expect(new URL(page.url()).search).toBe("");
  await expect(page.getByTestId("attendee-avatar")).toHaveAccessibleName("Sign in");
});

test("attendee: provider buttons only show when configured and start the OAuth redirect", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  await openLiveMap(page);
  await page.getByTestId("attendee-avatar").click();
  const sheet = page.getByRole("dialog", { name: "Sign in" });

  for (const [label, host] of [
    ["Continue with Google", "accounts.google.com"],
    ["Continue with Facebook", "www.facebook.com"],
  ] as const) {
    const link = sheet.getByRole("link", { name: label });
    if (!(await link.count())) continue;
    const response = await page.request.get((await link.getAttribute("href"))!, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const target = new URL(response.headers().location);
    expect(target.host).toBe(host);
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");
    expect(target.searchParams.get("redirect_uri")).toMatch(/\/api\/attendee-auth\/(google|facebook)\/callback$/);
  }

  // Unknown or unconfigured providers never start a flow.
  const response = await page.request.get("/api/attendee-auth/github?event=x", { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});

// The provider round trip itself needs real Google or Facebook, so these drive the merge step directly.
test.describe("attendee: provider logins and existing accounts", () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "run once"));

  test("a verified Google email takes over a password only account", async ({ page }) => {
    const email = testEmail("takeover");
    await openLiveMap(page);
    await signUp(page, "Pat Password", email);
    const eventId = await lakesideId();
    const before = await prisma.attendee.findUniqueOrThrow({ where: { eventId_email: { eventId, email } } });

    const id = await attendeeFromProvider(eventId, "google", providerProfile("google", email.toUpperCase(), true));
    expect(id).toBe(before.id);
    const after = await prisma.attendee.findUniqueOrThrow({ where: { id }, include: { accounts: true } });
    expect(after.passwordHash).toBeNull();
    expect(after.accounts.map((a) => a.provider)).toEqual(["google"]);

    // Whoever set the password is signed out everywhere.
    await openLiveMap(page);
    await expect(page.getByTestId("attendee-avatar")).toHaveAccessibleName("Sign in");
  });

  test("another verified login on a provider account links without signing anyone out", async () => {
    const email = testEmail("link");
    const eventId = await lakesideId();
    const id = await attendeeFromProvider(eventId, "google", providerProfile("google-a", email, true));
    await prisma.attendeeSession.create({
      data: { attendeeId: id, tokenHash: `e2e-${Date.now()}`, expiresAt: new Date(Date.now() + 86_400_000) },
    });

    expect(await attendeeFromProvider(eventId, "google", providerProfile("google-b", email, true))).toBe(id);
    expect(await prisma.attendeeAccount.count({ where: { attendeeId: id } })).toBe(2);
    expect(await prisma.attendeeSession.count({ where: { attendeeId: id } })).toBe(1);
  });

  test("an unverified email (Facebook) never touches the matching account", async ({ page }) => {
    const email = testEmail("facebook");
    await openLiveMap(page);
    await signUp(page, "Fran Password", email);
    const eventId = await lakesideId();
    const owner = await prisma.attendee.findUniqueOrThrow({ where: { eventId_email: { eventId, email } } });

    const id = await attendeeFromProvider(eventId, "facebook", providerProfile("facebook", email, false));
    expect(id).not.toBe(owner.id);
    expect((await prisma.attendee.findUniqueOrThrow({ where: { id } })).email).toBeNull();
    expect((await prisma.attendee.findUniqueOrThrow({ where: { id: owner.id } })).passwordHash).not.toBeNull();

    // The password owner stays signed in.
    await openLiveMap(page);
    await expect(page.getByTestId("attendee-avatar")).toHaveAccessibleName("Account of Fran Password");
  });
});
