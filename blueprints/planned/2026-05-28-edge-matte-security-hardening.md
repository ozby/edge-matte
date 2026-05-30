---
type: blueprint
title: "EdgeMatte: private-beta security hardening"
status: planned
created: 2026-05-28
last_updated: 2026-05-30
review_target: public GitHub repository
depends_on:
  - 2026-05-27-edge-matte-audit-remediation
  - 2026-05-29-edge-matte-shared-cloudflare-deploy-contract
---

# EdgeMatte: private-beta security hardening

Security hardening blueprint for private beta launch. Goal is to keep the
current Cloudflare-native single-Worker architecture intact while adding
private-beta access control, upload-abuse protection, and operator-safe
verification that matches the repo’s current workflow reality.

## Architecture governance

Architecture docs:

- [Architecture](../../docs/architecture.md)
- [Architecture Contract](../../docs/architecture.contract.json)

## Architecture before

- `POST /api/jobs` accepts uploads with body-size and media validation only; no
  human-challenge token is captured in the SPA or enforced by the Worker:
  [app.ts](../../apps/worker/src/adapters/hono/app.ts),
  [api.ts](../../apps/client/src/api.ts),
  [app.ts](../../apps/client/src/app.ts)
- The static SPA has no Worker-served public security-config surface for a
  Turnstile site key; current production builds happen before Doppler injection:
  [deploy.production.yml](../../.github/workflows/deploy.production.yml),
  [app.ts](../../apps/client/src/app.ts)
- Production deploy smoke, local deploy smoke, and both production E2E suites
  hit `edge-matte.ozby.dev` without Access machine-auth headers:
  [deploy.production.yml](../../.github/workflows/deploy.production.yml),
  [wait-for-http.sh](../../scripts/wait-for-http.sh),
  [deploy-production.ts](../../scripts/deploy-production.ts),
  [production-smoke.smoke.test.ts](../../apps/e2e/journeys/production-smoke.smoke.test.ts),
  [production-journey.smoke.test.ts](../../apps/e2e/journeys/production-journey.smoke.test.ts)
- Baseline security headers and `assets.run_worker_first = true` already exist
  and must be preserved instead of replaced by a second gateway layer:
  [wrangler.toml](../../wrangler.toml),
  [app.ts](../../apps/worker/src/adapters/hono/app.ts)

## Architecture after

- Cloudflare Access protects `edge-matte.ozby.dev` with an explicit browser +
  automation policy matrix, deny fallback, and documented rollback path.
- Deploy workflow, local deploy smoke, and post-deploy `production-smoke` /
  `production-journey` verification authenticate through Access service-token
  headers without weakening the repo’s existing pinned-workflow supply-chain
  hardening.
- The Worker exposes a minimal non-secret public security-config contract for
  the SPA (for example, the Turnstile site key and expected action name); the
  Turnstile secret key remains only in Cloudflare/Doppler-managed secret stores.
- `POST /api/jobs` requires Turnstile Siteverify with hostname/action checks
  before processing.
- WAF/rate-limit controls and abuse-response runbooks sit in front of the
  existing Worker topology; no extra app tier or queue layer is introduced.

## Objective

Ship a secure private-beta surface that is resilient to automated abuse and
operationally safe for CI/CD and maintainers, while staying aligned with the
current production target `edge-matte.ozby.dev`, pinned workflow policy, direct
`wp audit architecture-drift --root .` governance, and the current working-tree
package/tsconfig/vitest alignment changes.

Deployment-contract note: if shared preview/main/prod lane semantics move into
`agent-kit`, this blueprint should consume that contract rather than invent a
second deployment taxonomy. Provider-specific deploy plumbing remains outside
this blueprint’s scope.

## Progress

Refined on **2026-05-30** against the current repo state:

- background removal is already Cloudflare-native via the `IMAGES` binding
  (older external-provider assumptions are stale);
- GitHub Actions `uses:` references are already pinned to full SHAs;
- post-deploy verification now includes both `production-smoke` and
  `production-journey`;
- `wp audit architecture-drift --root .` is the canonical shared drift audit;
- active package/tsconfig/vitest alignment edits exist in the working tree, so
  this blueprint must stay narrowly scoped and avoid assuming a clean tree.

## Hard fact-check findings

