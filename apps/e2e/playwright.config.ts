import { defineConfig } from "@playwright/test";

const port = process.env.E2E_LOCAL_PORT?.trim() || "4173";
const baseURL = process.env.E2E_BASE_URL?.trim().replace(/\/$/u, "") || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./journeys",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `E2E_LOCAL_PORT=${port} bun ./src/cli/start-local-e2e-server.ts`,
        url: `${baseURL}/health`,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
