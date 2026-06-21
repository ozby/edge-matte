import { describe, expect, it } from "vitest";

import { parseSecretsConfigMetadata } from "./secrets-policy.js";

describe("parseSecretsConfigMetadata", () => {
  it("accepts schemaVersion 1 secret metadata", () => {
    expect(
      parseSecretsConfigMetadata(
        JSON.stringify({
          schemaVersion: 1,
          providers: {
            default: {
              type: "doppler",
              project: "edge-matte",
            },
          },
          profiles: {
            production: { provider: "default", environment: "prd" },
          },
          sinks: {},
        }),
        ".webpresso/secrets.config.json",
      ),
    ).toEqual({
      manager: "doppler",
      projectId: "edge-matte",
      profiles: {
        production: { environment: "prd" },
      },
    });
  });

  it("rejects legacy secret metadata without schemaVersion 1", () => {
    expect(() =>
      parseSecretsConfigMetadata(
        JSON.stringify({
          manager: "infisical",
          projectId: "edge-matte",
          projectLabel: "Edge Matte",
        }),
        ".git/webpresso/secrets.json",
      ),
    ).toThrow(/schemaVersion.*1/u);
  });
});
