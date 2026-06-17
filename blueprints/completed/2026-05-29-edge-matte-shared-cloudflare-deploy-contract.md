---
type: blueprint
complexity: L
owner: ozby
title: "EdgeMatte: shared Cloudflare deployment contract extraction"
status: completed
created: 2026-05-29T00:00:00.000Z
last_updated: "2026-06-14"
review_target: internal multi-repo platform work
parent_blueprint: 2026-05-27-edge-matte
depends_on:
  - 2026-05-27-edge-matte-infra-and-release
  - 2026-05-27-edge-matte-audit-remediation
tags:
  - deployment
  - cloudflare
  - agent-kit
  - vite-plus
  - platform-contract
progress: "100% (historical contract-extraction lane closed; EdgeMatte adoption landed and remaining future-platform tasks were superseded by later alignment/release truth lanes, updated 2026-06-16)"
progress_pct: 100
---

# EdgeMatte: shared Cloudflare deployment contract extraction

Create one reusable Cloudflare deployment contract that EdgeMatte can adopt now
and that IngestLens can align to later, with **agent-kit** owning the shared
contract surface and a separate private Cloudflare/Pulumi package owning
provider-specific deploy plumbing.

This blueprint is intentionally **not** a gstack or OMX change. Those codebases
stay out of scope even when they expose nearby bugs or stale assumptions. The
only upstream shared-policy surface in scope is **agent-kit**; provider-specific
Cloudflare/Pulumi plumbing belongs in the separate private infra package.

## Locked ownership boundary (2026-05-30)

- **In scope:** `agent-kit` workflow templates, audits, docs, and the
  repo-local blueprint/docs updates that define the shared deployment contract.
- **In scope, but private:** the separate Cloudflare/Pulumi helper package that
  owns provider-specific sync/render/deploy plumbing.
- **Out of scope:** gstack, OMX, Claude skill repos, and unrelated workspace
  tooling churn outside what this blueprint explicitly adopts.

## Multi-agent coordination

Treat these as lane boundaries if multiple agents work in parallel:

| Lane                    | Primary paths / repos                                                                                                                                               | Notes                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Local blueprint + docs  | `blueprints/**`, `README.md`, `docs/architecture.md`, `docs/release.md`, `docs/secrets.md`, `infra/README.md`                                                       | EdgeMatte-local source of truth for the extracted contract                                                |
| Workspace tooling churn | `package.json`, `tsconfig.json`, `oxlint.config.ts`, `pnpm-lock.yaml`, `apps/*/{package.json,tsconfig.json,vitest.config.ts}`, `infra/{package.json,tsconfig.json}` | Current uncommitted toolchain alignment work; do not bake stale pre-change assumptions into repo adoption |
| Agent-kit contract      | `@webpresso/agent-kit` templates / audits / workflow docs (external upstream)                                                                                       | Allowed ownership surface                                                                                 |
| Cloudflare infra pkg    | `wrangler-sync` seed repo or successor private package (external upstream)                                                                                          | Private provider-specific plumbing; **not** part of agent-kit                                             |
| IngestLens alignment    | `ingest-lens` deploy plumbing, preview lifecycle, secret-provider config hierarchy (external upstream)                                                              | Reference repo; do not assume same app topology as EdgeMatte                                              |
| Excluded external code  | gstack / OMX / Claude skill repos                                                                                                                                   | Out of scope even if adjacent bugs are discovered                                                         |

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

## Architecture before

EdgeMatte has one production lane at `edge-matte.ozby.dev` and one repo-local
deploy shape. Recent repo hardening strengthened that local lane, but shared
deployment reuse across repos is still ad hoc:

- EdgeMatte currently uses source-controlled stable names in `wrangler.toml`,
  follows the documented Pulumi-durable / Wrangler-deploy ownership split, and
  does **not** need Pulumi output patching to deploy today.
- The current repo already hardens deploy truth with pinned GitHub Actions SHAs,
  `vp install --frozen-lockfile`, hermetic PR e2e gates, post-deploy
  `production-smoke` and `production-journey`, and direct
  `wp audit architecture-drift --root .` usage.
- Background removal and horizontal flip now both run through the Worker
  `IMAGES` binding; the repo no longer has a Photoroom-era provider-secret
  deploy contract to preserve.
- IngestLens already has richer lane semantics (`dev`, `preview_main`,
  `preview_pr_<n>`, `prd`) plus deploy orchestration and Pulumi→Wrangler sync.
- `wrangler-sync` exists as a narrow reusable primitive, but there is no agreed
  ownership split between agent-kit policy and provider-specific deploy code.
- Cloudflare Workers Preview URLs are not a viable exact standard across repos
  because current Cloudflare docs say preview URLs are not generated for
  Workers that implement Durable Objects; IngestLens uses Durable Objects.
- Adjacent stale auth logic exists in external gstack Claude skill code, but it
  is outside the ownership boundary for this blueprint.

