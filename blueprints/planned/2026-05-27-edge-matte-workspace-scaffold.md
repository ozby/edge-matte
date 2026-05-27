---
type: blueprint
title: "EdgeMatte: workspace scaffold and runtime skeleton"
status: planned
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
- `.dev.vars.example`
- quality/test config files

## Not in scope

- provider integration
- image processing logic
- polished UI states
- production deploy workflow

## Tasks

1. Create root workspace/package metadata and `vp`/`wp` scripts.
2. Add Worker and client app directories with minimal build/test entrypoints.
3. Add Wrangler config for Worker + static assets.
4. Add TypeScript base config and generated Worker types path.
5. Add agent-kit config, postinstall/setup hooks, and docs/blueprint audit scripts.
6. Add `.dev.vars.example` and local secret documentation placeholders.

## Acceptance criteria

- `pnpm install` succeeds.
- `pnpm build`, `pnpm lint`, `pnpm check-types`, and `pnpm test` have valid script targets.
- `wrangler.toml` declares `ASSETS` and production route shape for `edge-matte.ozby.dev`.
- Workspace layout matches the architecture doc and does not force later file moves.
- No private/company-specific identifiers are introduced.
- Stop condition: the next blueprint can start without changing repo topology first.

## Verification

```bash
pnpm install
pnpm lint
pnpm check-types
pnpm test
pnpm build
python3 scripts/check_architecture_drift.py
```
