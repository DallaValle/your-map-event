import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the dev server (seeded with admin@test.com /
 * "password" and a demo team on boot). `reuseExistingServer` lets a manually
 * started `PORT=3999 npm run dev` be picked up during development.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // The tests mutate one shared dev database — keep them serial.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3999",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] }, // Chromium-based, no extra browser download
    },
  ],
  webServer: {
    command: "PORT=3999 npm run dev",
    url: "http://localhost:3999",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
