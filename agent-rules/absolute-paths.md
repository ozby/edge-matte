---
title: Absolute repo paths for shared surfaces
scope: repo
---

# Absolute filesystem paths only

Never use hardcoded relative filesystem paths in code, scripts, runtime
launchers, or test/config wiring.

Forbidden patterns include:

- `resolve(import.meta.dirname, "../../..")`
- `resolve(import.meta.dirname, "./fixture.json")`
- `path.join(__dirname, "../../../..")`
- `path.join(process.cwd(), "./tmp")`
- `cwd: resolve(import.meta.dirname, "../..")`

Always derive an **absolute path** from an explicit anchor:

- repo root finder
- package root finder
- runtime-provided absolute base path

This rule applies to:

- local runtime launchers
- Playwright / Vitest / Wrangler config wiring
- repo-level scripts
- test helpers that read repo-owned files

This rule does **not** ban ordinary module import syntax such as
`import "./foo"` or `import "../bar"`. It bans brittle **filesystem path
resolution** in executable code and config.

Why:

- file moves break counted traversal silently
- monorepo/app relocations cause wrong-root bugs
- absolute anchors are easier to audit and reuse

Preferred shape:

```ts
import { findRepoRoot } from "#scripts/lib/find-repo-root.mjs";
import { join } from "node:path";

const repoRoot = findRepoRoot();
const configPath = join(repoRoot, "apps/e2e/global-setup.ts");
```
