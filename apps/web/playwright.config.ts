import { defineConfig, devices } from "@playwright/test"

/**
 * E2E tests run against a running stack (API + worker + web). Start it with `make api worker web`
 * (or docker compose) and point E2E_BASE_URL at the web app. Credentialed specs are skipped unless
 * the matching env vars are set (see tests/e2e/README in docs/testing.md).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
