---
type: blueprint
title: "EdgeMatte: audit remediation and confidence hardening"
status: in-progress
created: 2026-05-27
last_updated: 2026-05-30
review_target: public GitHub repository
parent_blueprint: 2026-05-27-edge-matte
progress: "67% (6/9 tasks done, 2 in progress, 1 todo, updated 2026-05-30)"
depends_on:
  - 2026-05-27-edge-matte-core-pipeline
  - 2026-05-27-edge-matte-ui-and-e2e
  - 2026-05-27-edge-matte-infra-and-release
---

# EdgeMatte: audit remediation and confidence hardening

Active corrective lane after the 2026-05-27 milestone wave. The parent and four
child blueprints stay in `completed/` as historical record; this spec tracks
truthfulness, CI green, and boundary-faithful verification.

## Multi-agent coordination

If multiple agents work this repo in parallel, treat these paths as **lane
boundaries** — coordinate before crossing them:

| Lane             | Primary paths                                                                                                                                                                     | Notes                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Secrets / policy | `scripts/verify-secrets-policy.ts`, `scripts/lib/secrets-policy.ts`, `scripts/sync-webpresso-config.ts`, `docs/secrets.md`, `.webpresso/secrets.config.json`, `.husky/pre-commit` | Wave 0 largely complete in working tree — avoid drive-by edits      |
| Production CI    | `.github/workflows/deploy.production.yml`, `scripts/wait-for-http.sh`, `scripts/deploy-production.ts`                                                                             | Wave 0.5 — health polling after wrangler deploy                     |
| E2E boundaries   | `apps/e2e/**`, `agent-kit.config.ts`                                                                                                                                              | Browser + contract suite split landed — keep reviewer-flow boundaries intact |
| Worker runtime   | `apps/worker/src/adapters/**`, `apps/worker/src/core/process-image-job.ts`, `apps/worker/test/**`                                                                                 | Fail-loud adapters + cleanup/deadline behavior landed — avoid overlapping edits |
| Docs truth       | `README.md`, `docs/release.md`, `blueprints/README.md`, completion notes in `blueprints/completed/*.md`                                                                           | Truth lane mostly closed — reopen only if final verification changes status     |

**Do not** move the parent roadmap out of `completed/` during this lane. Close
gaps here, then update parent completion notes once evidence exists.

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

## Architecture before

The repo already has the intended v1 architecture on paper, but the confidence
surface is misaligned with that contract:

- local "E2E" imports Worker internals instead of validating the true browser /
  runtime boundary;
- production truth is weaker than completed blueprint status implies;
- provider / transform adapters silently no-op when critical runtime config is
  missing;
- failure cleanup and deadline-bounded provider behavior are documented but not
  fully enforced;
- active contract details drift across blueprint, worker, client, and CI.

## Architecture after

The runtime topology stays the same — one Worker, static assets, one R2 bucket,
one pure pipeline core — but the delivery contract becomes honest and
boundary-faithful:

- reviewer-critical tests exercise the real browser/runtime surface;
- production-sensitive adapter misconfiguration fails loudly;
- cleanup and timeout semantics match the architecture doc;
- blueprint/docs/CI claims match verified reality;
- quality rails stop relying on placeholder lint or misleading test names.

## Objective

Close the highest-risk gaps between EdgeMatte's current implementation and the
Webpresso / monorepo development and testing philosophy without inventing new
platform complexity. Reuse the shared **agent-kit** / **vite-plus** quality
rails wherever this lane touches CI, lint, typecheck, Vitest, or workspace
config so the remediation tightens the existing contract instead of growing a
parallel workflow surface.

## Decision

Preserve the completed blueprints as historical record and add one explicit
remediation blueprint that hardens confidence, truthfulness, and verification.

## RALPLAN-DR summary

### Principles

1. No false green.
2. Truth over milestone vanity.
3. Keep one architecture; harden seams, do not sprawl topology.
4. Integration-first confidence for user-critical paths.

