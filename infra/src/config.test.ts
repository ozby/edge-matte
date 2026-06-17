import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "config.ts"), "utf8");

describe("infra config source contract", () => {
  it("keeps the Wrangler-facing R2 bucket name stable", () => {
    expect(source).toContain('export const R2_BUCKET_NAME = "edge-matte-images"');
  });
});