| ID  | Severity | Claim                                                     | Reality                                                                                                                                   | Fix                                                                                                                                   |
| --- | -------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | HIGH     | Access can be enabled without changing verification paths | Current deploy workflow, local deploy smoke, `production-smoke`, and `production-journey` all hit protected routes without auth headers | Add a shared Access machine-auth contract across workflow, local deploy smoke, and production E2E before enforcing Access            |
| F2  | HIGH     | Turnstile validation is only a Worker concern             | Current SPA only uploads a file; it never renders a challenge or sends a token, and the Worker never verifies one                        | Add both client challenge/token plumbing and server-side Siteverify enforcement                                                      |
| F3  | HIGH     | The SPA can get a site key “later” from secrets injection | Client assets are built before Doppler injection in deploy CI and the repo forbids `.env*` secret files                                  | Add a Worker-owned public config surface (non-secret only) instead of relying on late build-time secret injection                    |
| F4  | MEDIUM   | Security env contract belongs in `wrangler.toml`          | Repo policy keeps secret values only in platform stores; docs currently state “No Worker secrets required”                               | Document new security secret names/ownership in docs and runtime checks; limit `wrangler.toml` changes to non-secret vars/bindings  |
| F5  | MEDIUM   | `/health` and `/` policy can stay implicit under Access   | Release docs, shell smoke, and manual verification currently assume bare curls to both paths                                             | Define an explicit health/shell policy matrix and test it in docs, smoke scripts, and production suites                              |
| F6  | LOW      | Generic verification steps are good enough                | Repo already has pinned-workflow policy, direct architecture-drift audit usage, and production-journey coverage                           | Preserve those exact rails in task steps and final verification commands instead of reverting to stale generic checks                |

## Key decisions

| ID | Decision | Why |
| -- | -------- | --- |
| D1 | Use Cloudflare Access service tokens for automation via `CF-Access-Client-Id` / `CF-Access-Client-Secret` | Matches Cloudflare’s documented machine-auth path and fits both CI and local smoke verification |
| D2 | Expose the Turnstile site key through a Worker-owned public config contract, not build-time secret injection | The SPA is static, builds before Doppler injection, and the repo forbids secret-on-disk workflows |
| D3 | Keep one Worker + static assets topology | Current architecture already applies security headers and `run_worker_first`; security should harden this surface, not add a second app tier |
| D4 | Preserve production-only real-transform verification | `production-journey` is the only suite that proves live background removal + flip; Access must authenticate it, not remove or localize it |

## Technology choices

| Component | Technology | Version / surface | Why |
| --------- | ---------- | ----------------- | --- |
| Private-beta access control | Cloudflare Access service tokens + allow policies | Current Cloudflare One docs | Machine-auth path for CI/local automation without storing cookies on disk |
| Human verification | Cloudflare Turnstile + Siteverify | Current Turnstile docs | One-time token verification with hostname/action validation |
| Edge abuse controls | Cloudflare WAF / rate limiting | Current Cloudflare edge controls | Reduce bot/burst abuse before Worker compute/R2 cost |
| Verification rails | Existing pinned GitHub Actions + `wp` / `vp` surfaces | Current repo workflow | Reuses current quality/deploy contract instead of inventing a second one |

## Quick Reference (Execution Waves)

| Wave              | Tasks                        | Dependencies   | Parallelizable | Effort (T-shirt) |
| ----------------- | ---------------------------- | -------------- | -------------- | ---------------- |
| **Wave 0**        | 1.1, 2.1                     | None           | 2 agents       | S, S             |
| **Wave 1**        | 1.2, 1.3, 2.2, 2.3          | 1.1 / 2.1      | 4 agents       | S-M              |
| **Wave 2**        | 3.1                          | 1.1, 2.3       | 1 agent        | S                |
| **Critical path** | 2.1 → 2.3 → 3.1             | —              | 3 waves        | M                |

### Parallel metrics snapshot

| Metric | Formula / Meaning                  | Target | Actual       |
| ------ | ---------------------------------- | ------ | ------------ |
| RW0    | Ready tasks in Wave 0              | >= 2   | 2            |
| CPR    | total_tasks / critical_path_length | >= 2.5 | 7 / 3 = 2.33 |
| DD     | dependency_edges / total_tasks     | <= 2.0 | 6 / 7 = 0.86 |
| CP     | same-file overlaps per wave        | 0      | 0            |