### Decision drivers

1. Restore trustworthy reviewer-flow verification.
2. Remove silent degraded-success runtime behavior.
3. Reconcile docs/blueprints/code/CI with observable reality.

### Viable options

#### Option A — Add a new remediation blueprint

**Pros**

- clean audit trail
- preserves milestone history
- gives one place to close cross-cutting gaps

**Cons**

- requires readers to follow a newer corrective blueprint
- some historical overclaim remains visible until explicitly superseded

#### Option B — Rewrite completed blueprints in place

**Pros**

- reduces overclaim in older files directly

**Cons**

- blurs historical record
- makes blueprint lifecycle harder to trust

### Chosen direction

Choose **Option A** and use this blueprint to update active docs / notes where
truthfulness needs to be tightened.

## Gap addressed

The repo currently passes local checks while still carrying false confidence
around runtime boundaries, deployment truth, and test semantics. This blueprint
is the corrective pass before any further feature expansion.

## Write scope

Remaining execution in this lane is narrower than the original cross-repo audit
pass. The live write surface still includes:

- `blueprints/in-progress/2026-05-27-edge-matte-audit-remediation.md`
- `.github/workflows/*.yml`
- `scripts/wait-for-http.sh`
- `scripts/deploy-production.ts`
- `test/helpers/infra-release-workflow-expectations.mjs`
- `apps/e2e/**`
- `apps/worker/**`
- root/workspace quality-rail files (`package.json`, `tsconfig.json`, `oxlint.config.ts`, `pnpm-lock.yaml`)
- package-local quality-rail files under `apps/client`, `apps/e2e`, `apps/worker`, and `infra`

Docs / completed-blueprint truth tightening already landed in the repo history;
only touch them again if final verification changes the truth state.

## Not in scope

- auth or multi-user features
- queue-mode promotion
- database introduction
- new product scope beyond confidence restoration
- cross-repo deployment-contract extraction, `agent-kit` policy changes, or
  private Cloudflare deploy-package work (tracked separately in
  [`2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`](./2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md))

## Evidence motivating this blueprint

- Historical internal-import E2E harness: `apps/e2e/src/test-harness.ts`
- E2E blueprint forbids internal-import manufactured passes: `blueprints/completed/2026-05-27-edge-matte-ui-and-e2e.md`
- Infra blueprint stop condition requires a live healthy deployment before completion: `blueprints/completed/2026-05-27-edge-matte-infra-and-release.md`
- Background removal now routes through the Cloudflare Images binding: `apps/worker/src/adapters/cloudflare/cf-image-segment-provider.ts`
- Cleanup + deadline semantics now live in the core pipeline: `apps/worker/src/core/process-image-job.ts`, `apps/worker/test/process-image-job.test.ts`
- Production-journey local-setup skip is explicit: `apps/e2e/src/global-setup.test.ts`
- Supply-chain pinning + direct architecture-drift audit are in the workflows: `.github/workflows/ci.webpresso.yml`, `.github/workflows/deploy.production.yml`, `.github/workflows/architecture-contract.yml`
- Workspace quality-rail alignment is active in the working tree: `package.json`, `tsconfig.json`, `oxlint.config.ts`, `apps/*/tsconfig.json`, `apps/*/vitest.config.ts`, `infra/tsconfig.json`

## Refinement findings (2026-05-30)

