---
type: blueprint
complexity: M
owner: ozby
title: "EdgeMatte: end-to-end confidence suite"
status: in-progress
created: 2026-05-29
last_updated: 2026-06-05
review_target: public GitHub repository
depends_on:
  - 2026-05-27-edge-matte-audit-remediation
  - 2026-05-29-edge-matte-shared-cloudflare-deploy-contract
progress: "79% (6 complete, 1 blocked; release-doc parity is locked and production deploy evidence is captured, but GitHub required-check enforcement is still external as of 2026-06-06)"
---

# EdgeMatte: end-to-end confidence suite

Make a green CI mean the product actually works. Refined on **2026-05-30**
against the current repo state, including the already-landed Playwright/browser
journey, hermetic PR `e2e` gate, production-journey wiring, workflow
supply-chain hardening, direct `architecture-drift` audit usage, the IMAGES
binding fix for background removal, and the production-journey local-setup skip.
This blueprint is now mostly a **status-accurate follow-through and verification
lane**, not a net-new test-harness design.

## Product wedge anchor

- **Stage outcome:** A YC take-home reviewer must trust the live demo
  ([Architecture](../../docs/architecture.md) flow) on first contact — the
  upload → matte → flip → host → delete journey is the product.
- **Consuming surface:** the CI `e2e` job in
  [ci.yml](../../.github/workflows/ci.yml), the journey specs
  under [apps/e2e/journeys](../../apps/e2e/journeys), and the post-deploy
  `production-journey` in
  [deploy-production.yml](../../.github/workflows/deploy-production.yml).
- **New user-visible capability:** every PR should show a green check that proves
  the full mock-mode journey, and every successful production deploy should prove
  the real background-removal + flip transform on `edge-matte.ozby.dev` before
  users see it.

Deployment-contract note: this blueprint should consume whatever shared
preview/main/prod lane contract lands via
[`../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`](../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md).
It owns confidence coverage, not reusable deploy-policy extraction itself.

## Multi-agent coordination

Current repo state already has concurrent config churn outside this blueprint.
If execution resumes with multiple agents, treat these as lane boundaries:

| Lane             | Primary paths                                                                                                                                                                                                                                                                                                                                                                        | Notes                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| E2E runtime      | `apps/e2e/**`, `apps/worker/**`, `.github/workflows/ci.yml`, `.github/workflows/deploy-production.yml`                                                                                                                                                                                                                                                                               | Main confidence-lane code already partly landed; avoid duplicate suite rewrites.                     |
| Shared config    | `apps/client/package.json`, `apps/client/tsconfig.json`, `apps/client/vitest.config.ts`, `apps/e2e/package.json`, `apps/e2e/tsconfig.json`, `apps/e2e/vitest.config.ts`, `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/vitest.config.ts`, `infra/package.json`, `infra/tsconfig.json`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `oxlint.config.ts` | Uncommitted config updates are in flight; do not revert them while closing this blueprint.           |
| Docs / lifecycle | `README.md`, `docs/architecture.md`, `docs/release.md`, `blueprints/README.md`                                                                                                                                                                                                                                                                                                       | README + architecture are already largely updated; release/lifecycle docs still need parity cleanup. |

## Architecture governance

Architecture docs:

- [Architecture](../../docs/architecture.md)
- [Architecture Contract](../../docs/architecture.contract.json)

## Architecture before

As of 2026-05-30, the repo is no longer at the original "missing suite" stage:

- PR CI already has a hermetic `e2e` job in
  [ci.yml](../../.github/workflows/ci.yml) running explicit
  `upload-delete-contract`, `smoke`, and `upload-delete` suites with Playwright
  browser caching and no `secrets.*` dependency.
- The browser journey is already TypeScript
  ([upload-delete.spec.ts](../../apps/e2e/journeys/upload-delete.spec.ts)) and
  the stale `.mjs` files are gone.
- The contract suite already asserts the real current API envelope, valid PNG
  bytes, security headers, SPA delegation, and honest mock-mode expectations.
