import { readFileSync } from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Interface icons are SVG from the shared <Icon>, in light and dark. Marker
 * emoji are organizer content, so the marker pane is left out of the checks.
 */

const LIVE = "/demo-team/lakeside-festival-2026";
// Same ranges as the eslint guard: emoji, arrows, dingbats, shapes.
const GLYPH = /[\u{2190}-\u{2BFF}\u{1F000}-\u{1FAFF}\u{FE0F}\u{D7}]/u;

/** Visible text of the page without the organizer's markers. */
function chromeText(page: Page) {
  return page.evaluate(() => {
    const panes = [...document.querySelectorAll<HTMLElement>(".leaflet-marker-pane")];
    panes.forEach((el) => (el.style.display = "none"));
    const text = document.body.innerText;
    panes.forEach((el) => (el.style.display = ""));
    return text;
  });
}

async function expectSvgIcon(control: Locator) {
  await expect(control.locator("svg").first()).toBeVisible();
}

/** The color the theme resolves --brand to, in the same rgb() form as computed styles. */
function brandColor(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--brand)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`icons in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("console chrome draws every icon as SVG", async ({ page }) => {
      await signIn(page);
      await expect(page.locator("html")).toHaveClass(scheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);

      const nav = page.getByRole("navigation", { name: "Dashboard" });
      const links = nav.getByRole("link");
      expect(await links.count()).toBeGreaterThan(3);
      for (const link of await links.all()) await expectSvgIcon(link);

      await expectSvgIcon(page.getByRole("link", { name: /^Notifications/ }));

      // The active item's icon follows the theme's brand token through currentColor.
      const activeIcon = nav.locator('a[aria-current="page"] svg');
      const iconColor = await activeIcon.evaluate((svg) => getComputedStyle(svg).color);
      expect(iconColor).toBe(await brandColor(page));

      expect(await chromeText(page)).not.toMatch(GLYPH);
    });

    test("attendee bars and sheets draw every icon as SVG", async ({ page }) => {
      await page.goto(LIVE);
      await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });

      const points = page.getByRole("button", { name: /^Points \(\d+\)/ });
      await expectSvgIcon(points);
      await expectSvgIcon(page.getByRole("button", { name: "Locate" }));
      await expectSvgIcon(page.getByRole("button", { name: "Recenter" }));
      expect(await chromeText(page)).not.toMatch(GLYPH);

      await points.click();
      await expectSvgIcon(page.getByRole("button", { name: "Collapse list" }));
      await page.getByRole("button", { name: "Collapse list" }).click();
    });
  });
}

// The eslint guard reads source files, not translations, so check those here.
test("translations carry no icon glyphs", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  for (const locale of ["en", "it"]) {
    const messages = readFileSync(`messages/${locale}.json`, "utf8");
    const offenders = messages.split("\n").filter((line) => GLYPH.test(line) || /": "\+ /.test(line));
    expect(offenders, `messages/${locale}.json`).toEqual([]);
  }
});