| ID | Severity | Claim in older draft | Current repo reality | Blueprint fix |
| --- | --- | --- | --- | --- |
| F1 | MEDIUM | Browser-boundary reviewer flow still needs to be created. | `apps/e2e/journeys/upload-delete.spec.ts` is a Playwright journey and `upload-delete.contract.test.ts` is now explicitly contract-only. | Mark Task 2.1 done and narrow remaining work to verification + CI proof. |
| F2 | MEDIUM | Cleanup/deadline behavior is only partially implemented. | `processImageJob()` now cleans orphaned blobs, preserves failed metadata, and enforces a background-removal deadline with tests. | Mark Task 2.3 done and remove the stale "partial" wording. |
| F3 | MEDIUM | Quality-gate remediation is only about package scripts and one workflow. | Current working tree also aligns root/app/infra `tsconfig`, Vitest config, and lint rails around shared `agent-kit` / `vite-plus` surfaces. | Expand Task 3.2 file scope and keep it in progress. |
| F4 | LOW | Production proof ends at `/health` + `production-smoke`. | Deploy workflow now also runs `production-journey`, and E2E global setup explicitly skips local boot for production suites. | Update Wave 0.5, Task 3.3, and Verification commands to include both production suites. |
| F5 | LOW | This blueprint can omit explicit `agent-kit` / `vite-plus` references. | `docs/architecture.contract.json` requires active blueprints to mention the shared quality-contract surfaces. | Add explicit `agent-kit` / `vite-plus` wording to the objective and quality-gate task. |
| F6 | LOW | Docs-truth remediation and Photoroom-removal cleanup are still open work. | README/release/completed-blueprint notes already reflect truthful state and Photoroom remnants were removed in `a28a842`. | Mark Task 1.2 done and keep doc edits closed unless final verification changes truth. |

## Acceptance criteria

- Active docs and blueprint notes no longer overstate production readiness.
- Reviewer-critical E2E coverage goes through browser/runtime boundaries and no
  longer imports internal Worker/core modules to manufacture a passing result.
- The reviewer-critical suite (`upload-delete`) runs on a real browser runner
  against the served app/runtime boundary, not Vitest + `fetch` alone.
- Any remaining non-browser contract tests are named and scoped honestly
  (`upload-delete-contract`, `smoke`, `production-smoke`).
- Production adapter misconfiguration fails loudly instead of silently passing
  the original image through.
- `processImageJob()` failure paths perform the documented cleanup semantics.
- Upload-size contract is consistent across blueprint, worker, client, and
  tests.
- Workspace/package quality rails route through shared **agent-kit** /
  **vite-plus** surfaces rather than bespoke per-package drift.
- PR CI matches the checks promised in the infra blueprint, and the production
  deploy lane proves both `production-smoke` and `production-journey`.
- `wp audit architecture-drift --root .` passes after all updates.

## Wave 0 — secrets governance (ingest-lens parity)

**Status:** complete in working tree (pending merge). No runtime topology change.

- [x] Doppler-only CI bootstrap (`DOPPLER_SERVICE_TOKEN` + `dopplerhq/secrets-fetch-action`)
- [x] Committed metadata-only `.webpresso/secrets.config.json` → `ozby-shell`
- [x] `scripts/verify-secrets-policy.ts` (disk + git carriers + token patterns)
- [x] `scripts/sync-webpresso-config.ts` via `wp config secrets set`
- [x] `scripts/audit-secret-provider-quarantine.ts` (no dotenv / direct provider bypass)
- [x] `docs/secrets.md`, `docs/release.md`, `README.md`, `AGENTS.md` aligned
- [x] Pre-commit matches `verify:secrets` + shared path-policy audit + quarantine

## Wave 0.5 — production deploy CI green

**Status:** in progress; code-path fixes landed, but live proof is still blocked on operator credential pairing.

- [x] Root cause (propagation): post-deploy `curl` ran before Workers route propagation
- [x] `scripts/wait-for-http.sh` now polls both `/health` and `/` in CI and `deploy-production.ts`
- [x] Root cause (auth): `ozby-shell` / `prd` pairs **ozby** `CLOUDFLARE_ACCOUNT_ID`
      (`e93986039…`) with a **Webpresso-scoped** `CLOUDFLARE_API_TOKEN` → deploy fails
      `Authentication error [code: 10000]` while dry-run still passed
