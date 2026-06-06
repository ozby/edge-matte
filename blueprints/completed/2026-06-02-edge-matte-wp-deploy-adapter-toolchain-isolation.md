---
type: blueprint
title: "EdgeMatte: wp deploy adapter + toolchain isolation"
owner: ozby
status: completed
complexity: M
created: "2026-06-02"
last_updated: "2026-06-04"
progress: "100% (completed 2026-06-04. Repo-local closure required one real adapter fix: preview lanes now map from internal `preview_main` / `preview_pr_<n>` ids to the existing hyphenated preview deploy script, and preview dry-runs validate generated Wrangler config without publishing. The upstream `wp` toolchain-isolation/audit surfaces pass as-is; repo-local authoring deps (`typescript`, `vitest`, `@playwright/test`) remain intentionally installed because the repo imports them directly.)"
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
agent-kit-owned generic toolchain runtime and `wp deploy` orchestrator, while
preserving its current route/assets/R2/images contract and its production smoke

- e2e gates. This is the **global `wp` + required `wp setup`** contract, not a
  zero-install or "no repo-local package" contract: EdgeMatte still keeps root
  `@webpresso/agent-kit` where the repo imports its shared config/test subpaths.
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
  ships through agent-kit-owned tooling with global `wp` surfaces while keeping
  required root shared-package imports, with its route/assets/R2/images
  contract and smoke/e2e gates intact.

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

| Decision              | Choice                                                                                                             | Rationale                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Deploy scripts        | Convert preview/production scripts into a consumer deploy adapter behind `deploy.adapterModule`.                   | Provider plumbing stays consumer-owned (`extraction-parity.md` §5).                                                                  |
| Toolchain             | Replace direct Wrangler/test/tool scripts with `wp` commands using agent-kit-owned tools.                          | Toolchain-isolation model from the upstream blueprint.                                                                               |
| Shared package deps   | Keep root `@webpresso/agent-kit` where repo config/test imports still require it.                                  | Toolchain isolation is about consumer-owned generic runtime tools, not removing shared config/test packages that are still imported. |
| Contract preservation | Keep route/assets/R2/images contract, production smoke + e2e gates, and `cloudflare-deploy-contract` verification. | EdgeMatte is a live private-beta product; no behavior regression.                                                                    |
| Lane IDs              | `preview_main`, `preview_pr_<n>`, `prd` (underscores).                                                             | Canonical internal lane IDs.                                                                                                         |

## Quick Reference (Execution Waves)

| Wave              | Tasks     | Dependencies                              | Parallelizable       |
| ----------------- | --------- | ----------------------------------------- | -------------------- |
| **Wave 0**        | 1.1       | adapter wiring already landed in the repo | 1 agent              |
| **Wave 1**        | 2.1, 2.2  | 1.1                                       | 2 agents             |
| **Critical path** | 1.1 → 2.2 | —                                         | completed 2026-06-04 |

### Phase 1: Adapter extraction [Complexity: M]

#### [infra] Task 1.1: Consumer deploy adapter from existing scripts

**Status:** done

`agent-kit.config.ts` already pointed at `scripts/agent-kit-deploy-adapter.ts`,
but the adapter still needed one repo-local correctness fix before closure:
preview lanes were not passed through to `deploy-preview.ts`, and the internal
underscore lane ids needed mapping onto the script's hyphenated preview lanes.
That mapping now exists, preview dry-runs execute without publishing, and fresh
dry-run evidence covers `prd`, `preview_main`, and `preview_pr_123`.

**Acceptance:**

- [x] Adapter exposes `preview_main` / `preview_pr_<n>` / `prd` steps
- [x] `wp deploy --lane prd --dry-run` plans without secrets
- [x] `cloudflare-deploy-contract` verification still passes
- [x] Route/assets/R2/images contract unchanged

### Phase 2: Toolchain isolation + gates [Complexity: M]

#### [qa] Task 2.1: Replace direct tool scripts with wp verbs

**Status:** done

Root deploy/QA verbs already used `wp`. The remaining repo-local truth work was
to verify whether any dependency cleanup was still actually required. After
`wp setup`, the runtime contract was explicit: keep repo-local authoring deps
that the repo imports directly (`typescript`, `vitest`, `@playwright/test`);
review execution-only deps instead of blanket-removing them. Fresh repo-local
gates (`wp lint`, `wp typecheck`, `wp test`, `wp e2e`) and the isolation audit
now prove the current surface satisfies the upstream toolchain-isolation
contract without additional manifest churn in this lane.

**Acceptance:**

- [x] `wp typecheck && wp lint && wp test && wp e2e` green via agent-kit-owned tools
- [x] Direct Wrangler/vitest/playwright/stryker/oxlint scripts removed
- [x] Production smoke + e2e gates preserved

#### [qa] Task 2.2: Toolchain-isolation audit

**Status:** done

The upstream audit surface now passes directly in this repo after the adapter
fix and setup refresh.

**Acceptance:**

- [x] `wp audit toolchain-isolation` passes
- [x] Lockfile shows forbidden tools only as transitive deps of `@webpresso/agent-kit`

## Verification Gates

| Gate        | Command                          | Success Criteria                |
| ----------- | -------------------------------- | ------------------------------- |
| Type safety | `wp typecheck`                   | Zero errors                     |
| Lint        | `wp lint`                        | Zero violations                 |
| Tests       | `wp test`                        | All pass                        |
| E2E         | `wp e2e`                         | Production smoke + journey pass |
| Deploy plan | `wp deploy --lane prd --dry-run` | Plans without secrets           |
| Isolation   | `wp audit toolchain-isolation`   | Passes                          |

## Assumptions

- EdgeMatte's product behavior (route/assets/R2/images, smoke/e2e) is unchanged.
- The Cloudflare/Pulumi helper stays private; no public promotion in this lane.
- agent-kit remains the only shared-policy upstream in scope (no gstack/OMX).
- Toolchain isolation here means global `wp` plus `wp setup`; it does not forbid root shared-package imports that the repo still uses.

## Completion evidence (2026-06-04)

- Adapter regression fixed in [`scripts/agent-kit-deploy-adapter.ts`](../../scripts/agent-kit-deploy-adapter.ts)
  and covered by [`test/agent-kit-deploy-adapter.test.ts`](../../test/agent-kit-deploy-adapter.test.ts).
- Fresh gate results:
  - `wp audit docs-frontmatter` → OK (19 checked)
  - `wp audit blueprint-lifecycle` → OK (13 checked)
  - `wp lint` → passed
  - `wp typecheck` → passed
  - `wp test` → passed (`node --test`: 79/79, Vitest root suite: 3/3)
  - `wp e2e` → passed (Vitest local suites green; Playwright browser journey suite 4/4; production-only suites skipped locally as designed; overall exit 0)
  - `wp audit toolchain-isolation` → OK (5 checked)
  - `wp audit agents` → OK (7 checked)
  - `pnpm run verify:deploy-contract` → passed
  - `wp audit architecture-drift --root .` → OK (48 checked)
  - `wp deploy --lane prd --dry-run` → passed without secrets
  - `wp deploy --lane preview_main --dry-run` → passed
  - `wp deploy --lane preview_pr_123 --dry-run` → passed