- Post-deploy production verification already runs both
  `production-smoke` and `production-journey` in
  [deploy-production.yml](../../.github/workflows/deploy-production.yml), and
  local setup is skipped for production journeys.
- The remaining gaps are now narrower: production-green evidence is still
  coupled to the remediation blueprint’s deploy-credential truth, GitHub
  required-check / ruleset enforcement is external to the repo, and
  [docs/release.md](../../docs/release.md) still lags the new
  `production-journey` contract in several places.

## Architecture after

The runtime topology stays the same — one Worker, static assets, one R2 bucket,
one pure pipeline core deployed at `edge-matte.ozby.dev` — but confidence and
release truth close the final gaps:

- the hermetic PR gate remains the reviewer-critical mock-mode confidence layer;
- the live `production-journey` remains the only layer that proves real
  `cf.image` background removal + horizontal flip;
- release docs and lifecycle notes explicitly name both post-deploy suites and
  the external GitHub required-check/ruleset dependency;
- final readiness is gated by successful post-deploy evidence, not just by repo
  wiring existing on disk.

## Refinement findings (2026-05-30)

| ID  | Severity | Claim in older blueprint text                            | Current repo reality                                                                                                                                                                                                                                                                                    | Blueprint fix                                                                                 |
| --- | -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| F1  | HIGH     | "No PR-gating e2e"                                       | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) already has an `e2e` job running `upload-delete-contract`, `smoke`, and `upload-delete`, with pinned action SHAs and Playwright caching.                                                                                                   | Mark repo wiring complete and narrow remaining work to required-check enforcement + evidence. |
| F2  | HIGH     | "Only production-smoke runs post-deploy"                 | [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml) now runs both `production-smoke` and `production-journey`; [global-setup.test.ts](../../apps/e2e/src/global-setup.test.ts) proves production journeys skip local boot.                                       | Mark suite/workflow wiring landed; track live-green verification separately.                  |
| F3  | MEDIUM   | "Browser spec is `.mjs` and stale"                       | [`apps/e2e/journeys/upload-delete.spec.ts`](../../apps/e2e/journeys/upload-delete.spec.ts) exists, uses current UI IDs/text, and no `.mjs` files remain in `apps/e2e/`.                                                                                                                                 | Mark the browser rewrite complete and keep the current file paths authoritative.              |
| F4  | MEDIUM   | "Contract test passes by accident on `length !==`"       | [`apps/e2e/journeys/upload-delete.contract.test.ts`](../../apps/e2e/journeys/upload-delete.contract.test.ts) now checks PNG magic bytes, honest mock-mode expectations, error envelopes, security headers, and SPA delegation.                                                                          | Mark the contract-suite correction complete.                                                  |
| F5  | HIGH     | Real transform proof still assumes the old provider path | [`cf-image-segment-provider.ts`](../../apps/worker/src/adapters/cloudflare/cf-image-segment-provider.ts) now uses the IMAGES binding for background removal, and [`production-journey.smoke.test.ts`](../../apps/e2e/journeys/production-journey.smoke.test.ts) asserts served bytes differ from input. | Update remaining work to "prove it green in production" rather than "design the suite."       |
| F6  | MEDIUM   | Docs refresh only needs README + architecture            | README + architecture already describe the hermetic gate and `production-journey`, but [`docs/release.md`](../../docs/release.md) still treats `production-smoke` as the only post-deploy proof in several spots.                                                                                       | Narrow the docs task to release/lifecycle parity.                                             |
| F7  | LOW      | Verification commands can stay on older workflow wording | The repo now has `vp run act:ci:e2e`, direct `wp audit architecture-drift --root .`, pinned GitHub actions, and current `vp`/`wp` script naming.                                                                                                                                                        | Refresh verification commands and acceptance text to the current workflow surface.            |

## Cross-plan alignment

- **Upstream blocker:**
  [`../in-progress/2026-05-27-edge-matte-audit-remediation.md`](../in-progress/2026-05-27-edge-matte-audit-remediation.md)
  still owns the live deploy-credential truth and the final green
  post-deploy-evidence lane. This blueprint should not claim completion ahead of
  that lane.
