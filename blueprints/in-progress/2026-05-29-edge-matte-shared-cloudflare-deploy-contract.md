---
type: blueprint
title: "EdgeMatte: shared Cloudflare deployment contract extraction"
status: in-progress
created: 2026-05-29
last_updated: 2026-05-29
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
---

# EdgeMatte: shared Cloudflare deployment contract extraction

Create one reusable Cloudflare deployment contract that EdgeMatte can adopt now
and that IngestLens can align to later, with **agent-kit** owning the shared
contract surface and a separate private Cloudflare/Pulumi package owning
provider-specific deploy plumbing.

This blueprint is intentionally **not** a gstack or OMX change. Those codebases
stay out of scope even when they expose nearby bugs or stale assumptions.

## Multi-agent coordination

Treat these as lane boundaries if multiple agents work in parallel:

| Lane                    | Primary paths / repos                                                                                                                                                                       | Notes                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Local blueprint + docs  | `blueprints/**`, `README.md`, `docs/architecture.md`, `docs/release.md`, `infra/README.md`                                                                                                | EdgeMatte-local source of truth for the extracted contract            |
| Agent-kit contract      | `@webpresso/agent-kit` templates / audits / workflow docs (external upstream)                                                                                                              | Allowed ownership surface                                             |
| Cloudflare infra pkg    | `wrangler-sync` seed repo or successor private package (external upstream)                                                                                                                  | Private provider-specific plumbing; **not** part of agent-kit         |
| IngestLens alignment    | `ingest-lens` deploy plumbing, preview lifecycle, Doppler config hierarchy (external upstream)                                                                                             | Reference repo; do not assume same app topology as EdgeMatte          |
| Excluded external code  | gstack / OMX / Claude skill repos                                                                                                                                                           | Out of scope even if adjacent bugs are discovered                     |

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

## Architecture before

EdgeMatte has one production lane at `edge-matte.ozby.dev` and one repo-local
deploy shape. Shared deployment reuse across repos is ad hoc:

- EdgeMatte currently uses source-controlled stable names in `wrangler.toml` and
  does **not** need Pulumi output patching to deploy.
- IngestLens already has richer lane semantics (`dev`, `preview_main`,
  `preview_pr_<n>`, `prd`) plus deploy orchestration and Pulumi→Wrangler sync.
- `wrangler-sync` exists as a narrow reusable primitive, but there is no agreed
  ownership split between agent-kit policy and provider-specific deploy code.
- Cloudflare Workers Preview URLs are not a viable exact standard across repos
  because current Cloudflare docs exclude Workers that implement Durable
  Objects; IngestLens uses Durable Objects.
- Adjacent stale auth logic exists in external gstack Claude skill code, but it
  is outside the ownership boundary for this blueprint.

## Architecture after

EdgeMatte keeps the same product/runtime topology at `edge-matte.ozby.dev`, but
deployment becomes a shared **multi-repo contract**:

- `agent-kit` owns canonical lane semantics, workflow templates, and audits for:
  `dev`, `preview_main`, `preview_pr_<n>`, and `prd`.
- A separate private Cloudflare/Pulumi package, seeded from `wrangler-sync`,
  owns provider-specific deploy plumbing:
  Pulumi output loading, Wrangler TOML/JSONC sync/render, preview domain
  derivation, and deploy orchestration helpers.
- EdgeMatte adopts the same lane names and sync/render contract even where the
  first implementation is a no-op or deterministic-name path.
- IngestLens aligns to the same contract while preserving split client/API
  topology and richer generated-ID needs.
- No work in this lane modifies gstack or OMX.

## Objective

Define and land the blueprint needed to extract a reusable Cloudflare deploy
contract from EdgeMatte/IngestLens reality without mixing provider-specific
deploy code into agent-kit.

## Key decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Shared lane names | `dev`, `preview_main`, `preview_pr_<n>`, `prd` | Matches the stronger existing IngestLens model and scales across repos |
| Preview mechanism | Custom-domain preview lanes, not Workers Preview URLs | Current Cloudflare Preview URL limitations conflict with IngestLens Durable Objects |
| Shared policy owner | `agent-kit` | Templates, audits, and docs are already its durable lane |
| Shared plumbing owner | Private Cloudflare/Pulumi package expanded from `wrangler-sync` | Provider-specific deploy code is a different abstraction boundary from agent-kit |
| gstack / OMX scope | excluded | Not owned by this lane even if nearby issues exist |

