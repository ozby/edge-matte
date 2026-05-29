import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    include: ["test/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // imports cloudflare:test globals — not resolvable in standard Node.js pool
      "test/health.test.ts",
    ],
  },
});
