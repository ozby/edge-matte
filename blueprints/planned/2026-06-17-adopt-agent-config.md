---
type: blueprint
title: "Adopt @webpresso/agent-config (migrate config specifiers)"
owner: ozby
status: planned
complexity: S
created: '2026-06-17'
last_updated: '2026-06-17'
progress: '0% (planned — BLOCKED on agent-kit major publish)'
depends_on: []
cross_repo_depends_on:
  - 'webpresso/agent-kit: 2026-06-17-extract-agent-config-package'
tags:
  - dependencies
  - config
  - agent-kit
  - migration
max_parallel_agents: 1
---

# Adopt `@webpresso/agent-config` (migrate config specifiers)

**Goal:** Switch this repo's `@webpresso/agent-kit/<config>` specifiers to
`@webpresso/agent-config/<config>` after the config package is extracted and a new
agent-kit major is published. Keep `@webpresso/agent-kit` (still consumed via the
`wp` CLI + test surface).

> **BLOCKED:** depends on `webpresso/agent-kit` publishing `@webpresso/agent-config`
> + the agent-kit major. Do not merge until both resolve from the registry.

## Product wedge anchor

- **Stage outcome:** open-sourcing roadmap — edge-matte is the agent-kit-only
  reference consumer (no framework facade). It proves the config package works for a
  consumer that uses agent-kit purely as dev toolchain + governance.
- **Consuming surface:** `stryker.config.ts`, `apps/workers/stryker.config.ts`, and
  any `vitest`/`tsconfig` config references.
- **New user-visible capability:** config imports name the config package.

## Migration surface (verified 2026-06-17, ~3 references)

Rewrite `@webpresso/agent-kit/<g>` → `@webpresso/agent-config/<g>`:
- `stryker.config.ts` (`baseConfig`)
- `apps/workers/stryker.config.ts` (`typescriptWorkersBaseConfig`)
- any `vitest`/`tsconfig` config references discovered at migration time.

**Leave untouched:** `agent-kit.config.ts` (CLI config file) and the
`@webpresso/agent-kit/vitest/*` / `/stryker` test-surface imports are exactly what
moves — confirm each maps to a moved group before rewriting.

## Tasks

#### [deps] Task 1: Add `@webpresso/agent-config` to the catalog
**Status:** todo **Depends:** agent-kit major published
**Files:** `pnpm-workspace.yaml` (catalog), root `package.json` (devDependency); bump
`@webpresso/agent-kit` pin to the new major.
**Acceptance:** [ ] both resolve [ ] `pnpm install` clean.

#### [config] Task 2: Rewrite specifiers
**Status:** todo **Depends:** 1
**Files:** `stryker.config.ts`, `apps/workers/stryker.config.ts`, + any vitest/tsconfig refs.
**Acceptance:** [ ] specifiers rewritten [ ] `agent-kit.config.ts` untouched [ ] `pnpm -r check-types && pnpm -r test` green [ ] `wp audit` clean.

## Verification

Run inside this repo: `pnpm -r check-types && pnpm -r test`; `wp audit`. Wait for
full CI before admin-merge.
