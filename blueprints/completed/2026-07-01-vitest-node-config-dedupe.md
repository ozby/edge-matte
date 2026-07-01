---
type: blueprint
owner: ozby
title: "Vitest node config dedupe"
status: completed
complexity: S
created: "2026-07-01"
last_updated: "2026-07-01"
progress_pct: 100
progress: "Completed: matching node-only Vitest configs now delegate to @webpresso/agent-config/vitest/node; .test-reports is ignored for shared reporter output."
depends_on:
  - "@webpresso/agent-config/vitest/node"
completed_at: "2026-07-01"
---

# Vitest node config dedupe

## Status

Completed — migrated matching node-only Vitest config copies to the existing public Webpresso Vitest node preset.

## Problem

Several consumer packages keep the same local Vitest node boilerplate:

```ts
test: {
  environment: "node",
  include: ["src/**/*.test.ts"],
}
```

That behavior is already covered by the published `@webpresso/agent-config/vitest/node` surface, which is the consumer-facing shared config contract. Keeping the boilerplate in each repo invites config drift.

## Scope

- Replace matching node-only package Vitest configs with `nodeConfig` imports.
- Ignore `.test-reports/`, which is emitted by the shared Webpresso flakiness reporter.
- Leave custom React, Cloudflare Workers, root, and intentionally divergent configs alone in this wave.
- Do not add dependencies or introduce a new public package surface.

## Non-goals

- Do not change test source files.
- Do not force browser/Workers projects onto the node preset.
- Do not remove repo-specific include/exclude behavior where it differs from the default node package contract.

## Tasks

#### [dedupe] Task 1.1: Use the shared node Vitest preset

**Status:** done

**Depends:** None

- Replace matching local `defineConfig` node-only bodies with `export default nodeConfig`.
- Add `.test-reports/` to `.gitignore` so shared reporter output stays local-only.
- Keep the file as a thin package-local entry point so package runners still resolve config normally.

#### [qa] Task 1.2: Verify package and repo gates

**Status:** done

**Depends:** Task 1.1

- Run targeted Vitest suites for touched packages.
- Run typecheck, lint, tests, `wp audit tph`, and `wp sync --check` where available.

## Acceptance criteria

- Repeated node-only Vitest behavior is owned by `@webpresso/agent-config/vitest/node`.
- `.test-reports/` does not appear as untracked test noise after running migrated suites.
- No React, Workers, or divergent root configs are accidentally changed.
- Local gates and CI pass before merge.

## Verification evidence

- Targeted touched package Vitest suites passed.
- `wp sync --check` passed after local generated symlink repair.
- `wp audit blueprint-lifecycle` passed.
- `wp audit tph` passed.
- `vp run typecheck` passed.
- `vp run lint` passed.
- `vp run test` passed.
