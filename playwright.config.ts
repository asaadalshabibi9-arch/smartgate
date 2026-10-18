import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { parseEnv } from "node:util";
if (existsSync(".env.local")) loadEnvFile(".env.local");
if (process.env.E2E_AUTH_ENV) {
  process.env.VERCEL_OIDC_TOKEN = parseEnv(
    readFileSync(process.env.E2E_AUTH_ENV, "utf8"),
  ).VERCEL_OIDC_TOKEN;
}
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm start",
        url: "http://localhost:3000/en/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