Refinement delta: split the original Turnstile lane so the plan no longer
assumes a clientless challenge flow, and split Access verification into
workflow/local-smoke vs production-E2E lanes to keep post-deploy proof honest.

## Task pool

#### [edge] Task 1.1: Access policy matrix and operator docs

**Status:** todo

**Depends:** None

Define the exact Cloudflare Access contract for `edge-matte.ozby.dev`: who gets
interactive browser access, how service-auth reaches `/health`, `/`, and
production API/image paths, which secret names CI/local operators must provide,
and how maintainers roll back quickly if Access blocks legitimate use.

**Files:**

- Modify: [docs/release.md](../../docs/release.md)
- Modify: [docs/secrets.md](../../docs/secrets.md)
- Modify: [README.md](../../README.md)

**Steps (TDD):**

1. Add/update the release/secrets/README checklists so the Access policy matrix,
   secret names, and rollback path are explicit rather than implied.
2. Document browser allow rules, service-token automation rules, deny fallback,
   `/health`/`/` expectations, and break-glass rollback.
3. Run: `wp audit docs-frontmatter`
4. Run: `wp audit architecture-drift --root .`

**Acceptance:**

- [ ] Access bootstrap, policy matrix, and rollback steps are explicit
- [ ] `/health` and `/` behavior under Access is documented
- [ ] Secret ownership/rotation remains consistent with repo secret policy

#### [ci] Task 1.2: Access-aware deploy smoke and local deploy verification

**Status:** todo

**Depends:** Task 1.1

Keep the existing pinned, serialized production deploy workflow intact while
teaching the shared smoke path to authenticate to Access-protected routes. This
task must cover both GitHub Actions post-deploy smoke and
`scripts/deploy-production.ts` so maintainers do not lose the local deploy path.

**Files:**

- Modify: [deploy.production.yml](../../.github/workflows/deploy.production.yml)
- Modify: [wait-for-http.sh](../../scripts/wait-for-http.sh)
- Modify: [deploy-production.ts](../../scripts/deploy-production.ts)
- Modify: [infra-release-workflow-expectations.test.mjs](../../test/infra-release-workflow-expectations.test.mjs)

**Steps (TDD):**

1. Extend workflow/deploy expectation coverage so the task fails until the
   smoke path can send Access machine-auth headers.
2. Update `wait-for-http.sh` and `deploy-production.ts` to accept optional
   `CF-Access-Client-Id` / `CF-Access-Client-Secret` env vars without breaking
   unauthenticated local dev and PR hermetic flows.
3. Wire the production workflow to inject and use those headers during
   post-deploy `/health` and `/` smoke checks while preserving pinned-action
   policy and current pre-deploy suite selection.
4. Run: `vp run test`

**Acceptance:**

- [ ] CI post-deploy smoke can authenticate to Access-protected `/health` and `/`
- [ ] `vp run deploy:production` retains an operator-local smoke path
- [ ] No workflow action pinning or deploy serialization regression is introduced

#### [qa] Task 1.3: Access-aware production smoke and journey suites

**Status:** todo

**Depends:** Task 1.2

Teach the production-only E2E suites to authenticate to Access without
changing the existing “local PR suites stay hermetic / production suites stay
production-only” split. This is where the blueprint preserves the recent
local-setup skip behavior instead of accidentally forcing live-prod checks into
local bootstrap.

**Files:**

- Create: `apps/e2e/src/journeys/access.ts`
- Create: `apps/e2e/src/journeys/access.test.ts`
- Modify: [env.ts](../../apps/e2e/src/journeys/env.ts)
- Modify: [production-smoke.smoke.test.ts](../../apps/e2e/journeys/production-smoke.smoke.test.ts)
- Modify: [production-journey.smoke.test.ts](../../apps/e2e/journeys/production-journey.smoke.test.ts)

**Steps (TDD):**

1. Add failing helper-level coverage for authenticated production fetches that
   still no-op safely when production auth env vars are absent.
2. Route `production-smoke` and `production-journey` through the shared helper
   so both suites send Access headers only in production-mode execution.
3. Verify the helper does not change local `smoke`, `upload-delete-contract`,
   or `upload-delete` behavior.
4. Run: `vp run --filter @edge-matte/e2e test`

**Acceptance:**

- [ ] Both production suites can authenticate to Access
- [ ] Production suites remain gated behind `E2E_RUN_PRODUCTION=1` / `CI=true`
- [ ] Local/PR hermetic suites remain unchanged

