import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/lib/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".stryker-tmp/**"],
  },
});