- **Shared-contract neighbor:**
  [`../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`](../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md)
  is informative but not a blocker for the local hermetic E2E gate; it matters
  only if preview/main/prod lane semantics are generalized further.
- **Lifecycle drift note:** `blueprints/README.md` active-work notes still talk
  about the remediation and deploy-contract lanes but do not yet surface this
  blueprint as a partly-landed follow-through lane.

## Quick Reference (Execution Waves)

| Wave              | Tasks                 | Dependencies                            | Parallelizable | Effort (T-shirt) |
| ----------------- | --------------------- | --------------------------------------- | -------------- | ---------------- |
| **Wave 0**        | 1.1                   | None                                    | 1 agent        | XS               |
| **Wave 1**        | 1.2, 1.3              | 1.1                                     | 2 agents       | S                |
| **Wave 2**        | 2.1, 2.2              | 1.1-1.3                                 | 2 agents       | S-M              |
| **Wave 3**        | 3.1, 3.2              | 2.1 (and prod evidence context for 3.2) | 2 agents       | XS-S             |
| **Critical path** | 1.1 → 1.2 → 2.1 → 3.1 | —                                       | 4 waves        | M                |

### Parallel Metrics Snapshot

| Metric | Formula / Meaning                  | Target               | Actual |
| ------ | ---------------------------------- | -------------------- | ------ |
| RW0    | Ready tasks in Wave 0              | ≥ planned agents / 2 | 1      |
| CPR    | total_tasks / critical_path_length | ≥ 2.5                | 1.75   |
| DD     | dependency_edges / total_tasks     | ≤ 2.0                | 1.0    |
| CP     | same-file overlaps per wave        | 0                    | 0      |

Refinement delta: score is intentionally **C** because most code-path work has
already landed in the repo outside this blueprint’s original sequence. The
remaining value is narrow evidence/docs/lifecycle follow-through, not a wide new
implementation wave.

## Task pool

#### [test] Task 1.1: Real image fixture + path-safe reader

**Status:** done

**Depends:** None

The asymmetric committed PNG fixture and path-safe fixture reader now exist and
already follow the repo’s absolute-path policy.

**Files:**

- Create: `apps/e2e/fixtures/sample.png`
- Create: `apps/e2e/src/fixtures.ts`
- Modify: `.gitattributes`

**Steps (TDD):**

1. Verify `sample.png` is committed and treated as binary in `.gitattributes`.
2. Verify [`fixtures.ts`](../../apps/e2e/src/fixtures.ts) resolves through
   `findRepoRoot(import.meta.dirname)` rather than `../` traversal.
3. Keep `wp audit absolute-path-policy --root .` green.

**Acceptance:**

- [x] `sample.png` is a valid committed PNG fixture for the E2E journeys.
- [x] `readFixture` / `readSamplePng` use repo-root resolution with no hardcoded relative root.
- [x] `.gitattributes` preserves fixture bytes as binary.

#### [test] Task 1.2: Browser journey rewritten as TypeScript Playwright coverage

**Status:** done

**Depends:** Task 1.1

The stale `.mjs` browser journey has already been replaced with a typed
Playwright suite that exercises the visible upload → ready → copy/download →
delete flow plus drag-drop and recoverable client-side validation failure.

**Files:**

- Create: `apps/e2e/playwright.config.ts`
- Create: `apps/e2e/journeys/upload-delete.spec.ts`
- Modify: `apps/e2e/tsconfig.json`

**Steps (TDD):**

1. Verify the Playwright config is TypeScript and matches `**/*.spec.ts`.
2. Verify the browser suite uses the current UI IDs/strings from
   [`ui.ts`](../../apps/client/src/ui.ts).
3. Keep `vp run e2e -- --suite upload-delete` green in hermetic mock mode.

**Acceptance:**

- [x] `upload-delete.spec.ts` covers the visible reviewer-critical journey.
- [x] `apps/e2e/playwright.config.ts` is the authoritative browser-runner config.
- [x] No `.mjs` journey/config files remain under `apps/e2e/`.

