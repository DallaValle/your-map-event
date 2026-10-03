import { test, expect, type Page } from "@playwright/test";
import { signIn, signInViewer } from "./helpers";
import { prisma } from "../src/lib/prisma";

const E2E_PREFIX = "E2E ";
const LIVE = "/demo-team/lakeside-festival-2026";

async function demoEvent() {
  const team = await prisma.team.findUniqueOrThrow({ where: { slug: "demo-team" } });
  return prisma.event.findFirstOrThrow({ where: { teamId: team.id, slug: "lakeside-festival-2026" } });
}

async function cleanup(eventId: string) {
  await prisma.announcement.deleteMany({ where: { eventId, title: { startsWith: E2E_PREFIX } } });
  await prisma.activity.deleteMany({ where: { eventId, name: { startsWith: E2E_PREFIX } } });
  await prisma.announcementSettings.deleteMany({ where: { eventId } });
}

/**
 * Without the cookie getActiveEvent falls back to the most recently updated
 * event, which is whatever event an earlier spec happened to create.
 */
async function openAnnouncements(page: Page, eventId: string) {
  await page.context().addCookies([{ name: "activeEventId", value: eventId, url: "http://localhost:3999" }]);
  await page.goto("/dashboard");
  await page.locator("aside").getByRole("link", { name: "Announcements" }).click();
  await page.waitForURL("**/dashboard/announcements");
  await expect(page.getByRole("heading", { name: "Announcements", exact: true })).toBeVisible();
}

test.describe("announcements", () => {
  let eventId: string;

  test.beforeAll(async () => {
    eventId = (await demoEvent()).id;
  });
  test.beforeEach(async () => cleanup(eventId));
  test.afterAll(async () => {
    await cleanup(eventId);
    await prisma.$disconnect();
  });

  test("organizer sends one now and attendees get it under the live map bell", async ({ page }) => {
    await signIn(page);
    // Notifications are an attendee thing now: the console header has no bell.
    await expect(page.getByRole("link", { name: /Notifications/ })).toHaveCount(0);
    await openAnnouncements(page, eventId);

    await page.locator('input[name="title"]').fill(`${E2E_PREFIX}gates closing in 10 minutes`);
    await page.locator('textarea[name="body"]').fill("Main entrance closes at 23:00.");
    await page.getByRole("button", { name: "Send announcement" }).click();
    await expect(page.getByRole("status")).toContainText("Sent to the live map");
    await expect(page.getByRole("heading", { name: `${E2E_PREFIX}gates closing in 10 minutes` })).toBeVisible();

    await page.goto(LIVE);
    const banner = page.getByRole("status", { name: "Live announcement" });
    await expect(banner).toContainText(`${E2E_PREFIX}gates closing in 10 minutes`);
    await expect(banner).toContainText("Main entrance closes at 23:00.");
    await expect(page.getByTestId("announcement-badge")).toBeVisible();

    await page.getByRole("button", { name: /^Announcements, \d+ new$/ }).click();
    const sheet = page.getByRole("region", { name: "Announcements" });
    await expect(sheet).toContainText(`${E2E_PREFIX}gates closing in 10 minutes`);
    // Reading the list clears the badge and the banner, and it stays read after a reload.
    await expect(page.getByTestId("announcement-badge")).toHaveCount(0);
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Announcements", exact: true })).toBeVisible();
    await expect(page.getByRole("status", { name: "Live announcement" })).toHaveCount(0);
  });

  test("a phone with a slow clock still gets announcements that are out", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");
    const title = `${E2E_PREFIX}slow clock`;
    await prisma.announcement.create({
      data: { eventId, title, body: "The server says this is out.", authorName: "Stage manager" },
    });
    // The server decides what is out; an hour behind must not hide it.
    await page.clock.install({ time: Date.now() - 3_600_000 });

    await page.goto(LIVE);
    await expect(page.getByRole("status", { name: "Live announcement" })).toContainText(title);
    await expect(page.getByTestId("announcement-badge")).toBeVisible();
  });

  test("a scheduled announcement waits for its time and can be cancelled", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");
    await signIn(page);
    await openAnnouncements(page, eventId);

    const title = `${E2E_PREFIX}fireworks tonight`;
    await page.locator('input[name="title"]').fill(title);
    await page.locator('textarea[name="body"]').fill("Look up at the lake at 22:30.");
    await page.getByRole("radio", { name: "Schedule" }).check();
    await page.getByLabel("Goes out at").fill("2030-07-18T22:00");
    await page.getByRole("button", { name: "Schedule announcement" }).click();
    await expect(page.getByRole("status")).toContainText("Scheduled");

    const scheduled = page.locator("section").filter({ has: page.getByRole("heading", { name: "Scheduled (1)" }) });
    await expect(scheduled.getByRole("heading", { name: title })).toBeVisible();
    await expect(scheduled).toContainText("Goes out Thu 18 Jul, 22:00");

    await page.goto(LIVE);
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);

    // Its time comes: the live map shows it without anyone pressing send.
    await prisma.announcement.updateMany({ where: { title }, data: { publishAt: new Date(Date.now() - 1000) } });
    await page.reload();
    await expect(page.getByRole("status", { name: "Live announcement" })).toContainText(title);

    await prisma.announcement.updateMany({ where: { title }, data: { publishAt: new Date("2030-07-18T20:00:00Z") } });
    await openAnnouncements(page, eventId);
    await scheduled.getByRole("button", { name: `Cancel “${title}”` }).click();
    await expect(page.getByRole("heading", { name: "Scheduled (0)" })).toBeVisible();
    await expect(page.getByText("Nothing scheduled.")).toBeVisible();
  });

  test.describe("automatic", () => {
    // Venue clock == UTC, so a start "in 10 minutes" is easy to write down.
    test.use({ timezoneId: "UTC" });

    test("the next activity is announced before it starts", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");
      const poi = await prisma.pointOfInterest.findFirstOrThrow({ where: { mapId: eventId, title: "Main Stage" } });
      const start = new Date(Math.ceil((Date.now() + 10 * 60_000) / 60_000) * 60_000);
      const name = `${E2E_PREFIX}Sunset Set`;
      await prisma.activity.create({
        data: { eventId, poiId: poi.id, name, type: "performance", startTime: start, endTime: new Date(start.getTime() + 3_600_000) },
      });
      const clock = start.toISOString().slice(11, 16);

      await signIn(page);
      await openAnnouncements(page, eventId);
      await expect(page.getByLabel("Announce activities before they start")).toBeChecked();
      await expect(page.getByRole("listitem").filter({ hasText: name })).toContainText(`starts ${clock}`);

      await page.goto(LIVE);
      const banner = page.getByRole("status", { name: "Live announcement" });
      await expect(banner).toContainText(`Starting soon: ${name}`);
      await expect(banner).toContainText(`Starts at ${clock} at Main Stage.`);

      await openAnnouncements(page, eventId);
      await page.getByLabel("Announce activities before they start").uncheck();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Automatic announcements saved");

      await page.goto(LIVE);
      await expect(page.locator(".leaflet-container")).toBeVisible();
      await expect(page.getByText(`Starting soon: ${name}`)).toHaveCount(0);
    });
  });

  test("a viewer reads announcements but cannot send", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "flow is identical; run once");
    await signInViewer(page);
    await page.goto("/dashboard/notifications");
    await page.waitForURL("**/dashboard/announcements");
    await expect(page.getByRole("heading", { name: "Announcements", exact: true })).toBeVisible();
    await expect(page.locator('input[name="title"]')).toHaveCount(0);
    await expect(page.getByLabel("Announce activities before they start")).toBeDisabled();
  });
});