- [x] `scripts/lib/probe-cloudflare-workers-auth.ts` + verify script probe Workers
      Services API before real deploy
- [x] Deploy workflow now runs both `production-smoke` and `production-journey`;
      local production journeys skip wrangler boot via `apps/e2e/src/global-setup.test.ts`
- [ ] Operator: rotate `CLOUDFLARE_API_TOKEN` on the **ozby** account (same token that
      deploys ingest-lens), update Doppler, re-run **Deploy production**
- [ ] Green `Deploy production` workflow on `main` (`/health`, `/`, `production-smoke`, `production-journey`)
- [ ] Record evidence in completion notes and close parent manual-smoke checkbox

## Execution checklist

- [x] Add explicit superseding/remediation notes to implicated completed blueprints
- [x] Tighten README / release / secrets doc truthfulness (Doppler-only, implemented workflows; Photoroom remnants removed)
- [x] Make production-sensitive adapter config fail loudly (`adapter-semantics.test.ts`)
- [x] Replace internal-import local E2E with boundary-faithful reviewer-flow coverage (`upload-delete`, `upload-delete-contract`, `production-journey`)
- [x] Implement cleanup-on-failure and deadline-bounded provider behavior
- [x] Reconcile upload-size contract to 8 MiB (worker + client tests aligned)
- [ ] Finish landing workspace quality-rail alignment (`agent-kit` / `vite-plus`, root/app tsconfig + Vitest + lint contract, CI expectation sync)
- [ ] Green production deploy CI + post-deploy `production-smoke` + `production-journey`
- [ ] Run architecture drift plus full verification and record evidence

Exact stop condition:

- Stop only when the reviewer-critical browser path is proven by boundary-faithful tests,
  the shared `agent-kit` / `vite-plus` quality rails are the real enforcement surface,
  production truth is stated honestly in docs/blueprints, and a green deploy proves
  `/health`, `/`, `production-smoke`, and `production-journey` on `edge-matte.ozby.dev`.

## Test design

### Unit tests

- explicit adapter-behavior tests for missing `IMAGES` handling;
- upload-size contract tests shared across worker/client validation helpers;
- timeout and cleanup helper tests for failure-path behavior.

### Integration tests

- Worker runtime tests for real adapter wiring and failure semantics;
- route tests for config-missing and cleanup behavior;
- CI/workflow tests for docs/blueprint/deploy checks.

### E2E tests

- browser/runtime reviewer-flow test: upload -> processing -> result URL ->
  delete -> post-delete failure;
- production smoke that verifies the actual deployed public URL, not an
  internal harness facsimile;
- production journey that uploads a real fixture, verifies transformed output,
  and deletes it again on `edge-matte.ozby.dev`.

### Strict confidence checks

- fail if E2E still imports Worker/core internals to manufacture success;
- fail if production config absence still yields a silent happy-path result;
- fail if blueprint/docs claim live healthy production without successful
  `production-smoke` and `production-journey` results;
- fail if upload-size contract differs across blueprint/code/tests.

## Parallel execution plan

## Quick Reference (Execution Waves)

| Wave | Tasks | Dependencies | Parallelizable | Effort (T-shirt) |
| --- | --- | --- | --- | --- |
| **Wave 0** | 1.1, 1.2, 3.3 | None | 3 agents | XS-S |
| **Wave 1** | 2.1, 2.2, 2.3, 3.1, 3.2 | Wave 0 (partial) | 5 agents | S-M |
| **Wave 2** | 4.1 | Waves 0-1 | 1 agent | S |
| **Critical path** | 1.2 → 3.2 → 4.1 | — | 3 waves | M |

### Parallel Metrics Snapshot

| Metric | Formula / Meaning | Target | Actual |
| --- | --- | --- | --- |
| RW0 | Ready tasks in Wave 0 | ≥ planned agents / 2 | 3 |
| CPR | total_tasks / critical_path_length | ≥ 2.5 | 3.0 |
| DD | dependency_edges / total_tasks | ≤ 2.0 | 1.22 |
| CP | same-file overlaps per wave | 0 | 0 |

