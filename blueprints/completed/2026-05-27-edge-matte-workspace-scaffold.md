---
type: blueprint
title: "EdgeMatte: workspace scaffold and runtime skeleton"
status: completed
created: 2026-05-27
review_target: public GitHub repository
parent_blueprint: 2026-05-27-edge-matte
---

# EdgeMatte: workspace scaffold and runtime skeleton

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

This blueprint implements the existing architecture contract; it does not change
product shape.

## Architecture before

The repo currently contains architecture, research, governance, and one
high-level implementation blueprint, but no executable workspace or app
skeleton.

## Architecture after

The repo has a runnable TypeScript workspace with Worker/client package
boundaries, Wrangler config, agent-kit/vite-plus quality scripts, and the file
layout needed for the architecture in `docs/architecture.md`.

## Objective

Create the minimum production-minded workspace skeleton so implementation can
start without revisiting repo structure decisions.

## TDD contract

Even the scaffold is test-first. Add failing checks for workspace topology,
script presence, and E2E manifest wiring before filling in the scaffold.

## Gap addressed

Current architecture assumes package/app layout, scripts, and runtime config that
are not on disk yet. That missing substrate is the first delivery blocker.

## Primary outputs

- root workspace metadata and scripts
- Worker/client app directories with hello-world build surfaces
- Wrangler + TypeScript baseline config
- agent-kit/vite-plus quality surface wiring

## Write scope

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `agent-kit.config.ts`
- `wrangler.toml`
- `apps/client/*`
- `apps/worker/*`
- quality/test config files

## Not in scope

- provider integration
- image processing logic
- polished UI states
- production deploy workflow

## Tasks

1. Write failing checks first for root scripts, workspace package discovery, and required config file presence.
2. Create root workspace/package metadata and `vp`/`wp` scripts.
3. Write failing checks for app boundaries, test config resolution, and E2E manifest/host-adapter wiring.
4. Add Worker and client app directories with minimal build/test entrypoints.
5. Add Wrangler config for Worker + static assets.
6. Add TypeScript base config and generated Worker types path.
7. Add agent-kit config, optional `wp setup` hook scripts, and docs/blueprint audit scripts (global `wp` on PATH — no `@webpresso/agent-kit` in root `package.json`).
8. Add local secret documentation placeholders (no on-disk secret files: no `.dev.vars*` or `.env*` except `.env.example`).

## Acceptance criteria

- `vp install` succeeds without GitHub Packages auth (public workspace deps only).
- Global `wp` and `vp` are documented prerequisites for audits and workspace script routing.
- `vp run build`, `vp run lint`, `vp run check-types`, and `vp run test` have valid script targets.
- `wrangler.toml` declares `ASSETS` and production route shape for `edge-matte.ozby.dev`.
- The scaffold includes test surfaces before feature work: Worker, client, and E2E manifest/host-adapter stubs are executable or intentionally failing in the expected way.
- Workspace layout matches the architecture doc and does not force later file moves.
- No private/company-specific identifiers are introduced.
- Secret onboarding/docs enforce secret-provider-only usage (no `.dev.vars*` / `.env*` persisted to disk, except `.env.example`).
- Stop condition: the next blueprint can start without changing repo topology first.

## Execution checklist

- [x] Add failing checks for workspace/package/config discovery.
- [x] Make `vp install` succeed.
- [x] Make `vp run build`, `vp run lint`, `vp run check-types`, and `vp run test` resolvable.
- [x] Add Worker/client/E2E skeleton boundaries.
- [x] Add Wrangler + TypeScript + agent-kit/vite-plus baseline wiring.
- [x] Add secret onboarding docs without prohibited local secret files.
- [x] Run architecture drift check.

Exact stop condition:

- Stop only when the next blueprint can add behavior without moving files,
  renaming packages, or reworking the basic runtime/test topology.

## Test design

### Unit tests

- script/config helper tests for workspace discovery and command resolution;
- pure config-shape tests for generated path helpers and package metadata guards;
- secret-doc validation helpers to ensure prohibited local secret files are not required.

### Integration tests

- workspace bootstrap test: install/build/test commands resolve from a clean clone shape;
- config integration test: Wrangler, TypeScript, agent-kit, and E2E host-adapter files resolve together;
- audit integration test: docs/blueprint/secret guardrails execute through repo-owned commands.

### Strict confidence checks

- fail if any required root script is missing or points to a non-existent surface;
- fail if Worker/client/E2E directories exist but cannot be discovered by the configured tools;
- fail if secret onboarding implies `.dev.vars*` or `.env*` usage beyond `.env.example`.

## Parallel execution waves

### Wave 1 — independent red tests and root skeleton

| Task ID | Task                                                 | Depends on | Write scope            |
| ------- | ---------------------------------------------------- | ---------- | ---------------------- |
| WS-1    | Add failing checks for root scripts/config discovery | none       | root test/config files |
| WS-2    | Add failing checks for app/E2E topology discovery    | none       | root test/config files |
| WS-3    | Draft bootstrap/secret onboarding docs               | none       | `README.md`, docs      |

### Wave 2 — independent scaffold implementation

| Task ID | Task                                            | Depends on | Write scope                          |
| ------- | ----------------------------------------------- | ---------- | ------------------------------------ |
| WS-4    | Add root workspace/package metadata and scripts | WS-1       | root config files                    |
| WS-5    | Add Worker/client directory skeletons           | WS-2       | `apps/worker/**`, `apps/client/**`   |
| WS-6    | Add E2E skeleton + host-adapter/config wiring   | WS-2       | `apps/e2e/**`, `agent-kit.config.ts` |

### Wave 3 — merge and verify

| Task ID | Task                                                        | Depends on       | Write scope                   |
| ------- | ----------------------------------------------------------- | ---------------- | ----------------------------- |
| WS-7    | Finalize Wrangler + TypeScript + shared config wiring       | WS-4, WS-5, WS-6 | root config + `wrangler.toml` |
| WS-8    | Run install/build/test/guardrail verification and fix drift | WS-3, WS-7       | repo-wide verification/docs   |

Parallelization notes:

- `WS-4`, `WS-5`, and `WS-6` may run in parallel once their failing checks exist.
- `WS-7` is a merge lane and should be owned by one agent.

## Verification

```bash
vp install
vp run lint
vp run check-types
vp run test
vp run build
wp audit agents
wp audit guardrails
python3 scripts/check_architecture_drift.py
```

## Completion notes

Completed 2026-05-27. Local verification passed (build, lint, typecheck, tests, smoke, upload-delete E2E, architecture drift). Production deploy to `https://edge-matte.ozby.dev` and post-deploy `production-smoke` remain pending a CI fix.