#### [worker] Task 2.1: Public security-config contract for the SPA

**Status:** todo

**Depends:** None

Add a minimal Worker-served public config contract for the SPA so the browser
can learn non-secret security settings (for example, a Turnstile site key and
expected action) at request time. This avoids relying on late CI secret
injection or repo `.env*` files for static assets that are built before deploy.

**Files:**

- Modify: [app.ts](../../apps/worker/src/adapters/hono/app.ts)
- Modify: [routes.test.ts](../../apps/worker/test/routes.test.ts)
- Modify: [security-and-assets.test.ts](../../apps/worker/test/security-and-assets.test.ts)

**Steps (TDD):**

1. Add failing Worker route tests for a public config endpoint that returns only
   non-secret security fields and still inherits the existing security headers.
2. Implement the minimal response surface in the Hono adapter without leaking
   secret values or changing the Worker/static-assets topology.
3. Verify the endpoint shape is stable enough for SPA consumption and does not
   weaken `/internal/*` isolation.
4. Run: `vp run --filter @edge-matte/worker test`

**Acceptance:**

- [ ] The SPA can fetch non-secret security config from the Worker
- [ ] No secret value is exposed in the response
- [ ] Existing security headers and `run_worker_first` behavior remain intact

#### [ui] Task 2.2: Turnstile challenge and upload token plumbing

**Status:** todo

**Depends:** Task 2.1

Extend the current client upload flow so it fetches the public security config,
renders/resets a Turnstile challenge, blocks submission until a token exists,
and appends that token to `POST /api/jobs` without regressing the existing
drag/drop, paste, ready, copy-URL, or delete flows.

**Files:**

- Create: `apps/client/src/security.ts`
- Modify: [api.ts](../../apps/client/src/api.ts)
- Modify: [app.ts](../../apps/client/src/app.ts)
- Modify: [ui.ts](../../apps/client/src/ui.ts)
- Modify: [app.test.ts](../../apps/client/test/app.test.ts)

**Steps (TDD):**

1. Add failing client tests for “token missing blocks upload”, “token is sent on
   createJob”, and “challenge resets after submit/delete/error”.
2. Add a small client security helper to fetch public config and manage the
   Turnstile widget/token lifecycle without spreading provider code everywhere.
3. Update the upload controller/API call so `POST /api/jobs` includes the
   challenge token and degrades with a user-facing error when the widget/config
   is unavailable.
4. Run: `vp run --filter @edge-matte/client test`

**Acceptance:**

- [ ] Uploads cannot proceed without a valid challenge token
- [ ] The token is appended to `POST /api/jobs`
- [ ] Existing non-security client flows still pass

#### [worker] Task 2.3: Siteverify middleware and runtime secret contract

**Status:** todo

**Depends:** Task 2.1

Add Worker-side Turnstile enforcement for `POST /api/jobs`: reject missing or
invalid tokens, call Siteverify with a deadline, validate `success` plus
`hostname`/`action` when configured, and fail loudly when required runtime
secrets are absent in production rather than silently accepting uploads.

**Files:**

- Create: `apps/worker/src/adapters/hono/abuse-guard.ts`
- Modify: [app.ts](../../apps/worker/src/adapters/hono/app.ts)
- Modify: [index.ts](../../apps/worker/src/index.ts)
- Create: `apps/worker/test/abuse-guard.test.ts`

**Steps (TDD):**

1. Write failing tests for missing token, invalid token, timeout/duplicate
   token, hostname/action mismatch, and valid-token success.
2. Implement Siteverify integration with strict response checks and a bounded
   timeout; wire it only to `POST /api/jobs`.
3. Add production-facing runtime validation for the new Turnstile secret
   contract without writing secret values to disk or repo config.
4. Run: `vp run --filter @edge-matte/worker test`

**Acceptance:**

- [ ] Invalid or absent challenge tokens are rejected before processing
- [ ] Hostname/action checks are enforced when configured
- [ ] Missing production secret contract fails loudly instead of silently bypassing verification

#### [edge] Task 3.1: WAF/rate limiting and abuse-response runbook

**Status:** todo

**Depends:** Task 1.1, Task 2.3

