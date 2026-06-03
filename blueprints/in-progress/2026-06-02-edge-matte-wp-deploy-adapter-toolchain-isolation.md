---
type: blueprint
title: "EdgeMatte: wp deploy adapter + toolchain isolation"
owner: ozby
status: in-progress
complexity: M
created: "2026-06-02"
last_updated: "2026-06-03"
progress: "Reality check (2026-06-03): `agent-kit.config.ts` already points at `scripts/agent-kit-deploy-adapter.ts`, and root deploy verbs already call `wp deploy`. Remaining work is repo-local tool ownership cleanup (`@playwright/test`, `oxlint`, other direct tool surfaces), redundant overlay removal, and final dry-run / audit proof."
review_target: internal multi-repo platform work
depends_on:
  - 2026-05-29-edge-matte-shared-cloudflare-deploy-contract
  - "webpresso/agent-kit: 2026-06-02-agent-kit-wp-deploy-orchestrator-toolchain-isolation"
tags:
  - edge-matte
  - agent-kit
  - wp-deploy
  - toolchain-isolation
  - cloudflare
  - deploy-adapter
---

# EdgeMatte: wp deploy adapter + toolchain isolation

**Goal:** Move EdgeMatte from direct Wrangler/test/tool scripts onto the
agent-kit-owned toolchain and `wp deploy` orchestrator, while preserving its
current route/assets/R2/images contract and its production smoke + e2e gates.
EdgeMatte's existing preview/production deploy scripts become a small
consumer-owned **deploy adapter**; provider plumbing stays in EdgeMatte, not in
agent-kit.

Upstream: `webpresso/agent-kit/blueprints/in-progress/2026-06-02-agent-kit-wp-deploy-orchestrator-toolchain-isolation.md`.
This blueprint **extends** the existing in-progress
`2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md` lane (which already
landed custom-domain preview lanes matching IngestLens on 2026-06-02); it does
not replace it. Keep the same locked ownership boundary: agent-kit is the only
shared-policy upstream in scope; the Cloudflare/Pulumi helper stays private.

## Product wedge anchor

- **Stage outcome:** Prove the agent-kit toolchain/deploy contract works for an
  existing live product without regressing it — the second reference consumer in
  the workspace extraction model (agent-kit-only axis).
- **Consuming surface:** EdgeMatte's existing `edge-matte.ozby.dev` deploy lanes,
  re-driven through `wp deploy --lane preview_main|preview_pr_<n>|prd`.
- **New user-visible capability:** the same EdgeMatte background-removal product
  ships through agent-kit-owned tooling with no direct Wrangler/test-tool deps,
  with its route/assets/R2/images contract and smoke/e2e gates intact.

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

## Provenance

Recovered 2026-06-03 from the 2026-06-02 "Strict Agent-Kit Dogfood Across
ozby.dev, edge-matte, and ingest-lens" plan-reviewer transcript (`6e82eaf1…`,
13:50). Never previously saved to a file.

## Architecture before

EdgeMatte uses direct Wrangler/test/tool package scripts. Custom-domain preview
lanes (`main → preview_main`, PR → `preview_pr_<n>`) already landed via the
deploy-contract blueprint; production is release-gated. Toolchain (vitest,
wrangler, playwright, stryker, oxlint) is consumed partly directly.

## Architecture after

```text
edge-matte
  ├── direct tool scripts removed; all dev verbs go through wp (agent-kit-owned tools)
  ├── agent-kit.config.ts deploy.adapterModule -> consumer deploy adapter
  │     adapter wraps existing preview/production deploy steps
  │     preserves route/assets/R2/images contract + production smoke/e2e
  └── wp deploy --lane preview_main|preview_pr_<n>|prd  (orchestrator)
      cloudflare-deploy-contract verification preserved
```

## Key Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Deploy scripts | Convert preview/production scripts into a consumer deploy adapter behind `deploy.adapterModule`. | Provider plumbing stays consumer-owned (`extraction-parity.md` §5). |
| Toolchain | Replace direct Wrangler/test/tool scripts with `wp` commands using agent-kit-owned tools. | Toolchain-isolation model from the upstream blueprint. |
| Contract preservation | Keep route/assets/R2/images contract, production smoke + e2e gates, and `cloudflare-deploy-contract` verification. | EdgeMatte is a live private-beta product; no behavior regression. |
| Lane IDs | `preview_main`, `preview_pr_<n>`, `prd` (underscores). | Canonical internal lane IDs. |

## Quick Reference (Execution Waves)

| Wave | Tasks | Dependencies | Parallelizable |
| ---- | ----- | ------------ | -------------- |
| **Wave 0** | 1.1 | adapter wiring already landed in the repo | 1 agent |
| **Wave 1** | 2.1, 2.2 | 1.1 | 2 agents |
| **Critical path** | 1.1 → 2.2 | — | cleanup + proof remain |

### Phase 1: Adapter extraction [Complexity: M]

#### [infra] Task 1.1: Consumer deploy adapter from existing scripts

**Status:** in_progress

`agent-kit.config.ts` already points at `scripts/agent-kit-deploy-adapter.ts`. The remaining work in this task is closeout proof: confirm the ordered DeployPlan still preserves the custom-domain preview lanes, production gate, and dry-run behavior.

**Acceptance:**

- [ ] Adapter exposes preview_main / preview_pr_<n> / prd steps
- [ ] `wp deploy --lane prd --dry-run` plans without secrets
- [ ] `cloudflare-deploy-contract` verification still passes
- [ ] Route/assets/R2/images contract unchanged

### Phase 2: Toolchain isolation + gates [Complexity: M]

#### [qa] Task 2.1: Replace direct tool scripts with wp verbs

**Status:** in_progress

Root deploy/QA verbs already use `wp`, but direct repo-local tool ownership still remains in package manifests and overlays. This task closes that cleanup without regressing the live product contract.

**Acceptance:**

- [ ] `wp typecheck && wp lint && wp test && wp e2e` green via agent-kit-owned tools
- [ ] Direct Wrangler/vitest/playwright/stryker/oxlint scripts removed
- [ ] Production smoke + e2e gates preserved

#### [qa] Task 2.2: Toolchain-isolation audit

**Status:** todo

The upstream audit surface exists. Run it after Task 2.1 cleanup and capture the dry-run/audit evidence needed to close the lane truthfully.

**Acceptance:**

- [ ] `wp audit toolchain-isolation` passes
- [ ] Lockfile shows forbidden tools only as transitive deps of `@webpresso/agent-kit`

## Verification Gates

| Gate | Command | Success Criteria |
| ---- | ------- | ---------------- |
| Type safety | `wp typecheck` | Zero errors |
| Lint | `wp lint` | Zero violations |
| Tests | `wp test` | All pass |
| E2E | `wp e2e` | Production smoke + journey pass |
| Deploy plan | `wp deploy --lane prd --dry-run` | Plans without secrets |
| Isolation | `wp audit toolchain-isolation` | Passes |

## Assumptions

- EdgeMatte's product behavior (route/assets/R2/images, smoke/e2e) is unchanged.
- The Cloudflare/Pulumi helper stays private; no public promotion in this lane.
- agent-kit remains the only shared-policy upstream in scope (no gstack/OMX).
