---
type: research
title: Strict agent-kit toolchain cross-repo verification
status: completed
owner: worker-3
created: 2026-06-03
last_updated: 2026-06-03
---

# Strict agent-kit toolchain cross-repo verification

Scope: worker-3 lane only — ingest-lens enforcement-only verification sweep plus final cross-repo verification evidence gathered from the edge-matte team worktrees.

## Summary

- `edge-matte` local MCP-first pretool guard coverage passes, including the explicit `no-first-party-mjs` deny route.
- `ingest-lens` remains enforcement-only for zero first-party `.mjs` files: `git ls-files '*.mjs'` returns zero tracked files.
- `ingest-lens` currently has two verification blockers on the active `codex/strict-agent-kit-toolchain` branch:
  1. `pnpm audit:no-first-party-mjs` fails because the installed `wp` CLI reports `Unknown audit kind: no-first-party-mjs`.
  2. `pnpm test` fails because `vitest` is not resolvable from the local install, so `vitest.config.ts` cannot load.
- `ingest-lens` lint passes.
- `ingest-lens` typecheck did not complete within a 20 second timeout and repeatedly re-entered `wp typecheck` after the Webpresso auto-install notice, so it is treated as blocked pending toolchain investigation.
- At capture time, worker-1 and worker-2 had not yet produced lane-specific diffs in their team worktrees, so cross-repo verification here covers current observable repo state plus worker-3 lane evidence only.

## Evidence

### edge-matte: MCP-first guard regression coverage

Command:

```sh
node --test test/mcp-first-pretool-guard.test.ts
```

Result:

- PASS — 10/10 tests passed.
- Includes `denies new no-first-party-mjs audit commands in favor of wp_audit MCP`.
- Includes delegate fallback proof for `wp-pretool-guard` when no local deny applies.

### ingest-lens: zero first-party `.mjs` baseline

Command:

```sh
git ls-files '*.mjs'
```

Result:

- PASS — no tracked first-party `.mjs` files.
- Output count: `0`.

This matches the enforcement-only blueprint note in `blueprints/in-progress/surface-test-traceability-hardening/_overview.md`.

### ingest-lens: lint

Command:

```sh
pnpm -s lint
```

Result:

- PASS — `lint passed via vp lint`.

### ingest-lens: no-first-party-mjs audit surface

Command:

```sh
pnpm -s audit:no-first-party-mjs
```

Result:

- FAIL — `wp` reports `Unknown audit kind: no-first-party-mjs`.
- The package script exists in `package.json`, but the locally installed audit surface does not yet recognize the kind.

### ingest-lens: tests

Command:

```sh
pnpm -s test
```

Result:

- FAIL — startup error while loading `vitest.config.ts`.
- `vitest/config` cannot be resolved, and the runtime reports `ERR_MODULE_NOT_FOUND` for package `vitest`.
- `package.json` currently does not list `vitest` in `devDependencies`.

### ingest-lens: typecheck

Command:

```sh
timeout 20s pnpm -s check-types
```

Result:

- FAIL/TIMEOUT — repeated `webpresso 0.0.0 → 0.26.1 available` / `$ wp typecheck ⊘ cache disabled` loop until timeout.
- Exit code: `124`.
- This needs toolchain investigation before the lane can be called fully green.

## Cross-repo lane-state snapshot

Observed at capture time:

- `edge-matte` worker-1 team worktree: no diff yet.
- `edge-matte` worker-2 team worktree: no diff yet.
- `ingest-lens` active branch for this sweep: `codex/strict-agent-kit-toolchain`.

Because the other worker lanes had not yet produced observable team-worktree output, this note is the current durable evidence set for worker-3's assigned verification scope and the present cross-repo state.