## Quick Reference (Execution Waves)

| Wave              | Tasks                   | Dependencies | Parallelizable | Effort (T-shirt) |
| ----------------- | ----------------------- | ------------ | -------------- | ---------------- |
| **Wave 0**        | 1.1, 1.2, 1.3           | None         | 3 agents       | XS-S             |
| **Wave 1**        | 2.1, 2.2, 2.3           | Wave 0       | 3 agents       | S-M              |
| **Wave 2**        | 3.1, 3.2                | Wave 1       | 2 agents       | S-M              |
| **Wave 3**        | 4.1                     | Wave 2       | 1 agent        | M                |
| **Critical path** | 1.1 → 2.1 → 3.1 → 4.1  | --           | 4 waves        | M                |

### Parallel Metrics Snapshot

| Metric | Formula / Meaning                  | Target               | Actual |
| ------ | ---------------------------------- | -------------------- | ------ |
| RW0    | Ready tasks in Wave 0              | ≥ planned agents / 2 | 3      |
| CPR    | total_tasks / critical_path_length | ≥ 2.5                | 2.0    |
| DD     | dependency_edges / total_tasks     | ≤ 2.0                | 1.0    |
| CP     | same-file overlaps per wave        | 0                    | 0      |

Refinement delta: the plan stays slightly narrower than a full `/pll`-maximized
roadmap because one final consolidation task must merge cross-repo findings into
one decision-complete contract. Parallelization score: **B**.

## Phase 1: fact-check the extraction boundary [Complexity: S]

#### [docs] Task 1.1: Lock the shared ownership boundary in the blueprint

**Status:** todo

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
3. Run `wp audit blueprint-lifecycle --legacy-omx` — verify PASS.

**Acceptance:**

- [ ] Active-work docs name `agent-kit` as in-scope and gstack/OMX as out-of-scope.
- [ ] Blueprint link audit passes.
- [ ] Blueprint lifecycle audit passes.

#### [docs] Task 1.2: Record the fact-check findings that block wrong abstractions

**Status:** todo

**Depends:** None

Persist the fact-checked architectural findings that force the extraction split:
Workers Preview URL limitations, IngestLens Durable Object constraints,
EdgeMatte’s deterministic-name deploy path, and the current `wrangler-sync`
seed role.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

**Steps (TDD):**

1. Add explicit F1–F6 findings with severity, reality, and fix.
2. Link official Cloudflare and GitHub deployment docs plus repo-local evidence.
3. Run `wp audit architecture-drift --root .` — verify PASS.

**Acceptance:**

- [ ] The blueprint contains explicit findings for preview URLs, Durable Objects, sync/render ownership, and package-surface constraints.
- [ ] The architecture drift check passes after the wording update.

#### [docs] Task 1.3: Capture the package-surface constraint for the private infra package

**Status:** todo

**Depends:** None

Document that the Cloudflare/Pulumi helper package is private-by-default and
must not be treated as an automatically public package just because it is
reusable.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

**Steps (TDD):**

1. Record that current package-surface policy already treats `@webpresso/cloudflare-pulumi` and `@webpresso/doppler-pulumi` as forbidden public-name patterns.
2. State that any later public promotion is a separate package-surface blueprint.
3. Run `wp audit docs-frontmatter` — verify PASS.

**Acceptance:**

- [ ] The blueprint explicitly says the infra package is private/internal by default.
- [ ] Public-package safety is called out as a gate, not a footnote.

## Phase 2: define the reusable contract [Complexity: M]

#### [infra] Task 2.1: Specify the agent-kit-owned deployment contract

**Status:** todo

**Depends:** Task 1.1, Task 1.2

Describe exactly what becomes shared contract surface in `agent-kit`: lane
names, GitHub environment names, workflow triggers, preview destroy lifecycle,
manual prod promotion, and audits. Keep provider execution details out.

Concrete target artifacts:

- `catalog/base-kit/.github/workflows/ci.webpresso.yml.tmpl` for preview/main/prd
  workflow skeletons or reusable job fragments
