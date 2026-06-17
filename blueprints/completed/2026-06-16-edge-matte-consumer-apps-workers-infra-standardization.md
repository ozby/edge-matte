---
type: blueprint
title: "EdgeMatte: consumer apps/workers + infra standardization"
owner: ozby
status: completed
complexity: M
created: "2026-06-16"
last_updated: "2026-06-16"
progress: "100% (completed 2026-06-16)"
depends_on:
  - 2026-05-29-edge-matte-shared-cloudflare-deploy-contract
  - 2026-06-02-edge-matte-wp-deploy-adapter-toolchain-isolation
  - 2026-06-09-edge-matte-shared-reusable-deploy-workflow-alignment
tags:
  - edge-matte
  - standardization
  - workspace
  - workers
  - infra
  - deploy
---

# EdgeMatte: consumer apps/workers + infra standardization

**Goal:** Truthfully close the standardization bookkeeping lane once the repo's
shared `apps/client` + `apps/workers` + `infra` shape is already present and
the sibling `ozby-dev` closeout blocker is resolved.

## Completion summary

- Confirmed the branch at `d653a03` already matches the intended consumer
  standard: `apps/client`, `apps/workers`, and `infra`, with deploy helpers
  owned by `infra/src/deploy/**`.
- Kept the package identity `@edge-matte/worker` unchanged.
- No product/runtime code changes were required for this closeout lane; only the
  blueprint lifecycle record was stale.
- Closed the bookkeeping loop after the sibling `ozby-dev` deploy PATH
  regression was fixed and verified.

## Acceptance

- [x] EdgeMatte keeps `apps/workers` and `infra/src/deploy/**` as the standard
      layout.
- [x] `@edge-matte/worker` remains the package identity.
- [x] No runtime behavior changes were introduced in this closeout lane.
- [x] Blueprint lifecycle state reflects the actual branch truth.

## Verification

- `pnpm run blueprints:check`
