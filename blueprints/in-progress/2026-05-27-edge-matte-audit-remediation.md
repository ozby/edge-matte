---
type: blueprint
title: "EdgeMatte: audit remediation and confidence hardening"
status: in-progress
created: 2026-05-27
last_updated: 2026-05-27
review_target: public GitHub repository
parent_blueprint: 2026-05-27-edge-matte
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
| E2E boundaries   | `apps/e2e/**`, `agent-kit.config.ts`                                                                                                                                              | Playwright + renamed contract/smoke suites — Task 2.1               |
| Worker runtime   | `apps/worker/src/adapters/**`, `apps/worker/src/core/process-image-job.ts`, `apps/worker/test/**`                                                                                 | Adapter fail-loud tests landed — finish cleanup/timeout in Task 2.3 |
| Docs truth       | `README.md`, `docs/release.md`, `blueprints/README.md`, completion notes in `blueprints/completed/*.md`                                                                           | Task 1.2 — supersede, do not rewrite history                        |

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
platform complexity.

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

- `blueprints/completed/*.md` (notes/truthfulness only where needed)
- `blueprints/in-progress/2026-05-27-edge-matte-audit-remediation.md`
- `README.md`
- `docs/release.md`
- `.github/workflows/*.yml`
- `blueprints/completed/2026-05-27-edge-matte-ui-and-e2e.md`
- `blueprints/completed/2026-05-27-edge-matte-infra-and-release.md`
- `apps/e2e/**`
- `apps/worker/**`
- `apps/client/**`

## Not in scope

- auth or multi-user features
- queue-mode promotion
- database introduction
- new product scope beyond confidence restoration

## Evidence motivating this blueprint

- Internal-import E2E harness: `apps/e2e/src/test-harness.ts`
- E2E blueprint forbids internal-import manufactured passes: `blueprints/completed/2026-05-27-edge-matte-ui-and-e2e.md`
- Infra blueprint stop condition requires a live healthy deployment before completion: `blueprints/completed/2026-05-27-edge-matte-infra-and-release.md`
- Silent runtime fallbacks: `apps/worker/src/adapters/photoroom/photoroom-provider.ts`, `apps/worker/src/adapters/cloudflare/images-transformer.ts`
- Missing cleanup semantics in failure path: `apps/worker/src/core/process-image-job.ts`
- 8 MiB vs 10 MiB contract drift: principal blueprint vs worker/client

## Acceptance criteria

- Active docs and blueprint notes no longer overstate production readiness.
- Reviewer-critical E2E coverage goes through browser/runtime boundaries and no
  longer imports internal Worker/core modules to manufacture a passing result.
- The reviewer-critical suite (`upload-delete` or an explicitly renamed
  equivalent) runs on a real browser runner against the served app/runtime
  boundary, not Vitest + `fetch` alone.
- Any remaining non-browser contract tests are named and scoped honestly.
- Production adapter misconfiguration fails loudly instead of silently passing
  the original image through.
- `processImageJob()` failure paths perform the documented cleanup semantics, or
  the architecture/docs are explicitly narrowed in the same change.
- Upload-size contract is consistent across blueprint, worker, client, and
  tests.
- Placeholder lint surfaces are replaced with real checks or removed from
  claimed quality gates.
- PR CI matches the checks promised in the infra blueprint.
- `python3 scripts/check_architecture_drift.py` passes after all updates.

## Wave 0 — secrets governance (ingest-lens parity)

**Status:** complete in working tree (pending merge). No runtime topology change.

- [x] Doppler-only CI bootstrap (`DOPPLER_SERVICE_TOKEN` + `dopplerhq/secrets-fetch-action`)
- [x] Committed metadata-only `.webpresso/secrets.config.json` → `ozby-shell`
- [x] `scripts/verify-secrets-policy.ts` (disk + git carriers + token patterns)
- [x] `scripts/sync-webpresso-config.ts` via `wp config secrets set`
- [x] `scripts/audit-secret-provider-quarantine.ts` (no dotenv / direct provider bypass)
- [x] `docs/secrets.md`, `docs/release.md`, `README.md`, `AGENTS.md` aligned
- [x] Pre-commit matches `verify:secrets` + `verify:paths` + quarantine

