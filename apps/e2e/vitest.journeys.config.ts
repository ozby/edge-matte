import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["journeys/**/*.e2e.ts"],
    globalSetup: ["./global-setup.ts"],
    testTimeout: 30_000,
  },
});
