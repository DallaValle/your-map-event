import { readdirSync, readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { prisma } from "../src/lib/prisma";

const LIVE = "/demo-team/lakeside-festival-2026";
const EVENT_PREFIX = "E2E Evento ";

type Catalog = { [key: string]: string | Catalog };

function load(locale: string): Catalog {
  return JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));
}

/** Every leaf as "a.b.c" with the ICU arguments it uses. */
function leaves(catalog: Catalog, prefix = ""): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      const args = [...value.matchAll(/\{\s*(\w+)/g)].map((m) => m[1]);
      out.set(path, [...new Set(args)].sort());
    } else {
      for (const [k, v] of leaves(value, path)) out.set(k, v);
    }
  }
  return out;
}

// The organizer's choice lives on the shared database: never leak Italian into other specs.
async function resetLanguage() {
  await prisma.userPreference.updateMany({ where: { locale: { not: null } }, data: { locale: null } });
}

test.afterAll(async () => {
  await resetLanguage();
  await prisma.event.deleteMany({ where: { name: { startsWith: EVENT_PREFIX } } });
  await prisma.$disconnect();
});

test("every translation has exactly the English keys and arguments", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "run once");
  const english = leaves(load("en"));
  const others = readdirSync("messages")
    .filter((file) => file.endsWith(".json") && file !== "en.json")
    .map((file) => file.replace(/\.json$/, ""));
  expect(others).toContain("it");

  for (const locale of others) {
    const translated = leaves(load(locale));
    const missing = [...english.keys()].filter((key) => !translated.has(key));
    const extra = [...translated.keys()].filter((key) => !english.has(key));
    const wrongArgs = [...english]
      .filter(([key, args]) => translated.has(key) && translated.get(key)!.join() !== args.join())
      .map(([key]) => key);
    expect({ locale, missing, extra, wrongArgs }).toEqual({ locale, missing: [], extra: [], wrongArgs: [] });
  }
});

test.describe("attendee on an Italian phone", () => {
  test.use({ locale: "it-IT" });

  test("the live map speaks Italian, organizer content stays as typed", async ({ page }) => {
    await page.goto(LIVE);
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "it");

    const nav = page.getByRole("button", { name: /^📍\s*Punti \(\d+\)$/ });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("button", { name: /Dove sono/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Centra/ })).toBeVisible();

    await nav.click();
    await expect(page.getByRole("heading", { name: /^Punti di interesse \(\d+\)$/ })).toBeVisible();
    const search = page.getByRole("searchbox", { name: "Cerca punti" });
    await expect(search).toHaveAttribute("placeholder", "Cerca un punto per nome");
    // Point titles are organizer content: listed exactly as typed.
    await expect(page.getByRole("button", { name: /Main Stage/ })).toBeVisible();

    await search.fill("zzzz");
    await expect(page.getByText("Nessun punto corrisponde a “zzzz”.")).toBeVisible();
  });

  test("an unsupported phone language falls back to English", async ({ browser }) => {
    const context = await browser.newContext({ locale: "fr-FR" });
    const page = await context.newPage();
    await page.goto(LIVE);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: /Recenter/ })).toBeVisible();
    await context.close();
  });
});

test.describe("organizer who picks Italian", () => {
  test.afterEach(resetLanguage);

  test("runs create, map, schedule and publish in Italian", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one organizer flow is enough");
    test.setTimeout(120_000);

    // Browser in English: the Settings choice must win over it.
    await signIn(page);
    await page.goto("/dashboard/settings");
    await page.getByRole("radio", { name: "Italiano" }).check();
    await page.getByRole("button", { name: "Save language" }).click();
    await expect(page.getByRole("heading", { name: "Impostazioni" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
    await expect(page.getByText("Lingua salvata.")).toBeVisible();

    // Create: mock checkout, then name.
    await page.locator("aside").getByRole("link", { name: "Prezzi" }).click();
    await expect(page.getByRole("heading", { name: "Nuovo evento" })).toBeVisible();
    await page.getByRole("button", { name: /Paga .* e continua/ }).click();
    await expect(page.getByText("Pagamento confermato")).toBeVisible();
    const name = `${EVENT_PREFIX}${Date.now()}`;
    await page.getByLabel("Nome dell’evento").fill(name);
    await page.getByRole("button", { name: "Crea evento" }).click();
    await page.waitForURL("**/dashboard");
    // The event name is organizer content and is shown exactly as typed.
    await expect(page.locator("h1")).toHaveText(name);
    await expect(page.getByText("Bozza", { exact: true }).first()).toBeVisible();

    // Map editor: add a point.
    await page.locator("aside").getByRole("link", { name: "Editor mappa" }).click();
    await page.waitForURL("**/dashboard/events/**");
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Nome del luogo")).toHaveValue("Da impostare nell’editor mappa");
    await page.getByRole("button", { name: "+ Aggiungi punti" }).click();
    await page.locator(".leaflet-container").click({ position: { x: 160, y: 300 } });
    await expect(page.getByRole("heading", { name: "Nuovo punto" })).toBeVisible();
    await page.getByLabel("Titolo").fill("Palco Centrale");
    await page.getByRole("button", { name: "Aggiungi punto" }).click();
    await expect(page.getByRole("heading", { name: "Punti di interesse (1)" })).toBeVisible();

    // Schedule: an act on that point, with Italian day labels.
    await page.locator("aside").getByRole("link", { name: "Programma" }).click();
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    const hours = page.locator("form").filter({ hasText: "Orari evento" });
    await hours.getByLabel("Inizio").fill("2026-07-18T16:00");
    await hours.getByLabel("Fine").fill("2026-07-18T23:00");
    await hours.getByRole("button", { name: "Applica" }).click();
    await expect(page.getByRole("tab", { name: "Giorno 1 · sab 18 lug" })).toBeVisible();
    await expect(page.getByText("16:00", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "+ Aggiungi attività" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Aggiungi attività" });
    await dialog.getByLabel("Nome").fill("Concerto");
    await dialog.getByLabel("Tipo").selectOption("performance");
    await expect(dialog.getByLabel("Tipo").locator("option:checked")).toHaveText(/Spettacolo/);
    await dialog.getByLabel("Luogo").selectOption({ label: "📍 Palco Centrale" });
    await dialog.getByLabel("Inizio").fill("2026-07-18T18:00");
    await dialog.getByLabel("Fine").fill("2026-07-18T19:00");
    await dialog.getByRole("button", { name: "Aggiungi attività" }).click();
    await expect(page.locator("article").filter({ hasText: "Concerto" })).toContainText("18:00 - 19:00");

    // Publish from the event home.
    await page.locator("aside").getByRole("link", { name: "Dashboard" }).click();
    await page.getByRole("button", { name: "Pubblica" }).click();
    await expect(page.getByRole("button", { name: "Online ✓ - Ritira" })).toBeVisible();
    await expect(page.getByText("Online", { exact: true }).first()).toBeVisible();
  });
});
