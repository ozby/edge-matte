import { describe, expect, it } from "vitest";
import {
  ACCESS_CLIENT_ID_HEADER,
  ACCESS_CLIENT_SECRET_HEADER,
  buildProductionAccessHeaders,
  readProductionAccessCredentials,
  withProductionAccess,
} from "./access";

describe("production access helper", () => {
  it("returns null and no-op headers when access env vars are absent", () => {
    const env = {};

    expect(readProductionAccessCredentials(env)).toBeNull();
    expect(Array.from(buildProductionAccessHeaders(env).entries())).toEqual([]);
    expect(withProductionAccess({ method: "GET" }, env)).toEqual({ method: "GET" });
  });

  it("throws when only one access env var is set", () => {
    expect(() => readProductionAccessCredentials({ CF_ACCESS_CLIENT_ID: "client-id" })).toThrow(
      /CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET/u,
    );
    expect(() =>
      readProductionAccessCredentials({ CF_ACCESS_CLIENT_SECRET: "client-secret" }),
    ).toThrow(/CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET/u);
  });

  it("adds access headers while preserving existing headers", () => {
    const env = {
      CF_ACCESS_CLIENT_ID: "client-id",
      CF_ACCESS_CLIENT_SECRET: "client-secret",
    };

    const headers = buildProductionAccessHeaders(env);
    expect(headers.get(ACCESS_CLIENT_ID_HEADER)).toBe("client-id");
    expect(headers.get(ACCESS_CLIENT_SECRET_HEADER)).toBe("client-secret");

    const init = withProductionAccess(
      {
        headers: {
          accept: "application/json",
        },
      },
      env,
    );
    const merged = new Headers(init.headers);

    expect(merged.get("accept")).toBe("application/json");
    expect(merged.get(ACCESS_CLIENT_ID_HEADER)).toBe("client-id");
    expect(merged.get(ACCESS_CLIENT_SECRET_HEADER)).toBe("client-secret");
  });
});
