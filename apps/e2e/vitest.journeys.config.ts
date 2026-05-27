import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["journeys/**/*.contract.test.ts", "journeys/**/*.smoke.test.ts"],
    globalSetup: ["./global-setup.ts"],
    testTimeout: 30_000,
  },
});