Refinement delta: moved Task 3.3 into the real parallel wave, marked the
already-landed browser/runtime and cleanup work complete, and expanded Task 3.2
so it matches the current `agent-kit` / `vite-plus` quality-rail alignment work
in the repo and working tree. Parallelization score: **A**.

### Wave 1 — red-test capture and truth baseline

#### [qa] Task 1.1: Capture the false-green behavior in durable tests

**Status:** done

The false-green cases are now preserved as durable assertions rather than a
loose audit note: browser-vs-contract naming is explicit, adapter failures are
fail-loud, cleanup/deadline behavior is covered, and the upload-size contract is
encoded in tests. These tests now pass because the gaps they captured were fixed.

**Depends:** None

Keep the regression surface explicit so future changes cannot silently reintroduce
internal-import E2E shortcuts, silent adapter fallbacks, cleanup regressions, or
size-contract drift.

**Files:**

- Modify: `apps/e2e/journeys/upload-delete.contract.test.ts`
- Modify: `apps/e2e/journeys/upload-delete.spec.ts`
- Modify: `apps/e2e/src/e2e-suite-manifest.ts`
- Modify: `apps/worker/test/adapter-semantics.test.ts`
- Modify: `apps/worker/test/process-image-job.test.ts`
- Modify: `apps/client/test/app.test.ts`

**Steps (TDD):**

1. Add/rename tests so browser E2E, HTTP contract, and production smoke/journey lanes are named honestly.
2. Add failing tests for missing provider/binding config behavior.
3. Add failing tests for cleanup-on-failure and upload-size drift.
4. Make the renamed/asserted suites pass without weakening the assertions.

**Acceptance:**

- [x] Current gaps are expressed as tests or durable assertions instead of prose-only warnings.
- [x] Test names distinguish browser E2E from contract/smoke coverage.

#### [docs] Task 1.2: Establish truthful doc and blueprint baseline

**Status:** done

README / release / completed-blueprint truth tightening already landed, and the
docs lane now reflects the current deploy and secrets model without preserving
stale Photoroom or false-production wording.

**Depends:** None

Keep active docs and completion notes honest without rewriting milestone history.
Only reopen this task if final verification materially changes the truth state.

**Files:**

- Modify: `README.md`
- Modify: `docs/release.md`
- Modify: `blueprints/completed/2026-05-27-edge-matte-infra-and-release.md`
- Modify: `blueprints/completed/2026-05-27-edge-matte-ui-and-e2e.md`

**Steps (TDD):**

1. Identify statements that outran the available evidence.
2. Rewrite them to match current reality (Doppler-only secret flow, deploy truth, honest E2E naming).
3. Add superseding notes instead of rewriting historical claims out of existence.

**Acceptance:**

- [x] Active docs no longer imply stronger production confidence than evidence supports.
- [x] Historical blueprints remain legible as history.

### Wave 2 — runtime and boundary hardening

#### [qa] Task 2.1: Replace fake E2E with boundary-faithful reviewer flow

**Status:** done

The reviewer-critical browser lane is now a Playwright journey (`upload-delete`)
through the served app/runtime boundary, while the HTTP-only contract lane is
explicitly named `upload-delete-contract`.

**Depends:** Task 1.1

Keep the reviewer flow browser-faithful and resist regression toward internal
Worker/core imports or Vitest-only happy-path simulations.

**Files:**

- Modify: `apps/e2e/fixtures/sample.png`
- Modify: `apps/e2e/global-setup.ts`
- Modify: `apps/e2e/journeys/upload-delete.spec.ts`
- Modify: `apps/e2e/journeys/upload-delete.contract.test.ts`
- Modify: `apps/e2e/journeys/production-journey.smoke.test.ts`
- Modify: `apps/e2e/playwright.config.ts`
- Modify: `apps/e2e/src/e2e-suite-manifest.ts`
- Modify: `apps/e2e/src/e2e-suite-manifest.test.ts`
- Modify: `agent-kit.config.ts`

