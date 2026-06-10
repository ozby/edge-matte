---
type: blueprint
title: "EdgeMatte: shared reusable deploy workflow adoption"
owner: ozby
status: planned
complexity: M
created: "2026-06-09"
last_updated: "2026-06-09"
progress: "0% (planned)"
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

# EdgeMatte: shared reusable deploy workflow adoption

**Goal:** Replace duplicated preview/production GitHub workflow shell logic with thin callers to the shared `agent-kit` reusable deploy harness while preserving current repo-local deploy scripts, custom-domain preview behavior, and release-gated production verification.

## Planning Summary

- Current repo already has working preview/prod workflows and deploy adapters.
- This lane should remove duplicated workflow shell only.
- Repo-specific verification, deploy, and smoke/e2e commands remain local.

## Governing architecture docs

This blueprint is bound by the repo deploy-architecture contract:

- `docs/architecture.contract.json` — the machine-checked deploy-contract
  surface enforced by `vp run verify:deploy-contract`.
- `docs/architecture.md` — the narrative hexagonal-core and deploy topology.

## Architecture before

- Preview and production deploys run from two hand-maintained workflow shells
  (`deploy-preview.yml`, `deploy-production.yml`) whose lane / branch / PR-close
  logic is duplicated inline in this repo.
- Deploy execution is adapter-backed (the `wp` deploy adapter) behind the
  `vp` + `wp` split; custom-domain preview lanes and release-gated production
  verification live entirely in repo-local scripts.
- Nothing is delegated to `agent-kit`: the workflow shell is owned and edited
  here, so shell fixes in the shared harness do not propagate to this repo.

## Architecture after

- `deploy-preview.yml` and `deploy-production.yml` become thin callers that
  `uses:` the shared `agent-kit` reusable deploy workflows by pinned SHA,
  passing the existing command payloads as inputs.
- Repo-local deploy / verify / smoke / e2e scripts, the `vp` + `wp` split,
  custom-domain preview transport, and the release-gated production flow are
  unchanged — only the duplicated workflow shell moves to the shared owner.
- Deploy-contract semantics stay anchored in `docs/architecture.contract.json`;
  the shared harness is consumed, not forked.

## Key Decisions

| Decision          | Choice                                 | Rationale                                                                    |
| ----------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Existing split    | preserve `vp` + `wp` split             | Current repo intentionally keeps that split and it is already verified.      |
| Preview transport | preserve custom-domain previews        | Current deploy contract already standardized on custom-domain preview lanes. |
| Production policy | preserve release-gated production flow | Existing live product checks are load-bearing and must not be weakened.      |

## Quick Reference (Execution Waves)

| Wave              | Tasks     | Dependencies | Parallelizable |
| ----------------- | --------- | ------------ | -------------- |
| **Wave 0**        | 1.1       | None         | 1 agent        |
| **Wave 1**        | 2.1       | Wave 0       | 1 agent        |
| **Critical path** | 1.1 → 2.1 | --           | 2 waves        |

### Phase 1: Thin caller migration [Complexity: M]

#### [infra] Task 1.1: Replace workflow shell with shared callers

**Status:** todo

**Depends:** None

Convert `deploy-preview.yml` and `deploy-production.yml` into thin callers that
delegate to `agent-kit` reusable workflows by pinned SHA while preserving the
current command payloads.

**Acceptance:**

- [ ] Preview caller still handles main push, PR deploy, manual lane, and PR close destroy
- [ ] Production caller still handles tag/manual release-gated flow
- [ ] Workflow shell duplication is removed

### Phase 2: Preserve live contract [Complexity: M]

#### [qa] Task 2.1: Re-verify deploy contract and production gates

**Status:** todo

**Depends:** Task 1.1

**Acceptance:**

- [ ] Existing deploy-contract checks remain green
- [ ] Preview deploy/destroy behavior remains unchanged
- [ ] Production smoke and production-journey gates still run and pass

## Verification Gates

| Gate                  | Command                         | Success Criteria |
| --------------------- | ------------------------------- | ---------------- |
| Type safety           | `wp typecheck`                  | Zero errors      |
| Lint                  | `wp lint`                       | Zero violations  |
| Deploy contract       | `vp run verify:deploy-contract` | Passes           |
| Blueprint/docs checks | current repo audit surface      | Passes           |

## Cross-Plan References

| Type     | Blueprint                                                     | Relationship                                                 |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Upstream | `agent-kit: reusable Cloudflare deploy workflows`             | Shared workflow shell owner                                  |
| Upstream | `2026-05-29-edge-matte-shared-cloudflare-deploy-contract`     | Local deploy semantics and preview transport source of truth |
| Upstream | `2026-06-02-edge-matte-wp-deploy-adapter-toolchain-isolation` | Existing adapter-backed deploy baseline                      |

## Non-goals

- Changing preview domain names
- Replacing repo-local preview/prod scripts
- Relaxing any current production verification gate