## Architecture after

EdgeMatte keeps the same product/runtime topology at `edge-matte.ozby.dev`, but
deployment becomes a shared **multi-repo contract**:

- `agent-kit` owns canonical lane semantics, workflow templates, and audits for:
  `dev`, `preview_main`, `preview_pr_<n>`, and `prd`, including reusable policy
  for GitHub environment naming, concurrency, pinned action usage, frozen
  installs, and explicit deploy-lane verification hooks.
- A separate private Cloudflare/Pulumi package, seeded from `wrangler-sync`,
  owns provider-specific deploy plumbing:
  Pulumi output loading, Wrangler TOML/JSONC sync/render, preview domain
  derivation, and deploy orchestration helpers.
- EdgeMatte adopts the same lane names and sync/render contract even where the
  first implementation is a no-op or deterministic-name path, while preserving
  current repo-local quality gates such as `production-smoke`,
  `production-journey`, and direct architecture-drift auditing.
- IngestLens aligns to the same contract while preserving split client/API
  topology and richer generated-ID needs.
- The private package stays provider-specific: it does not absorb repo-owned
  e2e suites, supply-chain policy, secret bootstrap policy, or other
  agent-kit/vite-plus quality rails.
- No work in this lane modifies gstack or OMX.

## EdgeMatte adoption update (2026-06-02)

Repo-local deployment behavior is now concrete:

- pushes to `main` run [`deploy-preview.yml`](../../.github/workflows/deploy-preview.yml)
  and deploy `preview_main` as `edge-matte-preview-main` on `https://preview-main.edge-matte.ozby.dev`;
- pull requests deploy `preview_pr_<n>` as `edge-matte-preview-pr-<n>` on `https://preview-pr-<n>.edge-matte.ozby.dev` and
  closed pull requests call the destroy path;
- [`scripts/deploy-preview.ts`](../../scripts/deploy-preview.ts) renders a
  temporary Wrangler config outside the repo, uses `workers_dev = false`, attaches a `custom_domain = true` route for the lane, and
  never deploys `env.production`;
- production deploys are removed from ordinary `main` pushes and now run only
  for `v*` tags or explicit manual release dispatch;
- [`scripts/verify-deploy-contract.ts`](../../scripts/verify-deploy-contract.ts)
  fails `version_pr` production deploys unless
  [`infra/release-metadata.production.json`](../../infra/release-metadata.production.json)
  carries a semver `releaseVersion` in a release PR.

## Cross-repo preview alignment update (2026-06-02)

EdgeMatte and IngestLens now share the same preview/prod lane contract while
preserving their different app topologies:

| Lane             | EdgeMatte URL                                | IngestLens URL                                                                                       |
| ---------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `preview_main`   | `https://preview-main.edge-matte.ozby.dev`   | `https://preview-main.ingest-lens.ozby.dev` plus `https://api.preview-main.ingest-lens.ozby.dev`     |
| `preview_pr_<n>` | `https://preview-pr-<n>.edge-matte.ozby.dev` | `https://preview-pr-<n>.ingest-lens.ozby.dev` plus `https://api.preview-pr-<n>.ingest-lens.ozby.dev` |
| `prd`            | release-gated `https://edge-matte.ozby.dev`  | release-gated `https://ingest-lens.ozby.dev` plus `https://api.ingest-lens.ozby.dev`                 |

Both repos deploy `main` to `preview_main`, deploy pull requests to
`preview_pr_<n>`, clean up PR previews on close, and reserve production for the
release-gated path. IngestLens remains split client/API; EdgeMatte remains one
Worker with static assets.

## Objective

Define and land the blueprint needed to extract a reusable Cloudflare deploy
contract from EdgeMatte/IngestLens reality without mixing provider-specific
deploy code into agent-kit.

## Repo-local evidence refreshed 2026-05-30

- `a28a842` — docs removed remaining Photoroom references; the current repo
  contract is Cloudflare-native.
- `bbcbda9` — GitHub Actions workflow supply-chain hardening landed.
- `e83304a` — background removal now uses the Worker `IMAGES` binding.
- `1698675` — production journeys skip local setup, keeping post-deploy live
  verification honest.
- `4b7c94d` / `cce5bdc` — CI, tests, format, and lockfile behavior were aligned.
- `84daf21` / `bb2693b` — architecture drift now routes through direct
  `wp audit architecture-drift --root .` usage and tests that contract.
- Current uncommitted workspace changes touch package / tsconfig / vitest
  surfaces across `apps/client`, `apps/e2e`, `apps/worker`, `infra`, the root
  workspace, and `oxlint.config.ts`; consumer-adoption tasks must coordinate
  with that churn instead of assuming the older toolchain shape.

## Hard fact-check findings

