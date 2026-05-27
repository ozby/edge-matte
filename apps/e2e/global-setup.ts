import { startLocalE2EServer, stopLocalE2EServer } from './src/test-harness'

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (process.env.E2E_BASE_URL?.trim()) {
    return async () => undefined
  }
  const server = await startLocalE2EServer()
  return async () => {
    await stopLocalE2EServer(server)
  }
}