**Steps (TDD):**

1. Add a failing browser/runtime reviewer-flow test.
2. Ensure `upload-delete` executes through a real browser runner against the served app/runtime boundary.
3. Rename the HTTP-only suite to `upload-delete-contract` and keep production smoke/journey separate.
4. Make the new browser lane pass with no internal Worker/core imports in `apps/e2e`.

**Acceptance:**

- [x] Reviewer-critical flow is covered through browser/runtime boundaries.
- [x] Reviewer-critical flow is not implemented as Vitest + `fetch` alone.
- [x] Internal Worker/core imports are not used to manufacture E2E success.

#### [backend] Task 2.2: Fail loudly on missing production-sensitive config

**Status:** done

The Cloudflare adapter path now rejects missing `IMAGES` bindings instead of
silently returning the original image. Mock mode remains explicit via
`E2E_MOCK_PIPELINE=1`.

**Depends:** Task 1.1

Remove silent success behavior when provider/binding config is absent in the
production-sensitive path. Keep mocks explicit for local/test wiring.

**Files:**

- Modify: `apps/worker/src/adapters/cloudflare/cf-image-segment-provider.ts`
- Modify: `apps/worker/src/adapters/cloudflare/images-transformer.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/test/adapter-semantics.test.ts`

**Steps (TDD):**

1. Add failing tests for missing `IMAGES`.
2. Decide and codify explicit failure semantics.
3. Keep local/test mock wiring explicit rather than silent.
4. Make tests pass.

**Acceptance:**

- [x] Production-sensitive config absence no longer yields silent happy-path output.
- [x] Local/test mock behavior remains explicit and documented.

#### [backend] Task 2.3: Implement cleanup-on-failure and provider deadlines

**Status:** done

`processImageJob()` now records failed metadata, cleans orphaned blobs after
provider/transform failures, and enforces a background-removal deadline. The
remaining live-deploy proof is tracked in Task 4.1 rather than here.

**Depends:** Task 1.1

Make the Worker core match the documented failure semantics: cleanup of
artifacts when provider/transform steps fail, plus deadline-bounded provider
execution.

**Files:**

- Modify: `apps/worker/src/core/process-image-job.ts`
- Modify: `apps/worker/src/ports/index.ts`
- Modify: `apps/worker/src/adapters/cloudflare/cf-image-segment-provider.ts`
- Modify: `apps/worker/test/process-image-job.test.ts`

**Steps (TDD):**

1. Add failing tests for provider timeout and cleanup behavior.
2. Implement explicit signal/timeout handling in the core pipeline.
3. Implement cleanup semantics that delete orphaned original/processed blobs while preserving failed metadata/status until explicit delete or retention cleanup.
4. Make tests pass.

**Acceptance:**

- [x] Failure-path cleanup behavior is implemented and tested.
- [x] Failed job metadata remains readable after provider/transform failure.
- [x] Provider execution is deadline-bounded and covered by tests.

### Wave 3 — contract and quality alignment

#### [backend] Task 3.1: Reconcile the upload-size contract

**Status:** done

The repo now converges on the 8 MiB upload contract in code, UI messaging, and
tests.

**Depends:** Task 1.1

Converge blueprint, worker, client, and tests to the existing 8 MiB contract
unless that contract is intentionally revised in the same change with explicit
rationale.

**Files:**

- Modify: `apps/worker/src/core/process-image-job.ts`
- Modify: `apps/client/src/format.ts`
- Modify: `apps/worker/test/process-image-job.test.ts`
- Modify: `apps/client/test/app.test.ts`

**Steps (TDD):**