Once Access and Turnstile behavior are explicit, add endpoint-specific
rate-limit / WAF guidance and an abuse-response runbook that tells operators how
to tighten controls, verify impact, collect evidence, rotate credentials, and
roll back safely without changing the current one-Worker runtime topology.

**Files:**

- Modify: [docs/release.md](../../docs/release.md)
- Create: `docs/runbooks/abuse-response.md`

**Steps (TDD):**

1. Add the initial runbook/checklist skeleton covering thresholds, escalation,
   evidence capture, rollback, and credential rotation.
2. Document the concrete `/api/jobs` rate-limit / WAF posture and how it
   interacts with Access and Turnstile.
3. Cross-check the release guide so it points to the runbook instead of leaving
   abuse handling implicit.
4. Run: `wp audit docs-frontmatter`

**Acceptance:**

- [ ] Abuse-response runbook is actionable for on-call maintainers
- [ ] `/api/jobs` WAF/rate-limit posture is explicit
- [ ] Rollback and credential-rotation guidance is documented

## Edge cases and error handling

| Edge case | Risk | Solution | Task |
| --------- | ---- | -------- | ---- |
| Access protects `/health` and `/` but smoke paths still use bare requests | False-negative deploy failures and blocked maintainer verification | Reuse one header-based Access auth contract in workflow, local deploy, and production suites | 1.2, 1.3 |
| Turnstile token expires or is replayed during upload | Legitimate users get confusing failures or bots bypass checks | Surface user-facing retry/reset behavior in the SPA and enforce strict Siteverify response handling | 2.2, 2.3 |
| Static SPA cannot see a site key at runtime | Widget never boots in production because build-time env arrives too late | Serve a non-secret config payload from the Worker at request time | 2.1, 2.2 |
| Production secrets are documented incorrectly as `wrangler.toml` config | Secret values leak into the wrong surface or operators misconfigure deploys | Keep secret names/ownership in docs and runtime checks only; never write values to repo files | 1.1, 2.3 |
| Access, Turnstile, and WAF all fire at once during an incident | Operators tighten the wrong layer or cannot roll back safely | Add a response-order runbook: Access first, then Turnstile runtime, then WAF/rate-limit tuning | 3.1 |

## Risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| Access rollout breaks deploy smoke or manual production verification | HIGH | Land Task 1.2 and Task 1.3 before enforcing Access on the production app |
| Turnstile is added only on the server or only in the client | HIGH | Keep Task 2.2 and Task 2.3 as a paired rollout with explicit acceptance criteria |
| Public site-key exposure is solved with an ad hoc build-time secret path | HIGH | Use Task 2.1’s Worker-served public config surface and preserve the repo secret policy |
| WAF/rate-limit rules create false positives during private beta | MEDIUM | Start conservative, capture evidence, and document rollback/tuning in Task 3.1 |

## Cross-plan references

| Type | Blueprint / source | Relationship |
| ---- | ------------------ | ------------ |
| Upstream | [EdgeMatte: audit remediation and confidence hardening](../in-progress/2026-05-27-edge-matte-audit-remediation.md) | Supplies the truthful production-verification baseline this blueprint must preserve |
| Upstream | [EdgeMatte: shared Cloudflare deploy contract](../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md) | Supplies shared lane semantics this blueprint should consume for Access-protected deploys |
| Downstream | [EdgeMatte: end-to-end confidence suite](../in-progress/2026-05-29-edge-matte-e2e-confidence-suite.md) | Should inherit the Access-auth production verification contract once defined here |

## Verification commands

```bash
vp run verify:secrets
wp audit absolute-path-policy --root .
vp run audit:secret-provider-quarantine
vp run format:check
vp run typecheck
vp run lint
vp run test
wp audit docs-frontmatter
wp audit blueprint-lifecycle --legacy-omx
wp audit architecture-drift --root .
```

## Refinement summary

| Metric | Value |
| ------ | ----- |
| Findings total | 6 |
| Critical | 0 |
| High | 3 |
| Medium | 2 |
| Low | 1 |
| Fixes applied | 6/6 in blueprint wording |
| Cross-plan updates required | 2 downstream recommendations noted, no external files edited |
| Edge cases documented | 5 |
| Risks documented | 4 |
| Parallelization score | B |
| Critical path | 3 waves |
| Max parallel agents | 4 in Wave 1 |
| Total tasks | 7 |
| Blueprint compliant | 7/7 tasks include status, depends, files, steps, acceptance |