- `catalog/base-kit/scripts/*.tmpl` for generated repo helper wrappers only
  when they stay provider-agnostic
- `catalog/agent/rules/*.md` for deployment-contract guidance, ownership
  boundaries, and adoption rules
- a new or extended `wp audit` surface for deployment-contract drift
  (lane naming, preview destroy, environment naming, and “sync/render required
  before deploy” declarations)

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

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

- [ ] The blueprint clearly separates contract artifacts from deploy plumbing.
- [ ] The lane vocabulary is decision-complete and reusable across repos.
- [ ] The first `agent-kit` files/rules/audits to change are named explicitly.
- [ ] EdgeMatte’s production target stays `edge-matte.ozby.dev`.

#### [infra] Task 2.2: Specify the private Cloudflare/Pulumi package surface

**Status:** todo

**Depends:** Task 1.2, Task 1.3

Define the provider-specific package that expands `wrangler-sync`: what APIs it
owns, what inputs/outputs it handles, and what remains repo-specific.

Concrete target surface, seeded from current `wrangler-sync` modules:

- `run-pulumi.ts` → stack output loader abstraction
- `patch-toml.ts` → pure TOML patch/render primitive
- `patch-jsonc.ts` → pure JSONC patch/render primitive
- `index.ts` / `types.ts` → public package API for sync/render entrypoints
- new higher-level helpers for:
  stack naming, preview domain derivation, multi-file sync plans, and deploy
  orchestration

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

**Steps (TDD):**

1. Write the package responsibilities as concrete modules/APIs, not just
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

- [ ] The package surface is concrete enough to implement without re-deciding boundaries.
- [ ] It is clear why this code does not belong in agent-kit.
- [ ] The package is described as an evolution of `wrangler-sync`, not a separate reinvention.
- [ ] The package API is split into pure render/patch primitives vs side-effectful orchestration.

#### [infra] Task 2.3: Specify repo-adoption rules for EdgeMatte and IngestLens

**Status:** todo

**Depends:** Task 2.1, Task 2.2

Spell out how EdgeMatte and IngestLens adopt the same contract without forcing
identical app topology.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

**Steps (TDD):**

1. Write EdgeMatte adoption rules: add `preview_main`, `preview_pr_<n>`, sync/render before deploy, custom-domain preview lanes.
2. Write IngestLens alignment rules: preserve split client/API topology and existing richer preview model while converging on the same lane semantics and sync/render class.
3. Add the explicit non-goal that neither repo is required to converge to identical runtime topology.

**Acceptance:**

- [ ] EdgeMatte and IngestLens adoption rules are both explicit.
- [ ] Same contract does not incorrectly imply same app topology.
- [ ] Preview-main / preview-pr / prd behavior is consistent across both repos.

## Phase 3: harden execution shape [Complexity: S]

#### [qa] Task 3.1: Add execution and verification gates to the blueprint

**Status:** todo

**Depends:** Task 2.1, Task 2.2, Task 2.3

Add the verification matrix needed before any implementer starts changing
agent-kit or the private infra package.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

**Steps (TDD):**

1. Add shared-package tests for:
   TOML patching, JSONC patching, multi-target sync plans, preview-domain
   derivation, and no-op deterministic-name repos.
2. Add `agent-kit` contract tests for:
   lane-name generation, required GitHub environment names, preview cleanup,
   and declared sync/render requirement auditing.
3. Add per-repo adoption checks for:
   EdgeMatte single-Worker adoption and IngestLens split client/API adoption.
4. Add failure gates for raw unsynced Wrangler deploys, missing preview cleanup,
   lane-name drift, and package-surface leakage if the private package is ever
   accidentally marked public.
5. Record the exact commands already available in this repo for blueprint/docs/architecture verification.

**Acceptance:**

- [ ] Verification covers agent-kit, the private package, and both consuming repos.
- [ ] Drift/failure conditions are explicit.
- [ ] The test plan is strong enough for handoff to another engineer or agent.

#### [docs] Task 3.2: Record excluded external bugs separately

**Status:** todo

**Depends:** Task 2.3

Make sure adjacent external issues, such as the stale gstack Claude auth check,
are tracked as upstream bugs rather than quietly re-entering this lane.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

**Steps (TDD):**

