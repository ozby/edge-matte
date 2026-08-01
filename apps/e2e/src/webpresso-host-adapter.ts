import {
  listE2ESuites,
  normalizeE2EPath,
  resolveE2ESuiteId,
  type E2ESuiteDefinition,
  type E2ESuiteStep,
} from "./e2e-suite-manifest.ts";

type E2eExecutionRequest = {
  suite?: string;
  file?: readonly string[];
};

type E2ePlanRun = {
  suiteId: string;
  batchKey: string;
  runner: E2ESuiteStep["runner"];
  logName: string;
  command: string;
  args: string[];
};

type E2eExecutionBatch = {
  batchKey: string;
  runs: E2ePlanRun[];
};

function normalizeE2EConfigPath(configPath: string): string {
  const normalized = configPath.replace(/\\/gu, "/");
  if (normalized.startsWith("apps/e2e/")) return normalized;
  return `apps/e2e/${normalized.replace(/^\.?\//u, "")}`;
}

function rootifySuites(): readonly E2ESuiteDefinition[] {
  return listE2ESuites().map((suite) => ({
    ...suite,
    fileMatchers: suite.fileMatchers.map(normalizeE2EPath),
    steps: suite.steps.map((step) => ({
      ...step,
      configPath: step.configPath ? normalizeE2EConfigPath(step.configPath) : undefined,
      fixedFiles: step.fixedFiles?.map(normalizeE2EPath),
    })),
  }));
}

function buildCommand(step: E2ESuiteStep): { command: string; args: string[] } {
  const files = step.fixedFiles ?? [];

  switch (step.runner) {
    case "vitest":
      return {
        command: "vp",
        args: [
          "exec",
          "--workspace-root",
          "--",
          "vitest",
          "run",
          "--config",
          step.configPath ?? "apps/e2e/vitest.config.ts",
          ...files,
        ],
      };
    case "playwright":
      return {
        command: "vp",
        args: [
          "exec",
          "--workspace-root",
          "--",
          "playwright",
          "test",
          "--config",
          step.configPath ?? "apps/e2e/playwright.config.ts",
          ...files,
        ],
      };
    case "command":
      throw new Error("Manifest command steps are not supported by the host adapter.");
    default: {
      const _exhaustive: never = step.runner;
      throw new Error(`Unsupported e2e runner: ${_exhaustive}`);
    }
  }
}

export function buildExecutionPlan(request: E2eExecutionRequest): E2eExecutionBatch[] {
  const suiteId = request.suite ? resolveE2ESuiteId(request.suite) : null;
  if (request.suite && !suiteId) {
    throw new Error(`Unknown e2e suite: ${request.suite}`);
  }

  const suites = suiteId
    ? rootifySuites().filter((suite) => suite.id === suiteId)
    : rootifySuites();

  return suites.map((suite) => ({
    batchKey: suite.batchKey,
    runs: suite.steps.map((step) => {
      const command = buildCommand(step);
      return {
        suiteId: suite.id,
        batchKey: step.batchKey ?? suite.batchKey,
        runner: step.runner,
        logName: step.logName,
        ...command,
      };
    }),
  }));
}

export const agentKitHostAdapter = {
  listSuites: rootifySuites,
  resolveSuiteId: resolveE2ESuiteId,
  normalizeFilePath: normalizeE2EPath,
  resolveSuiteForFile: (filePath: string) => {
    const normalizedPath = normalizeE2EPath(filePath);
    const suite = rootifySuites().find((candidate) =>
      candidate.fileMatchers.some((matcher) => normalizedPath.endsWith(matcher)),
    );
    return suite ? { normalizedPath, suiteId: suite.id } : null;
  },
  buildExecutionPlan,
};

export default agentKitHostAdapter;