1. Add failing tests that encode the chosen limit.
2. Converge code/tests/messages back to the existing 8 MiB contract.
3. Do not rewrite the completed principal blueprint during normal convergence to 8 MiB.
4. If a non-8-MiB limit is intentionally chosen instead, require same-change ADR + architecture source-of-truth updates + explicit rationale.
5. Remove contradictory messages/assertions.

**Acceptance:**

- [x] The repo converges on one explicit upload-size contract.
- [x] Any future non-8-MiB limit change must be justified in the same change rather than silently redefined by code.

#### [infra] Task 3.2: Finish workspace quality-rail alignment and CI truthfulness

**Status:** in_progress

The remaining quality-gate work is no longer just about placeholder lint.
Uncommitted changes already align root/app/infra `package.json`, `tsconfig`, and
Vitest config with shared `agent-kit` / `vite-plus` surfaces; this task now
tracks landing that alignment cleanly and proving CI/workflow expectations still
match the repo.

**Depends:** Task 1.2

Remove the last bespoke/no-op quality rails and make CI match what the infra
blueprint claims it enforces.

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Create: `oxlint.config.ts`
- Modify: `apps/client/package.json`
- Modify: `apps/client/tsconfig.json`
- Modify: `apps/client/vitest.config.ts`
- Modify: `apps/e2e/package.json`
- Modify: `apps/e2e/tsconfig.json`
- Modify: `apps/e2e/vitest.config.ts`
- Modify: `apps/worker/package.json`
- Modify: `apps/worker/tsconfig.json`
- Modify: `apps/worker/vitest.config.ts`
- Modify: `infra/package.json`
- Modify: `infra/tsconfig.json`
- Modify: `.github/workflows/ci.webpresso.yml`
- Modify: `.github/workflows/deploy.production.yml`
- Modify: `test/helpers/infra-release-workflow-expectations.mjs`

**Steps (TDD):**

1. Encode any missing workflow/package expectations before changing the commands or config.
2. Finish routing root/app/infra typecheck, lint, and Vitest config through shared `agent-kit` / `vite-plus` surfaces instead of bespoke per-package drift.
3. Keep CI on frozen-lockfile installs, direct `wp audit architecture-drift --root .`, and the current pinned-action supply-chain posture.
4. Verify docs/blueprint/workflow expectations stay in lockstep after the config changes land.

**Acceptance:**

- [ ] Root and package-local quality rails use shared `agent-kit` / `vite-plus` surfaces where available.
- [ ] The remaining lint/typecheck/test scripts are real, not placeholders or divergent wrappers.
- [ ] PR CI and deploy verification reflect the actual claimed gates.

#### [infra] Task 3.3: Close the production deploy smoke propagation lane

**Status:** in_progress

The propagation helper, deploy-script reuse, credential probe, and post-deploy
`production-journey` hook are already in the repo. What remains is operator
credential repair plus one green `main` deployment with evidence.

**Depends:** None

Close the last live-production confidence gap: route propagation is handled in
code, but the deploy job still needs a valid ozby-account token and a recorded
green run.

**Files:**

- Modify: `.github/workflows/deploy.production.yml`
- Modify: `scripts/wait-for-http.sh`
- Modify: `scripts/deploy-production.ts`
- Modify: `test/helpers/infra-release-workflow-expectations.mjs`

**Steps (TDD):**

1. Keep the post-deploy health polling helper shared between CI and local deploy.
2. Keep workflow expectations/tests asserting `/health`, `/`, `production-smoke`, and `production-journey`.
3. Rotate the ozby-account `CLOUDFLARE_API_TOKEN`, update Doppler, and re-run **Deploy production** on `main`.
4. Record the green run as evidence before closing the parent manual-smoke checkbox.

**Acceptance:**

- [x] Deploy workflow polls `/health` and `/` instead of a single immediate `curl`.
- [x] Deploy workflow invokes both `production-smoke` and `production-journey`.
- [ ] `Deploy production` GitHub Action is green on `main`.
- [ ] `E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-smoke` passes after deploy.
- [ ] `E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey` passes after deploy.