#### [test] Task 1.3: Honest HTTP contract suite

**Status:** done

**Depends:** Task 1.1

The contract suite now asserts honest mock-mode behavior instead of a false
"bytes differ" assumption, and it covers the current error/security envelope.

**Files:**

- Modify: `apps/e2e/journeys/upload-delete.contract.test.ts`

**Steps (TDD):**

1. Verify valid PNG bytes, `image/*` content type, and non-empty hosted output.
2. Verify 413/415/401/404/400 error envelopes.
3. Verify baseline security headers and SPA shell delegation.

**Acceptance:**

- [x] `upload-delete-contract` asserts honest mock-mode expectations.
- [x] Error-envelope coverage includes 413/415/401/404/400.
- [x] Security headers and `/` SPA delegation are covered.

#### [ci] Task 2.1: Hermetic PR-gating `e2e` job

**Status:** done

**Depends:** Task 1.2, Task 1.3

Repo-local workflow wiring is already in place: the CI job builds the client,
installs cached Chromium, runs explicit suites only, avoids secrets, and uploads
Playwright artifacts on failure.

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `.gitignore`

**Steps (TDD):**

1. Verify the CI `e2e` job runs `upload-delete-contract`, `smoke`, and
   `upload-delete` explicitly — never the bare default.
2. Verify Playwright browser caching and `playwright install --with-deps chromium`.
3. Verify the local dry-run entrypoint is `vp run act:ci:e2e`.

**Acceptance:**

- [x] CI has a secret-free hermetic `e2e` gate in the repo.
- [x] Explicit suite selection prevents accidental `production-*` execution on `CI=true`.
- [x] Playwright artifacts upload on failure and `.gitignore` covers generated output.

#### [release] Task 2.2: Live `production-journey` proof stays green post-deploy

**Status:** blocked

**Depends:** Task 1.1, Task 1.2

**Blocked:** GitHub required-check enforcement and durable live post-deploy evidence are still external to the repo.

The live suite and workflow wiring already exist, but this blueprint should not
claim completion until the production lane repeatedly proves the real transform
on `edge-matte.ozby.dev` with truthful deploy evidence.

**Files:**

- Create: `apps/e2e/journeys/production-journey.smoke.test.ts`
- Modify: `apps/e2e/src/e2e-suite-manifest.ts`
- Modify: `apps/e2e/src/e2e-suite-manifest.test.ts`
- Modify: `.github/workflows/deploy-production.yml`

**Steps (TDD):**

1. Verify `production-journey` is registered and local setup is skipped for
   production runs.
2. Verify the deploy workflow runs both `production-smoke` and
   `production-journey` after deploy.
3. Close the remaining live-proof gap only after the remediation blueprint’s
   deploy-credential lane is green and post-deploy evidence is captured.

**Acceptance:**

- [x] `production-journey` exists and asserts real transformed output differs from input.
- [x] The deploy workflow invokes `E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey`.
- [ ] Successful production deploy evidence exists showing the live journey passed on `edge-matte.ozby.dev`.

#### [docs] Task 3.1: Release docs parity for the new confidence contract

**Status:** done

**Depends:** Task 2.1

README and architecture are already largely current, and the release/lifecycle
parity is now locked by repo-local regression coverage so maintainers do not
silently drift back to treating `production-smoke` as the only post-deploy
proof.

**Files:**

- Modify: `docs/release.md`
- Modify: `blueprints/README.md`
- Create: `test/release-docs-parity.test.ts`

**Steps (TDD):**

1. Update `docs/release.md` so post-deploy verification, release checklist, and
   rollback criteria mention both `production-smoke` and `production-journey`.
2. Update `blueprints/README.md` active-work notes if this blueprint becomes an
   active follow-through lane rather than a dormant planned file.
3. Run `wp audit docs-frontmatter` and `vp run audit:blueprint-links`.

**Acceptance:**