## Wave 0.5 — production deploy CI green

**Status:** in progress (this pass).

- [x] Root cause: post-deploy `curl` ran before Workers route propagation
- [x] `scripts/wait-for-http.sh` — shared polling for CI and `deploy-production.ts`
- [ ] Green `Deploy production` workflow on `main` (smoke + `production-smoke` e2e)
- [ ] Record evidence in completion notes and close parent manual-smoke checkbox

## Execution checklist

- [x] Add explicit superseding/remediation notes to implicated completed blueprints
- [x] Tighten README / release / secrets doc truthfulness (Doppler-only, implemented workflows)
- [x] Make production-sensitive adapter config fail loudly (`adapter-semantics.test.ts`)
- [ ] Replace or supplement internal-import local E2E with boundary-faithful reviewer-flow coverage
- [ ] Implement cleanup-on-failure and deadline-bounded provider behavior (partial — deadline signal test exists)
- [x] Reconcile upload-size contract to 8 MiB (worker + client tests aligned)
- [ ] Replace remaining placeholder lint/CI gaps with real enforcement
- [ ] Green production deploy CI + post-deploy `production-smoke`
- [ ] Run architecture drift plus full verification and record evidence

Exact stop condition:

- Stop only when a reviewer-critical path is proven by boundary-faithful tests,
  production truth is stated honestly in docs/blueprints, and the runtime
  behavior matches the documented architecture rather than a softened local demo
  path.

## Test design

### Unit tests

- explicit adapter-behavior tests for missing `PHOTOROOM_API_KEY` /
  missing `IMAGES` handling;
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
  internal harness facsimile.

### Strict confidence checks

- fail if E2E still imports Worker/core internals to manufacture success;
- fail if production config absence still yields a silent happy-path result;
- fail if blueprint/docs claim live healthy production without a successful
  production smoke result;
- fail if upload-size contract differs across blueprint/code/tests.

## Parallel execution waves

### Wave 1 — red tests and truth baseline

#### [qa] Task 1.1: Capture the current false-green behavior

**Status:** in progress (adapter-semantics + e2e rename landed; browser lane open)

**Depends:** None

Write failing tests and assertions that expose the current confidence gaps:
misleading E2E boundary usage, silent adapter fallback behavior, missing
cleanup-on-failure, and contract-size drift. The goal is to prevent the
remediation work from being "fixed" only in prose.

**Files:**

- Modify: `apps/e2e/**`
- Modify: `apps/worker/test/*.ts`
- Modify: `apps/client/test/*.ts`

**Steps (TDD):**

1. Add/rename tests so boundary-faithful versus contract-only coverage is explicit.
2. Add failing tests for missing provider/binding config behavior.
3. Add failing tests for cleanup-on-failure behavior.
4. Add failing tests for size-limit contract mismatch.

**Acceptance:**

- [ ] Current gaps are expressed as failing tests or failing assertions.
- [ ] Test names distinguish browser E2E from internal contract tests.

#### [docs] Task 1.2: Establish truthful doc and blueprint baseline

**Status:** in progress (secrets/release/README updated; parent checkbox pending CI green)

**Depends:** None

Update active docs and any completion notes that currently overstate production
readiness or verification strength, without rewriting milestone history.

**Files:**

- Modify: `README.md`
- Modify: `docs/release.md`
- Modify: `blueprints/completed/2026-05-27-edge-matte-infra-and-release.md`
- Modify: `blueprints/completed/2026-05-27-edge-matte-ui-and-e2e.md`

**Steps (TDD):**

1. Identify statements that outrun evidence.
2. Rewrite them to match observed truth.
3. Keep historical record intact; add superseding notes instead of pretending the earlier claim never existed.