### Wave 4 — verification and closure

#### [qa] Task 4.1: Re-run repo-wide verification and close the truth gap

**Status:** todo

**Depends:** Task 2.1, Task 2.2, Task 2.3, Task 3.1, Task 3.2, Task 3.3

Run the final verification surface, update completion notes if the truth state
changes again, and leave a reviewer-readable evidence trail. This is now mostly
a closure task: the core runtime/E2E fixes are landed, but the quality-rail and
live-production evidence still need one final pass.

**Files:**

- Modify: `blueprints/in-progress/2026-05-27-edge-matte-audit-remediation.md`
- Modify: `blueprints/completed/2026-05-27-edge-matte.md`
- Modify: `blueprints/completed/2026-05-27-edge-matte-infra-and-release.md`
- Modify: `blueprints/completed/2026-05-27-edge-matte-ui-and-e2e.md`
- Modify: `README.md`
- Modify: `docs/release.md`

**Steps (TDD):**

1. Run the scoped and repo-wide verification commands below.
2. Fix any remaining workflow/config drift exposed by Task 3.2 or the live deploy lane from Task 3.3.
3. Run `wp audit architecture-drift --root .` after the final truth update.
4. Record only what is actually proven.

**Acceptance:**

- [ ] Verification evidence is recorded.
- [ ] Architecture drift passes.
- [ ] Final docs/blueprints match the observed truth.

## Verification

```bash
vp run verify:secrets
wp audit absolute-path-policy --root .
vp run audit:secret-provider-quarantine
vp run format:check
vp run typecheck
vp run lint
vp run test
vp run audit:blueprint-links
wp audit docs-frontmatter
wp audit blueprint-lifecycle --legacy-omx
vp run e2e -- --suite smoke
vp run e2e -- --suite upload-delete-contract
vp run e2e -- --suite upload-delete
vp exec --filter @edge-matte/worker -- wrangler deploy --dry-run --env production
wp audit architecture-drift --root .
```

When the production lane is intentionally included:

```bash
E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-smoke
E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey
```

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Browser-faithful E2E adds cost and latency | Slower CI and local runs | Keep non-browser contract tests, but name them honestly and reserve browser E2E for the reviewer-critical path. |
| Louder config failures may break local demos | Short-term friction | Keep explicit mock/test wiring separate from production-sensitive wiring (`E2E_MOCK_PIPELINE=1`). |
| Workspace quality-rail alignment exposes hidden config drift | Short-term red CI / local checks | Land root/app/infra `agent-kit` / `vite-plus` config changes together and verify workflow expectations in lockstep. |
| Production deploy remains blocked on external credential pairing | Closure depends on operator action | Rotate the ozby-account token, re-run `Deploy production`, and do not mark the lane complete without recorded green evidence. |
| Truthfulness updates may make the repo look less "done" | Social discomfort | Prefer accurate status now over compound rework later. |

## ADR

### Decision

Create a dedicated remediation blueprint that hardens confidence, truthfulness,
and verification without changing the runtime topology.

### Drivers

- trustworthy reviewer-flow verification
- explicit runtime failure semantics
- blueprint/doc/code/CI alignment

### Alternatives considered

- rewrite completed blueprints in place
- leave the audit as conversational feedback only

### Why chosen

The repo needs an executable corrective artifact while preserving milestone
history as history.

### Consequences

- adds one more active blueprint
- creates a single place to track audit closure
- preserves historical record while explicitly superseding overclaim

### Follow-ups

- implement this blueprint
- re-run production smoke after deploy truth is restored
- only then mark any downstream confidence claims stronger again

## Goal-Mode Follow-up Suggestions

- **Default durable follow-up:** `$ultragoal`
- **Parallel delivery:** `$team` + `$ultragoal`
- **Explicit single-owner fallback only:** `$ralph`
