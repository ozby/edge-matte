import { spawn } from "node:child_process";
import { ensureClientDist } from "./src/ensure-client-dist";

async function waitForHealth(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for local e2e server health at ${baseUrl}/health`);
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (process.env.E2E_BASE_URL?.trim() || process.env.E2E_RUN_PRODUCTION === "1") {
    return async () => undefined;
  }

  await ensureClientDist();

  const port = process.env.E2E_LOCAL_PORT?.trim() || "4173";
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn("bun", ["./src/cli/start-local-e2e-server.ts"], {
    cwd: import.meta.dirname,
    stdio: "inherit",
    env: { ...process.env, E2E_LOCAL_PORT: port },
  });

  await waitForHealth(baseUrl, 120_000);

  return async () => {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    });
  };
}