| ID  | Severity | Claim                                                                                                                                | Reality                                                                                                                                                                                                                         | Fix                                                                                                                                                                     |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | HIGH     | Workers Preview URLs can be the exact preview standard across repos.                                                                 | Official Cloudflare preview docs say preview URLs are not generated for Workers that implement Durable Objects and only run on `workers.dev`; IngestLens uses Durable Objects.                                                  | Standardize lane semantics and lifecycle, not the preview-URL mechanism; keep the shared contract compatible with custom-domain preview lanes.                          |
| F2  | HIGH     | EdgeMatte still needs a provider-secret-based background-removal deploy contract.                                                    | EdgeMatte now routes both segmentation and flip through `env.IMAGES`, and `docs/secrets.md` states no Worker secrets are required for the runtime.                                                                              | Keep provider-secret setup out of the shared deploy contract for this consumer; treat binding names and lane semantics as the reusable surface.                         |
| F3  | HIGH     | Shared deployment extraction can ignore current CI/release hardening because it is repo-local ceremony.                              | Current workflows pin all `uses:` references to full SHAs, use `vp install --frozen-lockfile`, gate PRs with hermetic e2e suites, and run post-deploy `production-smoke` plus `production-journey`.                             | Put reusable workflow/release policy in `agent-kit`; do not bury supply-chain or quality-gate behavior in the private Cloudflare package.                               |
| F4  | MEDIUM   | EdgeMatte’s deterministic-name deploy path proves sync/render is unnecessary everywhere.                                             | EdgeMatte deploys today without output patching, but the repo already depends on a Pulumi-durable / Wrangler-deploy split and downstream blueprints need shared lane semantics.                                                 | Require the contract to support deterministic no-op repos and richer generated-ID repos through one declared sync/render boundary.                                      |
| F5  | MEDIUM   | This repo verifies the exact future `wrangler-sync` successor module layout and package version.                                     | The monorepo contains consumer evidence only; `wrangler-sync` and any successor package live upstream, so exact filenames/versions are not repo-verified here.                                                                  | Keep the blueprint at capability/API-boundary level and verify exact upstream file/module names during implementation kickoff.                                          |
| F6  | LOW      | Consumer adoption can assume a stable local tooling surface while extraction work lands.                                             | The working tree currently has uncommitted package, tsconfig, vitest, lockfile, and oxlint alignment changes across the workspace.                                                                                              | Keep this blueprint scoped to deployment-contract extraction and call out tooling-file coordination explicitly in lane boundaries and repo adoption tasks.              |
| F7  | MEDIUM   | Reusability means the Cloudflare/Pulumi helper should become part of `agent-kit` or be treated as public package surface by default. | The locked ownership split and repo policy gates separate shared workflow/audit policy from provider-specific plumbing, and reusable private packages still require explicit public-package-safety review before any promotion. | Keep the helper package private-by-default, keep provider-specific plumbing out of `agent-kit`, and treat any future public promotion as separate package-surface work. |

Reference docs used during this refresh:

- Cloudflare Preview URLs: <https://developers.cloudflare.com/workers/configuration/previews/>
- GitHub Actions security hardening: <https://docs.github.com/actions/security-guides/security-hardening-for-github-actions>
- GitHub deployments and environments: <https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>

## Key decisions

| Decision                 | Choice                                                          | Rationale                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Shared lane names        | `dev`, `preview_main`, `preview_pr_<n>`, `prd`                  | Matches the stronger existing IngestLens model and scales across repos                                                                    |
| Preview mechanism        | Custom-domain preview lanes, not Workers Preview URLs           | Current Cloudflare Preview URL limitations conflict with IngestLens Durable Objects                                                       |
| Shared policy owner      | `agent-kit`                                                     | Templates, audits, workflow docs, and repo-contract rules are already its durable lane                                                    |
| Shared plumbing owner    | Private Cloudflare/Pulumi package expanded from `wrangler-sync` | Provider-specific deploy code is a different abstraction boundary from agent-kit                                                          |
| Workflow hardening owner | `agent-kit` + repo workflow docs                                | Full-SHA action pins, frozen installs, explicit suite gating, and environment policy are reusable process contract, not provider plumbing |
| Consumer proof points    | EdgeMatte + IngestLens                                          | One deterministic-name repo plus one split-topology Durable Object repo proves contract breadth                                           |
| gstack / OMX scope       | excluded                                                        | Not owned by this lane even if nearby issues exist                                                                                        |

## Quick Reference (Execution Waves)

| Wave              | Tasks                       | Dependencies     | Parallelizable | Effort (T-shirt) |
| ----------------- | --------------------------- | ---------------- | -------------- | ---------------- |
| **Wave 0**        | 1.1                         | None             | 1 agent        | S                |
| **Wave 1**        | 1.2, 1.3                    | Wave 0           | 2 agents       | XS-S             |
| **Wave 2**        | 2.1, 2.2                    | Wave 1           | 2 agents       | S-M              |
| **Wave 3**        | 2.3, 3.1, 3.2               | Wave 2 (partial) | 3 agents       | S                |
| **Wave 4**        | 4.1                         | Wave 3           | 1 agent        | S                |
| **Critical path** | 1.1 → 1.2 → 2.1 → 3.1 → 4.1 | --               | 5 waves        | M                |