- [x] Release docs describe the hermetic PR gate plus both post-deploy production suites.
- [x] Blueprint/lifecycle docs no longer hide this blueprint’s partially landed status.
- [x] Repo-local regression coverage now fails if `docs/release.md` drops either production suite from the healthy deploy, release checklist, or rollback contract.

#### [ops] Task 3.2: External required-check and completion evidence follow-through

**Status:** blocked

**Depends:** Task 2.1, Task 2.2

The repo can define workflows, but it cannot by itself prove GitHub branch
protection/ruleset enforcement. Production deploy evidence can be captured from
GitHub Actions logs, but whether the `e2e` check is truly required on `main`
still lives outside git state. Keep this as an explicit external follow-through
item instead of over-claiming repo completion.

**Files:**

- Modify: `docs/release.md`
- Modify: `blueprints/in-progress/2026-05-29-edge-matte-e2e-confidence-suite.md`

**Steps (TDD):**

1. Confirm GitHub branch protection or rulesets mark the CI `e2e` job as a
   required check on the protected branch.
2. Confirm the production deploy lane is green with `production-journey` evidence.
3. Only then move this blueprint out of `planned/` or mark it execution-ready/completed.

**Acceptance:**

- [ ] GitHub required-check enforcement is confirmed outside the repo.
- [x] Production deploy evidence is captured and linked from lifecycle docs.
- [x] This blueprint’s lifecycle state matches reality.

**Progress note (2026-06-06):** GitHub-side evidence is now captured with `gh`: `gh api repos/ozby/edge-matte/branches/main/protection` returns `404 Branch not protected`, `gh api repos/ozby/edge-matte/rulesets` returns `[]`, and `gh run view 26811663121 --log` shows the 2026-06-02 production deploy on `main` passed `/health`, app-shell smoke, `production-smoke`, and `production-journey` against `https://edge-matte.ozby.dev`, including the live transform assertion. The remaining blocker is therefore narrowed to missing required-check enforcement on the protected branch.

## Edge cases

| ID  | Severity | Scenario                                                                                                          | Mitigation                                                                                                           |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| E1  | HIGH     | Mock mode is a byte pass-through, so browser/contract suites cannot prove the real transform.                     | Keep byte-difference assertions exclusive to `production-journey`; keep mock-mode assertions honest.                 |
| E2  | HIGH     | `CI=true` would auto-enable production suites if the workflow ran bare `vp run e2e`.                              | Keep explicit `--suite` usage in CI/deploy workflows and preserve this as a review invariant.                        |
| E3  | MEDIUM   | Missing `IMAGES` binding or credential drift can make live production proof fail after repo wiring looks correct. | Treat live-green evidence as a dependency on the remediation blueprint, not as already solved by the suite existing. |
| E4  | MEDIUM   | Release docs can lag the actual workflow and mislead operators about what counts as a healthy deploy.             | Update `docs/release.md` together with any lifecycle-state change for this blueprint.                                |

## Risks

| Risk                                                 | Severity | Why it matters                                                              | Mitigation                                                                            |
| ---------------------------------------------------- | -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Repo claims outpace live production evidence         | HIGH     | A landed workflow file is not the same as a successful deploy journey.      | Keep Task 2.2 open until a successful live run is evidenced.                          |
| Required-check enforcement is invisible in git state | HIGH     | The `e2e` job can exist without being required on `main`.                   | Track ruleset/branch-protection confirmation explicitly in Task 3.2 and release docs. |
| Release docs drift from the shipped workflow         | MEDIUM   | Operators may stop at `production-smoke` and miss the real transform proof. | Finish Task 3.1 before marking this blueprint done.                                   |

## Verification commands

```bash
vp exec --filter @edge-matte/e2e -- playwright install --with-deps chromium
vp run e2e -- --suite upload-delete-contract
vp run e2e -- --suite smoke
vp run e2e -- --suite upload-delete
E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-smoke
E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey
vp run act:ci:e2e
wp audit architecture-drift --root .
wp audit blueprint-lifecycle
vp run audit:blueprint-links
```
