---
type: blueprint
title: "EdgeMatte: shared reusable deploy workflow alignment cleanup"
owner: ozby
status: completed
historical_zero_task_waiver: true
historical_zero_task_rationale: "Historical completed alignment record predates strict task-block tracking; implementation and evidence remain preserved below."
complexity: S
created: "2026-06-09"
last_updated: "2026-06-11"
progress: "100% (completed 2026-06-11)"
depends_on:
  - 2026-05-29-edge-matte-shared-cloudflare-deploy-contract
  - 2026-06-02-edge-matte-wp-deploy-adapter-toolchain-isolation
tags:
  - edge-matte
  - agent-kit
  - github-actions
  - cloudflare
  - deploy
---

# EdgeMatte: shared reusable deploy workflow alignment cleanup

**Goal:** Close the stale planning/docs loop after the shared reusable deploy
workflow callers already landed, without disturbing the separate in-progress
lanes that still own production proof and E2E confidence work.

## Completion summary

- Updated README / CONTRIBUTING bootstrap guidance to the current repo-local
  `vp install` + `pnpm exec wp ...` contract.
- Replaced the stale future-adoption blueprint with a truthful completed cleanup
  record.
- Left the real remaining work in the existing in-progress deploy-contract,
  audit-remediation, and E2E-confidence blueprints.

## Acceptance

- [x] Bootstrap/operator docs are current.
- [x] No blueprint still claims future first-time shared workflow adoption.
- [x] Parked and in-progress items keep their separate blocker semantics.
- [x] Cleanup scope stays bounded to truth-state alignment.

## Verification

- `wp lint`
- `wp typecheck`
- `wp test --file vitest.config.ts`
- `wp audit blueprint-lifecycle`
- `vp run verify:deploy-contract`