**Acceptance:**

- [ ] Active docs no longer imply stronger production confidence than evidence supports.
- [ ] Historical blueprints remain legible as history.

### Wave 2 — runtime and test-surface hardening

#### [qa] Task 2.1: Replace fake E2E with boundary-faithful reviewer flow

**Status:** todo

**Depends:** Task 1.1

Introduce a browser/runtime-faithful E2E lane for the core reviewer path.
Contract-only tests may remain, but must be renamed and scoped honestly.

**Files:**

- Modify: `apps/e2e/**`
- Modify: `agent-kit.config.ts`

**Steps (TDD):**

1. Add a failing browser/runtime reviewer-flow test.
2. Ensure `upload-delete` (or an explicitly renamed successor) executes through
   a real browser runner against the served app/runtime boundary.
3. Rename any remaining non-browser contract tests so they do not present as E2E.
4. Make the new lane pass.

**Acceptance:**

- [ ] Reviewer-critical flow is covered through browser/runtime boundaries.
- [ ] Reviewer-critical flow is not implemented as Vitest + `fetch` alone.
- [ ] Internal Worker/core imports are not used to manufacture E2E success.

#### [backend] Task 2.2: Fail loudly on missing production-sensitive config

**Status:** done in working tree — verify on merge, then mark acceptance complete

**Depends:** Task 1.1

Remove silent success behavior when provider/binding config is absent in the
production-sensitive path. Keep mocks explicit for local/test wiring.

**Files:**

- Modify: `apps/worker/src/adapters/photoroom/photoroom-provider.ts`
- Modify: `apps/worker/src/adapters/cloudflare/images-transformer.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/test/*.ts`

**Steps (TDD):**

1. Add failing tests for missing `PHOTOROOM_API_KEY` and `IMAGES`.
2. Decide and codify explicit failure semantics.
3. Keep local/test mock wiring explicit rather than silent.
4. Make tests pass.

**Acceptance:**

- [ ] Production-sensitive config absence no longer yields silent happy-path output.
- [ ] Local/test mock behavior remains explicit and documented.

#### [backend] Task 2.3: Implement cleanup-on-failure and provider deadlines

**Status:** todo

**Depends:** Task 1.1

Make the Worker core match the documented failure semantics: cleanup of
artifacts when provider/transform steps fail, plus deadline-bounded provider
execution.

**Files:**

- Modify: `apps/worker/src/core/process-image-job.ts`
- Modify: `apps/worker/src/ports/index.ts`
- Modify: `apps/worker/src/adapters/photoroom/photoroom-provider.ts`
- Modify: `apps/worker/test/*.ts`

**Steps (TDD):**

1. Add failing tests for provider timeout and cleanup behavior.
2. Implement explicit signal/timeout path.
3. Implement cleanup semantics that delete orphaned original/processed blobs
   while preserving failed job metadata/status until explicit delete or
   lifecycle retention cleanup.
4. Make tests pass.

**Acceptance:**

- [ ] Failure-path cleanup behavior is implemented and tested.
- [ ] Failed job metadata remains readable after provider/transform failure.
- [ ] Provider execution is deadline-bounded and covered by tests.

### Wave 3 — contract and quality alignment

#### [backend] Task 3.1: Reconcile the upload-size contract

**Status:** done in working tree (8 MiB in worker + client)

**Depends:** Task 1.1

Converge blueprint, worker, client, and tests to the existing 8 MiB contract
unless that contract is intentionally revised in the same change with explicit
rationale.

**Files:**

- Modify: `apps/worker/src/core/process-image-job.ts`
- Modify: `apps/client/src/format.ts`
- Modify: `apps/worker/test/*.ts`
- Modify: `apps/client/test/*.ts`

**Steps (TDD):**

