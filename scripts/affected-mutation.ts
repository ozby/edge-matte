#!/usr/bin/env bun
import path from "node:path";
import { pathToFileURL } from "node:url";

const entryPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../node_modules/@webpresso/agent-kit/dist/esm/mutation/affected.js",
);
const { runAffectedMutation } = (await import(pathToFileURL(entryPath).href)) as {
  runAffectedMutation: () => 0 | 1;
};

process.exit(runAffectedMutation());