1. Add an explicit “External upstream issues observed” note.
2. Name the stale gstack `/claude` auth check as external and non-blocking for this blueprint.
3. Confirm no task in this blueprint names gstack or OMX code as write scope.

**Acceptance:**

- [ ] The blueprint cannot be misread as permission to patch gstack/OMX.
- [ ] External bugs are preserved as context without widening scope.

## Phase 4: consolidate for execution [Complexity: M]

#### [docs] Task 4.1: Finalize the blueprint for execution pickup

**Status:** todo

**Depends:** Task 3.1, Task 3.2

Consolidate the blueprint into a single execution-ready spec with final waves,
risks, edge cases, technology choices, and cross-plan references.

**Files:**

- Modify: `blueprints/in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`

**Steps (TDD):**

1. Fill the Verification Gates, Cross-Plan References, Edge Cases, Risks, and Technology Choices sections.
2. Update `blueprints/README.md` active work table and purpose line.
3. Run:
   - `vp run audit:blueprint-links`
   - `wp audit blueprint-lifecycle --legacy-omx`
   - `wp audit docs-frontmatter`
   - `wp audit architecture-drift --root .`

**Acceptance:**

- [ ] The blueprint is execution-ready and self-contained.
- [ ] Blueprints index is updated.
- [ ] All listed blueprint/docs/architecture verification commands pass.

## Execution checklist

- [ ] Freeze the ownership boundary: `agent-kit` yes; gstack/OMX no.
- [ ] Lock the canonical lane vocabulary: `dev`, `preview_main`, `preview_pr_<n>`, `prd`.
- [ ] Define the first `agent-kit` delivery slice:
      workflow template(s), rule doc(s), and deployment-contract drift audit.
- [ ] Define the first private package delivery slice from `wrangler-sync`:
      pure patch/render helpers, stack output loading, and multi-target sync plan support.
- [ ] Write EdgeMatte adoption notes for a single-Worker repo using the shared contract.
- [ ] Write IngestLens adoption notes for a split client/API repo using the same contract.
- [ ] Lock failure gates:
      no raw unsynced deploys where sync/render is declared required,
      no missing preview cleanup,
      no lane-name drift,
      no accidental public-package promotion of private infra plumbing.
- [ ] Keep external upstream issues recorded, but non-blocking for this lane.

## Immediate handoff split

### First `agent-kit` implementation slice

- add deployment-contract rule documentation under the existing rules surface
- extend base-kit workflow templates for:
  - preview deploy
  - preview destroy
  - main → `preview_main`
  - manual `prd` promotion
- add or extend a `wp audit` contract check for:
  - lane naming
  - GitHub environment naming
  - preview cleanup presence
  - declared sync/render requirement

### First private package implementation slice

- keep current `wrangler-sync` pure patch modules as the seed
- add a higher-level sync plan API that supports:
  - one wrangler file
  - multiple wrangler files
  - deterministic-name no-op repos
  - generated-ID repos
- add preview stack naming + preview domain derivation helpers
- keep deploy orchestration in a side-effectful layer above pure patch/render helpers

### First repo-consumer validation slice

- EdgeMatte proves the simple case:
  single Worker, deterministic names, shared lane semantics
- IngestLens proves the hard case:
  split client/API, generated IDs, preview lifecycle, Durable Object-compatible contract

## Verification Gates

| Gate                  | Command                                           | Success Criteria |
| --------------------- | ------------------------------------------------- | ---------------- |
| Blueprint links       | `vp run audit:blueprint-links`                    | No local-path or broken-link violations |
| Blueprint lifecycle   | `wp audit blueprint-lifecycle --legacy-omx`       | Blueprint structure valid |
| Docs frontmatter      | `wp audit docs-frontmatter`                       | Frontmatter valid |
| Architecture drift    | `wp audit architecture-drift --root .`     | No architecture contract drift |

## Cross-Plan References