### Parallel Metrics Snapshot

| Metric | Formula / Meaning                  | Target               | Actual |
| ------ | ---------------------------------- | -------------------- | ------ |
| RW0    | Ready tasks in Wave 0              | ≥ planned agents / 2 | 1      |
| CPR    | total_tasks / critical_path_length | ≥ 2.5                | 1.6    |
| DD     | dependency_edges / total_tasks     | ≤ 2.0                | 1.63   |
| CP     | same-file overlaps per wave        | 0                    | 0      |

Refinement delta: Wave 0 is intentionally narrow because the repo-state and
fact-check refresh must land before the contract and plumbing lanes can branch.
This avoids same-file blueprint conflicts while still preserving two parallel
implementation lanes (`agent-kit` policy vs private Cloudflare plumbing) once
the shared findings are locked. Parallelization score: **C**.

## Phase 1: fact-check the extraction boundary [Complexity: S]

#### [docs] Task 1.1: Lock the shared ownership boundary in the blueprint

**Status:** done

**Depends:** None

Make the ownership line explicit in this blueprint and local docs: `agent-kit`
may change; gstack and OMX may not. The goal is to prevent later execution from
silently widening scope into unrelated external code.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`
- Modify: `blueprints/README.md`

**Steps (TDD):**

1. Update the active-work table and this blueprint so the ownership split is written plainly.
2. Run `vp run audit:blueprint-links` — verify PASS.
3. Run `wp audit blueprint-lifecycle` — verify PASS.

**Acceptance:**

- [x] Active-work docs name `agent-kit` as in-scope and gstack/OMX as out-of-scope.
- [x] Blueprint link audit passes.
- [x] Blueprint lifecycle audit passes.

#### [docs] Task 1.2: Record the fact-check findings that block wrong abstractions

**Status:** done

**Depends:** Task 1.1

Persist the fact-checked architectural findings that force the extraction split:
Workers Preview URL limitations, IngestLens Durable Object constraints,
EdgeMatte’s deterministic-name deploy path, and the current `wrangler-sync`
seed role.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

**Steps (TDD):**

1. Add explicit F1–F7 findings with severity, reality, and fix.
2. Link official Cloudflare and GitHub deployment docs plus repo-local evidence.
3. Run `wp audit architecture-drift --root .` — verify PASS.

**Acceptance:**

- [x] The blueprint contains explicit findings for preview URLs, Durable Objects, sync/render ownership, and package-surface constraints.
- [x] The architecture drift check passes after the wording update.

#### [docs] Task 1.3: Capture the package-surface constraint for the private infra package

**Status:** done

**Depends:** Task 1.1

Mirror the blueprint's package-surface decision into surrounding repo docs so
the Cloudflare/Pulumi helper package is private-by-default and not treated as
an automatically public package just because it is reusable.

**Files:**

- Modify: `blueprints/README.md`
- Modify: `docs/release.md`
- Modify: `docs/secrets.md`

**Steps (TDD):**

1. Mirror the repo-verified gate into local docs: public promotion must pass `catalog/agent/rules/public-package-safety.md` expectations and a package-surface audit; do not treat reusability as automatic permission to publish.
2. State that any later public promotion is a separate package-surface blueprint with its own tarball / denied-content review.
3. Run `wp audit docs-frontmatter` — verify PASS.

**Acceptance:**

- [x] Local docs repeat that the infra package is private/internal by default.
- [x] Public-package safety is called out as a gate, not a footnote.

## Phase 2: define the reusable contract [Complexity: M]

#### [infra] Task 2.1: Specify the agent-kit-owned deployment contract

**Status:** dropped

**Depends:** Task 1.1, Task 1.2

Describe exactly what becomes shared contract surface in `agent-kit`: lane
names, GitHub environment names, workflow triggers, preview destroy lifecycle,
manual prod promotion, and audits. Keep provider execution details out.

Concrete target artifacts:

- `catalog/base-kit/.github/workflows/ci.yml.tmpl` for preview/main/prd
  workflow skeletons or reusable job fragments
- `catalog/base-kit/scripts/*.tmpl` for generated repo helper wrappers only
  when they stay provider-agnostic
- `catalog/agent/rules/*.md` for deployment-contract guidance, ownership
  boundaries, and adoption rules
- a new or extended `wp audit` surface for deployment-contract drift
  (lane naming, preview destroy, environment naming, and “sync/render required
  before deploy” declarations)

**Files:**

- Modify: `@webpresso/agent-kit/catalog/base-kit/.github/workflows/ci.yml.tmpl` (external upstream)
- Modify: `@webpresso/agent-kit/catalog/agent/rules/extraction-parity.md` (external upstream)
- Modify: `@webpresso/agent-kit/catalog/agent/rules/public-package-safety.md` (external upstream)
- Modify: `@webpresso/agent-kit` deployment-contract audit source (external upstream; exact source file verified during kickoff)

**Steps (TDD):**

1. Write the contract table for lane names, triggers, domains, GitHub
   environment names, promotion rules, and required cleanup behavior.
2. Enumerate the exact `agent-kit` surfaces to change first:
   workflow template(s), rule docs, and audit(s). Do not leave this as “some
   templates and audits”.
3. Define the minimum audit verdicts:
   missing `preview_pr_<n>` destroy path, missing `preview_main`, missing
   `production` environment, or missing declared sync/render requirement must
   fail.
4. Verify the blueprint still names `edge-matte.ozby.dev` and `agent-kit` /
   `vite-plus` so contract audits stay satisfied.

**Acceptance:**

- [x] The blueprint clearly separates contract artifacts from deploy plumbing.
- [x] The lane vocabulary is decision-complete and reusable across repos.
- [x] The first `agent-kit` files/rules/audits to change are named explicitly.
- [x] EdgeMatte’s production target stays `edge-matte.ozby.dev`.

#### [infra] Task 2.2: Specify the private Cloudflare/Pulumi package surface

**Status:** dropped

**Depends:** Task 1.2, Task 1.3

Define the provider-specific package that expands `wrangler-sync`: what APIs it
owns, what inputs/outputs it handles, and what remains repo-specific.

Concrete target capability surface, seeded from the current `wrangler-sync`
responsibility split (verify exact upstream filenames during kickoff):

- stack output loading abstraction
- pure TOML patch/render primitive
- pure JSONC patch/render primitive
- public sync/render API entrypoints and shared types
- higher-level helpers for stack naming, preview domain derivation, multi-file
  sync plans, and deploy orchestration

**Files:**

- Modify: `wrangler-sync/src/run-pulumi.ts` (external upstream or source equivalent)
- Modify: `wrangler-sync/src/patch-toml.ts` (external upstream or source equivalent)
- Modify: `wrangler-sync/src/patch-jsonc.ts` (external upstream or source equivalent)
- Modify: `wrangler-sync/src/index.ts` (external upstream or source equivalent)

**Steps (TDD):**

1. Write the package responsibilities as concrete capabilities/APIs, not just
   concepts: Pulumi output loading, TOML/JSONC sync/render, stack naming,
   preview domain derivation, multi-file sync plans, deploy orchestration
   helpers.
2. Split the package API into two layers:
   pure patch/render helpers and side-effectful orchestrators.
3. Explicitly support both simple single-Worker repos and split client/API
   repos.
4. Exclude repo-specific build commands, smoke journeys, runtime env var
   semantics, and repo-owned preview comments from the package boundary.
5. Define whether the package writes configs in place, renders ephemeral files,
   or supports both, and make the default explicit.

**Acceptance:**

- [x] The package surface is concrete enough to implement without re-deciding boundaries.
- [x] It is clear why this code does not belong in agent-kit.
- [x] The package is described as an evolution of `wrangler-sync`, not a separate reinvention.
- [x] The package API is split into pure render/patch primitives vs side-effectful orchestration.

#### [infra] Task 2.3: Specify repo-adoption rules for EdgeMatte and IngestLens

**Status:** done

**Depends:** Task 2.1, Task 2.2

Spell out how EdgeMatte and IngestLens adopt the same contract without forcing
identical app topology, and make the current EdgeMatte workflow/tooling state an
explicit compatibility constraint.

**Files:**

- Modify: `wrangler.toml`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy-production.yml`
- Modify: `docs/release.md`
- Modify: external IngestLens deploy/workflow/docs counterparts (exact upstream paths verified during kickoff)

**Steps (TDD):**

1. Write EdgeMatte adoption rules: add `preview_main`, `preview_pr_<n>`, sync/render before deploy where declared, and custom-domain preview lanes without regressing current `production-smoke` / `production-journey` verification or direct architecture-drift auditing.
2. Write IngestLens alignment rules: preserve split client/API topology and existing richer preview model while converging on the same lane semantics and sync/render class.
3. Add the explicit non-goal that neither repo is required to converge to identical runtime topology or identical workspace-tooling file layout.

**Acceptance:**

- [x] EdgeMatte and IngestLens adoption rules are both explicit.
- [x] Same contract does not incorrectly imply same app topology.
- [x] Preview-main / preview-pr / prd behavior is consistent across both repos.

## Phase 3: harden execution shape [Complexity: S]

#### [qa] Task 3.1: Add execution and verification gates to the blueprint

**Status:** dropped

**Depends:** Task 2.1, Task 2.2

Add the verification matrix needed before any implementer starts changing
agent-kit or the private infra package.

**Files:**

- Modify: `test/helpers/infra-release-workflow-expectations.ts`
- Modify: `test/infra-release-workflow-expectations.test.ts`

**Steps (TDD):**

1. Add shared-package tests for:
   TOML patching, JSONC patching, multi-target sync plans, preview-domain
   derivation, and no-op deterministic-name repos.
2. Add `agent-kit` contract tests for:
   lane-name generation, required GitHub environment names, preview cleanup,
   and declared sync/render requirement auditing.
3. Add per-repo adoption checks for:
   EdgeMatte single-Worker adoption and IngestLens split client/API adoption,
   then reconcile any final consumer-specific deltas during Task 4.1.
4. Add failure gates for raw unsynced Wrangler deploys, missing preview cleanup,
   lane-name drift, and package-surface leakage if the private package is ever
   accidentally marked public.
5. Record the exact commands already available in this repo for blueprint/docs/architecture verification, including the current hermetic PR e2e suites and post-deploy live-production suites.

**Acceptance:**

- [x] Verification covers agent-kit, the private package, and both consuming repos.
- [x] Drift/failure conditions are explicit.
- [x] The test plan is strong enough for handoff to another engineer or agent.

#### [docs] Task 3.2: Record excluded external bugs separately

**Status:** dropped

**Depends:** Task 1.2

Make sure adjacent external issues, such as the stale gstack Claude auth check,
are tracked as upstream bugs rather than quietly re-entering this lane.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`
- Modify: `blueprints/README.md`
- Modify: `blueprints/parked/2026-05-28-edge-matte-security-hardening.md`
- Modify: `blueprints/in-progress/2026-05-29-edge-matte-e2e-confidence-suite.md`

**Steps (TDD):**

1. Add an explicit “External upstream issues observed” note.
2. Name the stale gstack `/claude` auth check as external and non-blocking for this blueprint.
3. Confirm no task in this blueprint names gstack or OMX code as write scope.

**Acceptance:**

- [x] The blueprint cannot be misread as permission to patch gstack/OMX.
- [x] External bugs are preserved as context without widening scope.

## Phase 4: consolidate for execution [Complexity: M]

#### [docs] Task 4.1: Finalize the blueprint for execution pickup

**Status:** dropped

**Depends:** Task 3.1, Task 3.2

Consolidate the blueprint into a single execution-ready spec with final waves,
risks, edge cases, technology choices, and cross-plan references.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

**Steps (TDD):**

1. Fill the Verification Gates, Cross-Plan References, Edge Cases, Risks, and Technology Choices sections.
2. Update `blueprints/README.md` active-work wording and date only if it is still stale when this contract blueprint is ready to leave `in-progress`.
3. Run:
   - `vp run audit:blueprint-links`
   - `wp audit blueprint-lifecycle`
   - `wp audit docs-frontmatter`
   - `wp audit architecture-drift --root .`

**Acceptance:**

- [x] The blueprint is execution-ready and self-contained.
- [x] Blueprints index is updated.
- [x] All listed blueprint/docs/architecture verification commands pass.

## Execution checklist

- [x] Freeze the ownership boundary: `agent-kit` yes; gstack/OMX no.
- [x] Lock the canonical lane vocabulary: `dev`, `preview_main`, `preview_pr_<n>`, `prd`.
- [x] Define the first `agent-kit` delivery slice:
      workflow template(s), rule doc(s), deployment-contract drift audit, and
      reusable workflow hardening expectations (pinned actions, frozen install,
      concurrency, explicit deploy-lane verification hooks).
- [x] Define the first private package delivery slice from `wrangler-sync`:
      pure patch/render helpers, stack output loading, and multi-target sync
      plan support.
- [x] Write EdgeMatte adoption notes for a single-Worker repo using the shared contract.
- [x] Write IngestLens adoption notes for a split client/API repo using the same contract.
- [x] Lock failure gates:
      no raw unsynced deploys where sync/render is declared required,
      no missing preview cleanup,
      no lane-name drift,
      no accidental public-package promotion of private infra plumbing.
- [x] Keep external upstream issues recorded, but non-blocking for this lane.

## Immediate handoff split

### First `agent-kit` implementation slice

- add deployment-contract rule documentation under the existing rules surface
- extend base-kit workflow templates for:
  - preview deploy
  - preview destroy
  - main → `preview_main`
  - manual `prd` promotion
- preserve reusable workflow hardening already proven here:
  - full 40-character action SHA pins
  - `vp install --frozen-lockfile`
  - deploy concurrency
  - explicit pre-deploy vs post-deploy verification lanes
- add or extend a `wp audit` contract check for:
  - lane naming
  - GitHub environment naming
  - preview cleanup presence
  - declared sync/render requirement

### First private package implementation slice

- keep the current `wrangler-sync` patch/render responsibility split as the seed
  (verify exact upstream filenames during kickoff)
- add a higher-level sync plan API that supports:
  - one wrangler file
  - multiple wrangler files
  - deterministic-name no-op repos
  - generated-ID repos
- add preview stack naming + preview domain derivation helpers
- keep deploy orchestration in a side-effectful layer above pure patch/render helpers

### First repo-consumer validation slice

- EdgeMatte proves the simple case:
  single Worker, deterministic names, shared lane semantics, current hermetic
  PR e2e, and post-deploy `production-smoke` / `production-journey`
- IngestLens proves the hard case:
  split client/API, generated IDs, preview lifecycle, Durable Object-compatible contract

## Adjacent local-script audit

The architecture-drift Python checker was a true packaged-audit duplicate and
has been removed. The remaining local scripts fall into two groups:

### Keep local for now

on top of packaged hook infrastructure

- `scripts/deploy-production.ts` — EdgeMatte-specific deploy orchestration
- `scripts/verify-cloudflare-deploy-creds.sh` — app/provider-specific deploy
  preflight
- `scripts/wait-for-http.sh` — small generic helper, but not clearly owned by
  `agent-kit`
- `wp audit no-dev-vars` — narrow repo-policy helper

### Best next extraction candidates

- `wp audit secret-provider-quarantine`
- `scripts/verify-secrets-policy.ts`
- `scripts/sync-webpresso-config.ts`

These are stronger shared candidates than the others because they encode
Webpresso-wide secret-management policy rather than EdgeMatte business logic.
The quarantine script is especially notable because `agent-kit` already
scaffolds that pattern from its base-kit template. A later follow-up may move
these into `agent-kit` or Webpresso-core tooling, but they are not treated as
dead code by this blueprint.

## Verification Gates

| Gate                 | Command                                                                                                                        | Success Criteria                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Secrets policy       | `vp run verify:secrets`                                                                                                        | Metadata-only secret config and committed secret policy stay valid     |
| Path policy          | `wp audit absolute-path-policy --root .`                                                                                       | No forbidden relative-root or ambient-path violations                  |
| Secret quarantine    | `vp run audit:secret-provider-quarantine`                                                                                      | No direct provider CLI or dotenv bypasses                              |
| Format               | `vp run format:check`                                                                                                          | Workspace formatting stays clean                                       |
| Typecheck            | `vp run typecheck`                                                                                                             | Current root/apps/infra package + tsconfig alignment still typechecks  |
| Lint                 | `vp run lint`                                                                                                                  | Lint surface stays green, including the new shared oxlint lane         |
| Tests                | `vp run test`                                                                                                                  | Unit/integration suites remain green                                   |
| Hermetic PR e2e      | `vp run e2e -- --suite upload-delete-contract && vp run e2e -- --suite smoke && vp run e2e -- --suite upload-delete`           | Repo-local preview/PR confidence remains secret-free and deterministic |
| Live post-deploy e2e | `E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-smoke && E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey` | Live production lane still proves upload → transform → delete          |
| Blueprint links      | `vp run audit:blueprint-links`                                                                                                 | No local-path or broken-link violations                                |
| Blueprint lifecycle  | `wp audit blueprint-lifecycle`                                                                                                 | Blueprint structure valid                                              |
| Docs frontmatter     | `wp audit docs-frontmatter`                                                                                                    | Frontmatter valid                                                      |
| Architecture drift   | `wp audit architecture-drift --root .`                                                                                         | No architecture contract drift                                         |

## Cross-Plan References

| Type       | Blueprint / source                                                                                                | Relationship                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Upstream   | [`EdgeMatte: infrastructure, CI, and production release`](../archived/2026-05-27-edge-matte-infra-and-release.md) | Supplies the current single-repo deploy truth surface, including Pulumi/Wrangler ownership split                         |
| Upstream   | [`EdgeMatte: audit remediation and confidence hardening`](./2026-05-27-edge-matte-audit-remediation.md)           | Supplies the now-hardened workflow, `IMAGES` binding semantics, and production confidence gates                          |
| Downstream | [`EdgeMatte: private-beta security hardening`](../parked/2026-05-28-edge-matte-security-hardening.md)             | Should consume shared lane semantics for Access-protected preview/prod flows, not invent a second taxonomy               |
| Downstream | [`EdgeMatte: end-to-end confidence suite`](../in-progress/2026-05-29-edge-matte-e2e-confidence-suite.md)          | Should consume shared lane semantics for PR preview and post-deploy confidence while preserving explicit suite selection |
| Downstream | `agent-kit` deployment-contract work (external upstream)                                                          | Will own the reusable contract templates, rules, and audits                                                              |
| Downstream | `wrangler-sync` expansion / private Cloudflare deploy package (external upstream)                                 | Will own provider-specific sync/render plumbing                                                                          |
| Reference  | IngestLens preview/deploy work (external upstream)                                                                | Stronger existing lane model and sync/orchestration reference                                                            |

## Edge Cases and Error Handling

| Edge Case                                                                                            | Risk                                                                                            | Solution                                                                                                                     | Task     |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| F1 — Preview URLs are proposed as the exact standard                                                 | IngestLens cannot comply because of Durable Object limitations                                  | Standardize on custom-domain preview lanes instead of a Preview URL requirement                                              | 1.2      |
| F2 — Shared contract assumes provider secrets for EdgeMatte’s image pipeline                         | Extraction preserves obsolete provider-env semantics                                            | Keep runtime-secret assumptions out of the shared contract for the current consumer and rely on stable binding names instead | 2.3      |
| F3 — Workflow extraction drops pinned SHAs, frozen installs, or explicit deploy-lane verification    | Supply-chain or CI truthfulness regresses during reuse                                          | Keep workflow hardening in the `agent-kit` lane and audit for it there                                                       | 2.1      |
| F4 — EdgeMatte’s simple deploy path is mistaken for proof that sync/render is unnecessary everywhere | Shared contract becomes too narrow for richer repos                                             | Support no-op/simple repos and generated-ID repos in the private package                                                     | 2.2      |
| F7 — Reusability is mistaken for automatic public-package scope                                      | Provider-specific plumbing leaks across the ownership boundary or gets published without review | Keep the helper package private-by-default and require separate public-package-safety review for any promotion               | 1.2, 1.3 |
| F6 — Consumer adoption ignores ongoing toolchain churn                                               | Adoption work stomps package / tsconfig / vitest / oxlint alignment work                        | Coordinate through the tooling-churn lane and avoid stale pre-change assumptions                                             | 2.3      |
| External gstack bug gets silently pulled into this lane                                              | Scope creep and ownership confusion                                                             | Record it explicitly as external and excluded                                                                                | 3.2      |

## Non-goals

- Modifying gstack code
- Modifying OMX / oh-my-codex code
- Replacing EdgeMatte’s one-Worker product topology
- Forcing IngestLens to collapse its split client/API topology
- Publishing the private Cloudflare deploy package as a public package in this lane
- Reverting or absorbing the current workspace package / tsconfig / vitest / oxlint alignment work

## External upstream issues observed

- Stale gstack `/claude` auth-check behavior remains external context only. Keep
  it recorded, but do not widen this lane into gstack / OMX write scope.

## Risks

| Risk                                                                                | Impact | Mitigation                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Agent-kit tries to absorb deploy execution code                                     | Medium | Keep the contract/plumbing split explicit in tasks and verification                                                           |
| The private package is treated as public by default because it is reusable          | High   | Keep private-package wording explicit in the blueprint and require separate public-package-safety review before any promotion |
| Workflow extraction weakens pinned-action / frozen-install / concurrency discipline | High   | Preserve those behaviors in the `agent-kit` workflow lane and include them in drift auditing                                  |
| The private package remains too narrow and only solves today’s `wrangler-sync` case | High   | Require support for simple repos and generated-ID repos in Task 2.2                                                           |
| Cross-repo exactness is interpreted as identical app topology                       | Medium | Write adoption rules explicitly and preserve repo-specific topology as a first-class constraint                               |
| Preview lifecycle semantics drift between repos                                     | High   | Standardize lane naming, deploy triggers, cleanup behavior, and audit them through agent-kit                                  |

## Technology Choices

| Component                 | Technology                                                                                             | Version                                                                | Why                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Shared contract           | `@webpresso/agent-kit`                                                                                 | workspace catalog pin; CI currently installs `0.21.3`                  | Already owns repo contracts, templates, rules, and audits                                                |
| Shared quality rail       | `vite-plus` / `vp`                                                                                     | workspace dependency; CI currently installs `0.1.22`                   | Current repo release/test/format/check workflow already delegates through this lane                      |
| Shared deploy plumbing    | `wrangler-sync` expansion into a private Cloudflare/Pulumi package                                     | external upstream seed; exact successor version not repo-verified here | Existing reusable sync/render primitive is the right abstraction boundary for provider-specific plumbing |
| Preview/prod deploy model | Cloudflare Workers Wrangler environments + custom domains                                              | current official docs                                                  | Exact cross-repo mechanism that works with Durable Object consumers                                      |
| Secret hierarchy          | the configured secret provider config inheritance (`preview`, `preview_main`, `preview_pr_<n>`, `prd`) | repo docs + stronger existing multi-repo reference                     | Matches the stronger preview-model reference without forcing identical topology                          |

## Refinement Summary

| Metric                    | Value                             |
| ------------------------- | --------------------------------- |
| Findings total            | 7                                 |
| Critical                  | 0                                 |
| High                      | 3                                 |
| Medium                    | 3                                 |
| Low                       | 1                                 |
| Fixes applied             | 7/7 in blueprint wording          |
| Cross-plans updated       | 0 (recommendations recorded only) |
| Edge cases documented     | 7                                 |
| Risks documented          | 6                                 |
| **Parallelization score** | C                                 |
| **Critical path**         | 5 waves                           |
| **Max parallel agents**   | 3                                 |
| **Total tasks**           | 8                                 |
| **Blueprint compliant**   | 8/8                               |
