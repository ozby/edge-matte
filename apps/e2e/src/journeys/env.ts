import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "#repo-root";

const PORT_FILE = join(findRepoRoot(import.meta.dirname), "apps/e2e/.e2e-base-url");

export const PRODUCTION_BASE_URL = "https://edge-matte.ozby.dev";

export const readLocalE2EBaseUrl = (): string | null => {
  try {
    return readFileSync(PORT_FILE, "utf8").trim();
  } catch {
    return null;
  }
};

export const getE2EBaseUrlOrThrow = (testFile: string): string => {
  const fromEnv = process.env.E2E_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/u, "");
  const fromHarness = readLocalE2EBaseUrl();
  if (fromHarness) return fromHarness.replace(/\/$/u, "");
  throw new Error(
    `E2E_BASE_URL is required for ${testFile}. Run journeys via "pnpm e2e -- --suite <name>" or set E2E_BASE_URL.`,
  );
};

export const getProductionBaseUrl = (): string =>
  process.env.E2E_PRODUCTION_URL?.trim().replace(/\/$/u, "") || PRODUCTION_BASE_URL;

export const shouldRunProductionSmoke = (): boolean =>
  process.env.E2E_RUN_PRODUCTION === "1" || process.env.CI === "true";