| Type       | Blueprint / source | Relationship |
| ---------- | ------------------ | ------------ |
| Upstream   | [`EdgeMatte: infrastructure, CI, and production release`](../completed/2026-05-27-edge-matte-infra-and-release.md) | Supplies the current single-repo deploy truth surface |
| Upstream   | [`EdgeMatte: audit remediation and confidence hardening`](./2026-05-27-edge-matte-audit-remediation.md) | Keeps production truthfulness aligned while the shared contract is extracted |
| Downstream | [`EdgeMatte: private-beta security hardening`](../planned/2026-05-28-edge-matte-security-hardening.md) | Should consume shared lane semantics for Access-protected preview/prod flows |
| Downstream | [`EdgeMatte: end-to-end confidence suite`](../planned/2026-05-29-edge-matte-e2e-confidence-suite.md) | Should consume shared lane semantics for PR preview and post-deploy confidence |
| Downstream | `agent-kit` deployment-contract work (external upstream) | Will own the reusable contract templates/audits |
| Downstream | `wrangler-sync` expansion / private Cloudflare deploy package (external upstream) | Will own provider-specific sync/render plumbing |
| Reference  | IngestLens preview/deploy work (external upstream) | Stronger existing lane model and sync/orchestration reference |

## Edge Cases and Error Handling

| Edge Case | Risk | Solution | Task |
| --------- | ---- | -------- | ---- |
| Preview URLs are proposed as the exact standard | IngestLens cannot comply because of Durable Object limitations | Standardize on custom-domain preview lanes instead | 1.2 |
| EdgeMatte’s simple deploy path is mistaken for proof that sync/render is unnecessary everywhere | Shared contract becomes too narrow for richer repos | Support no-op/simple repos and generated-ID repos in the private package | 2.2 |
| Provider-specific deploy code leaks into agent-kit | Agent-kit becomes Cloudflare-coupled and harder to reuse | Keep only policy/templates/audits in agent-kit | 2.1 |
| Private infra package is assumed to be public by default | Secrets, internals, or unstable surfaces leak into release expectations | Treat public promotion as a separate package-surface decision | 1.3 |
| External gstack bug gets silently pulled into this lane | Scope creep and ownership confusion | Record it explicitly as external and excluded | 3.2 |

## Non-goals

- Modifying gstack code
- Modifying OMX / oh-my-codex code
- Replacing EdgeMatte’s one-Worker product topology
- Forcing IngestLens to collapse its split client/API topology
- Publishing the private Cloudflare deploy package as a public package in this lane

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Agent-kit tries to absorb deploy execution code | Medium | Keep the contract/plumbing split explicit in tasks and verification |
| The private package remains too narrow and only solves today’s `wrangler-sync` case | High | Require support for simple repos and generated-ID repos in Task 2.2 |
| Cross-repo exactness is interpreted as identical app topology | Medium | Write adoption rules explicitly and preserve repo-specific topology as a first-class constraint |
| Preview lifecycle semantics drift between repos | High | Standardize lane naming, deploy triggers, cleanup behavior, and audit them through agent-kit |

## Technology Choices

| Component | Technology | Version | Why |
| --------- | ---------- | ------- | --- |
| Shared contract | `@webpresso/agent-kit` | current workspace version | Already owns repo contracts, templates, and audits |
| Shared deploy plumbing | `wrangler-sync` expansion into a private Cloudflare/Pulumi package | current seed: `@ozby/wrangler-sync@0.2.0` | Existing reusable primitive for Pulumi→Wrangler sync; right seed for broader private package |
| Preview/prod deploy model | Cloudflare Workers Wrangler Environments + custom domains | current official docs | Exact cross-repo mechanism that works with Durable Object consumers |
| Secret hierarchy | Doppler config inheritance (`preview`, `preview_main`, `preview_pr_<n>`, `prd`) | current official docs | Matches stronger existing multi-repo preview model |

## Refinement Summary

| Metric                    | Value                                      |
| ------------------------- | ------------------------------------------ |
| Findings total            | 6                                          |
| Critical                  | 1                                          |
| High                      | 3                                          |
| Medium                    | 2                                          |
| Low                       | 0                                          |
| Fixes applied             | 6/6 in blueprint wording                   |
| Cross-plans updated       | 5 local blueprints + blueprint index       |
| Edge cases documented     | 5                                          |
| Risks documented          | 4                                          |
| **Parallelization score** | B                                          |
| **Critical path**         | 4 waves                                    |
| **Max parallel agents**   | 3                                          |
| **Total tasks**           | 8                                          |
| **Blueprint compliant**   | 8/8                                        |
