import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/e2e/journeys/**/*.contract.test.ts", "apps/e2e/journeys/**/*.smoke.test.ts"],
    globalSetup: ["apps/e2e/global-setup.ts"],
    testTimeout: 30_000,
  },
});
