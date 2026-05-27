import {
  listE2ESuites,
  normalizeE2EPath,
  resolveE2ESuiteForFile,
  resolveE2ESuiteId,
  type E2ESuiteDefinition,
} from './e2e-suite-manifest'

type E2eExecutionRequest = {
  suite?: string
  file?: readonly string[]
}

type E2ePlanRun = {
  suiteId: string
  batchKey: string
  runner: 'command'
  logName: string
  command: string
  args: string[]
}

type E2eExecutionBatch = {
  batchKey: string
  runs: E2ePlanRun[]
}

function rootifySuites(): readonly E2ESuiteDefinition[] {
  return listE2ESuites().map((suite) => ({
    ...suite,
    fileMatchers: suite.fileMatchers.map(normalizeE2EPath),
    steps: suite.steps.map((step) => ({
      ...step,
      configPath: step.configPath ? normalizeE2EPath(step.configPath) : undefined,
      fixedFiles: step.fixedFiles?.map(normalizeE2EPath),
    })),
  }))
}

export function buildExecutionPlan(request: E2eExecutionRequest): E2eExecutionBatch[] {
  const suiteId = request.suite ? resolveE2ESuiteId(request.suite) : null
  if (request.suite && !suiteId) {
    throw new Error(`Unknown e2e suite: ${request.suite}`)
  }

  const suites = suiteId
    ? rootifySuites().filter((suite) => suite.id === suiteId)
    : rootifySuites()

  return suites.map((suite) => ({
    batchKey: suite.batchKey,
    runs: suite.steps.map((step) => ({
      suiteId: suite.id,
      batchKey: step.batchKey ?? suite.batchKey,
      runner: 'command' as const,
      logName: step.logName,
      command: 'pnpm',
      args: [
        'exec',
        'vitest',
        'run',
        '--config',
        step.configPath ?? 'vitest.config.ts',
        ...(step.fixedFiles?.map((file) => file.replace(/^apps\/e2e\//u, '')) ?? []),
      ],
    })),
  }))
}

export const agentKitHostAdapter = {
  listSuites: rootifySuites,
  resolveSuiteId: resolveE2ESuiteId,
  normalizeFilePath: normalizeE2EPath,
  resolveSuiteForFile: (filePath: string) => {
    const normalizedPath = normalizeE2EPath(filePath)
    const suite = rootifySuites().find((candidate) =>
      candidate.fileMatchers.some((matcher) => normalizedPath.endsWith(matcher)),
    )
    return suite ? { normalizedPath, suiteId: suite.id } : null
  },
  buildExecutionPlan,
}

export default agentKitHostAdapter