1. Add failing tests that encode the chosen limit.
2. Converge code/tests/messages back to the existing 8 MiB contract.
3. Do not rewrite the completed principal blueprint during normal convergence to
   8 MiB.
4. If a non-8-MiB limit is intentionally chosen instead, require same-change
   ADR + architecture source-of-truth updates + explicit rationale.
5. Remove contradictory messages/assertions.

**Acceptance:**

- [ ] The repo converges on one explicit upload-size contract.
- [ ] If the limit differs from 8 MiB, the contract change is justified in the
      same change rather than silently redefined by code.

#### [infra] Task 3.2: Replace placeholder quality gates and CI gaps

**Status:** todo

**Depends:** Task 1.2

Remove the current placeholder lint posture and make CI match what the infra
blueprint claims it enforces.

**Files:**

- Modify: `apps/client/package.json`
- Modify: `apps/e2e/package.json`
- Modify: `.github/workflows/ci.webpresso.yml`

**Steps (TDD):**

1. Add failing workflow/config assertions for missing docs/blueprint checks.
2. Replace no-op lint commands with real checks or remove them from claimed gates.
3. Add verification coverage for secrets, docs, blueprint lifecycle, and deploy dry-run.
4. Make CI and package scripts align.

**Acceptance:**

- [ ] Client/e2e lint surfaces are real.
- [ ] PR CI includes the checks the blueprint promises.

### Wave 4 — verification and closure

#### [qa] Task 4.1: Re-run repo-wide verification and close the truth gap

**Status:** todo

**Depends:** Task 2.1, Task 2.2, Task 2.3, Task 3.1, Task 3.2

Run the final verification surface, update completion notes, and leave a
reviewer-readable evidence trail.

**Files:**

- Modify: relevant docs/blueprints only if verification changes the truth state

**Steps (TDD):**

1. Run scoped and repo-wide verification.
2. Fix remaining drift.
3. Run architecture drift check.
4. Record what is actually proven.

**Acceptance:**

- [ ] Verification evidence is recorded.
- [ ] Architecture drift passes.
- [ ] Final docs/blueprints match the observed truth.

#### [infra] Task 3.3: Production deploy smoke propagation

**Status:** in progress

Add resilient post-deploy health polling so CI does not fail while Cloudflare
routes propagate. Reuse the same helper for operator-local deploy.

**Files:**

- Add: `scripts/wait-for-http.sh`
- Modify: `.github/workflows/deploy.production.yml`
- Modify: `scripts/deploy-production.ts`
- Modify: `test/helpers/infra-release-workflow-expectations.mjs`

**Acceptance:**

- [x] Deploy workflow polls `/health` and `/` instead of single immediate `curl`
- [ ] `Deploy production` GitHub Action is green on `main`
- [ ] `E2E_RUN_PRODUCTION=1 pnpm e2e -- --suite production-smoke` passes after deploy

## Verification

```bash
pnpm run verify:secrets
pnpm run verify:paths
pnpm run audit:secret-provider-quarantine
vp run -r lint
vp run -r check-types
pnpm run test
pnpm run docs:check
pnpm run blueprints:check
pnpm run e2e -- --suite smoke
pnpm run e2e -- --suite upload-delete
pnpm --filter @edge-matte/worker exec wrangler deploy --dry-run --env production
python3 scripts/check_architecture_drift.py
```

When the production lane is intentionally included:

```bash
E2E_RUN_PRODUCTION=1 pnpm run e2e -- --suite production-smoke
```

## Risks

| Risk                                                    | Impact                   | Mitigation                                                                                                     |
| ------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Browser-faithful E2E adds cost and latency              | Slower CI and local runs | Keep non-browser contract tests, but name them honestly and reserve browser E2E for the reviewer-critical path |
| Louder config failures may break local demos            | Short-term friction      | Keep explicit mock/test wiring separate from production-sensitive wiring                                       |
| Truthfulness updates may make the repo look less "done" | Social discomfort        | Prefer accurate status now over compound rework later                                                          |

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
