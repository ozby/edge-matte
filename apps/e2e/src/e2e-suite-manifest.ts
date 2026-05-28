export interface E2ESuiteStep {
  runner: "vitest" | "playwright" | "command";
  logName: string;
  configPath?: string;
  fixedFiles?: readonly string[];
  batchKey?: string;
}

export interface E2ESuiteDefinition {
  id: string;
  aliases?: readonly string[];
  fileMatchers: readonly string[];
  batchKey: string;
  steps: readonly E2ESuiteStep[];
}

const SMOKE_FILES = ["journeys/smoke.smoke.test.ts"] as const;
const UPLOAD_DELETE_BROWSER_FILES = ["journeys/upload-delete.spec.ts"] as const;
const UPLOAD_DELETE_CONTRACT_FILES = ["journeys/upload-delete.contract.test.ts"] as const;
const PRODUCTION_SMOKE_FILES = ["journeys/production-smoke.smoke.test.ts"] as const;
const PRODUCTION_JOURNEY_FILES = ["journeys/production-journey.smoke.test.ts"] as const;

const E2E_SUITES: readonly E2ESuiteDefinition[] = [
  {
    id: "smoke",
    aliases: ["health"],
    fileMatchers: SMOKE_FILES,
    batchKey: "smoke",
    steps: [
      {
        runner: "vitest",
        logName: "smoke",
        configPath: "vitest.journeys.config.ts",
        fixedFiles: SMOKE_FILES,
        batchKey: "smoke",
      },
    ],
  },
  {
    id: "upload-delete",
    aliases: ["browser", "upload"],
    fileMatchers: UPLOAD_DELETE_BROWSER_FILES,
    batchKey: "upload-delete",
    steps: [
      {
        runner: "playwright",
        logName: "upload-delete-browser",
        configPath: "playwright.config.ts",
        fixedFiles: UPLOAD_DELETE_BROWSER_FILES,
        batchKey: "upload-delete",
      },
    ],
  },
  {
    id: "upload-delete-contract",
    aliases: ["contract", "api-upload"],
    fileMatchers: UPLOAD_DELETE_CONTRACT_FILES,
    batchKey: "upload-delete-contract",
    steps: [
      {
        runner: "vitest",
        logName: "upload-delete-contract",
        configPath: "vitest.journeys.config.ts",
        fixedFiles: UPLOAD_DELETE_CONTRACT_FILES,
        batchKey: "upload-delete-contract",
      },
    ],
  },
  {
    id: "production-smoke",
    aliases: ["production", "prod-smoke"],
    fileMatchers: PRODUCTION_SMOKE_FILES,
    batchKey: "production-smoke",
    steps: [
      {
        runner: "vitest",
        logName: "production-smoke",
        configPath: "vitest.journeys.config.ts",
        fixedFiles: PRODUCTION_SMOKE_FILES,
        batchKey: "production-smoke",
      },
    ],
  },
  {
    id: "production-journey",
    aliases: ["prod-journey"],
    fileMatchers: PRODUCTION_JOURNEY_FILES,
    batchKey: "production-journey",
    steps: [
      {
        runner: "vitest",
        logName: "production-journey",
        configPath: "vitest.journeys.config.ts",
        fixedFiles: PRODUCTION_JOURNEY_FILES,
        batchKey: "production-journey",
      },
    ],
  },
];

export function listE2ESuites(): readonly E2ESuiteDefinition[] {
  return E2E_SUITES;
}

export function resolveE2ESuiteId(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  const match = E2E_SUITES.find(
    (suite) =>
      suite.id === normalized || suite.aliases?.some((alias) => alias.toLowerCase() === normalized),
  );
  return match?.id ?? null;
}

export function normalizeE2EPath(filePath: string): string {
  const normalized = filePath.replace(/\\/gu, "/");
  if (normalized.startsWith("apps/e2e/")) return normalized;
  if (normalized.startsWith("journeys/")) return `apps/e2e/${normalized}`;
  return normalized;
}

export function resolveE2ESuiteForFile(
  filePath: string,
): { normalizedPath: string; suiteId: string } | null {
  const normalizedPath = normalizeE2EPath(filePath);
  const suite = E2E_SUITES.find((candidate) =>
    candidate.fileMatchers.some((matcher) => normalizedPath.endsWith(matcher)),
  );
  if (!suite) return null;
  return { normalizedPath, suiteId: suite.id };
}
