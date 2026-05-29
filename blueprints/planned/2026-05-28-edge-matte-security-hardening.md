---
type: blueprint
title: "EdgeMatte: private-beta security hardening"
status: planned
created: 2026-05-28
last_updated: 2026-05-28
review_target: public GitHub repository
depends_on:
  - 2026-05-27-edge-matte-audit-remediation
  - 2026-05-29-edge-matte-shared-cloudflare-deploy-contract
---

# EdgeMatte: private-beta security hardening

Security hardening blueprint for private beta launch. Goal is to block
unauthorized access at the edge, then enforce abuse controls at the upload
boundary with production-safe CI behavior.

## Architecture governance

Architecture docs:

- [Architecture](../../docs/architecture.md)
- [Architecture Contract](../../docs/architecture.contract.json)

## Architecture before

- `POST /api/jobs` accepts unauthenticated uploads:
  [app.ts](../../apps/worker/src/adapters/hono/app.ts)
- No app-layer Turnstile/rate-limit middleware for upload path.
- Production domain is directly exposed:
  [wrangler.toml](../../wrangler.toml)
- Deploy smoke probes are unauthenticated cURL checks:
  [deploy.production.yml](../../.github/workflows/deploy.production.yml),
  [wait-for-http.sh](../../scripts/wait-for-http.sh)

## Architecture after

- Cloudflare Access protects `edge-matte.ozby.dev` (private-beta allow rules, deny fallback).
- CI/deploy probes authenticate through Access using service credentials.
- `POST /api/jobs` enforces Turnstile server-side verification before processing.
- WAF/rate-limit controls reduce bot and burst abuse ahead of Worker compute.
- Runbook covers abuse response, rollback, and credential rotation.

## Objective

Ship a secure private-beta surface that is resilient to automated abuse and
operationally safe for CI/CD and maintainers.

Deployment-contract note: if shared preview/main/prod lane semantics move into
`agent-kit`, this blueprint should consume that contract rather than invent a
second deployment taxonomy. Provider-specific deploy plumbing remains outside
this blueprint's scope.

## Hard fact-check findings

| ID  | Severity | Claim                                          | Reality                                                                            | Fix                                                                                  |
| --- | -------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| F1  | HIGH     | Access can be enabled without pipeline changes | Current deploy smoke/e2e hit protected routes without Access auth headers          | Add machine-auth headers in deploy workflow and smoke path before Access enforcement |
| F2  | HIGH     | Turnstile token presence is sufficient         | Cloudflare requires server-side Siteverify; tokens are one-time and expire quickly | Implement strict Siteverify validation (`success`, `hostname`, optional `action`)    |
| F3  | MEDIUM   | Health endpoint policy can stay implicit       | Access policy may unintentionally block/allow probes                               | Define explicit health policy (private, or machine-bypass only) and test it          |

## Quick Reference (Execution Waves)

| Wave          | Tasks             | Dependencies             | Parallelizable | Effort (T-shirt) |
| ------------- | ----------------- | ------------------------ | -------------- | ---------------- |
| Wave 0        | 1.1, 2.1          | None                     | 2 agents       | S, M             |
| Wave 1        | 1.2, 2.2, 3.1     | 1.1 + 2.1 where relevant | 3 agents       | S, S, S          |
| Critical path | 1.1 -> 2.1 -> 2.2 | -                        | 3 waves        | M                |

### Parallel metrics snapshot

| Metric | Formula / Meaning                  | Target | Actual       |
| ------ | ---------------------------------- | ------ | ------------ |
| RW0    | Ready tasks in Wave 0              | >= 2   | 2            |
| CPR    | total_tasks / critical_path_length | >= 2.5 | 5 / 3 = 1.67 |
| DD     | dependency_edges / total_tasks     | <= 2.0 | 5 / 5 = 1.0  |
| CP     | same-file overlaps per wave        | 0      | 0            |

Note: CPR is intentionally lower due to security-first sequencing and CI safety
constraints.

## Task pool

#### [edge] Task 1.1: Cloudflare Access policy for private beta

**Status:** todo

**Depends:** None

Define Access application and policy set for `edge-matte.ozby.dev` with
identity allow rules and deny fallback.

**Files:**

- Modify:
  [docs/release.md](../../docs/release.md)
- Modify:
  [docs/secrets.md](../../docs/secrets.md)
- Modify:
  [README.md](../../README.md)

**Steps (TDD):**

1. Add docs checklist for Access app/policy expected behavior.
2. Document allow, deny, and break-glass rollback policy.
3. Verify docs reference machine-access prerequisite for deploy workflow.

**Acceptance:**

- [ ] Access policy spec is explicit and auditable.
- [ ] Break-glass and rollback steps are documented.

#### [ci] Task 1.2: Service-token machine auth for deploy smoke and e2e

**Status:** todo

**Depends:** Task 1.1

Make deploy workflow and smoke checks compatible with Access-protected routes.

**Files:**

- Modify:
  [deploy.production.yml](../../.github/workflows/deploy.production.yml)
- Modify:
  [wait-for-http.sh](../../scripts/wait-for-http.sh)
- Modify:
  [production-smoke.smoke.test.ts](../../apps/e2e/journeys/production-smoke.smoke.test.ts)

**Steps (TDD):**

1. Add failing tests or checks for header-aware smoke behavior.
2. Inject Access service credentials via Doppler in deploy workflow.
3. Ensure smoke/e2e requests pass required Access headers.

**Acceptance:**

- [ ] Deploy workflow stays green under Access-protected domain.
- [ ] No unauthenticated production smoke path remains.

#### [worker] Task 2.1: Upload abuse guard middleware (Turnstile)

**Status:** todo

**Depends:** None

Add Hono middleware that validates Turnstile token server-side before
`POST /api/jobs` processing.

**Files:**

- Create:
  [abuse-guard.ts](../../apps/worker/src/adapters/hono/abuse-guard.ts)
- Modify:
  [app.ts](../../apps/worker/src/adapters/hono/app.ts)
- Create:
  [abuse-guard.test.ts](../../apps/worker/test/abuse-guard.test.ts)

**Steps (TDD):**

1. Write failing tests for missing/invalid/expired token and valid token path.
2. Implement Siteverify integration with timeout and strict response checks.
3. Wire middleware on `POST /api/jobs` only.

**Acceptance:**

- [ ] Upload endpoint rejects invalid or absent challenge tokens.
- [ ] Hostname and action validation is enforced when configured.
- [ ] Existing happy path still succeeds with valid token.

#### [config] Task 2.2: Env and secret contract for guard controls

**Status:** todo

**Depends:** Task 2.1

Harden deploy-time verification for required security env vars and secret
contract documentation.

**Files:**

- Modify:
  [wrangler.toml](../../wrangler.toml)
- Modify:
  [verify-cloudflare-deploy-creds.sh](../../scripts/verify-cloudflare-deploy-creds.sh)
- Modify:
  [docs/secrets.md](../../docs/secrets.md)

**Steps (TDD):**

1. Add failing validation for missing required security env vars in production.
2. Add env contract and secret ownership docs (metadata-only in repo).
3. Validate CI and local deploy paths against new contract.

**Acceptance:**

- [ ] Missing required guard secrets fail fast before deploy.
- [ ] Secret ownership and rotation path are documented.

#### [edge] Task 3.1: WAF/rate limiting and abuse response runbook

**Status:** todo

**Depends:** Task 2.1

Add endpoint-specific rate-limit and abuse runbook guidance for operations.

**Files:**

- Modify:
  [docs/release.md](../../docs/release.md)
- Create:
  [docs/runbooks/abuse-response.md](../../docs/runbooks/abuse-response.md)

**Steps (TDD):**

1. Define and document WAF/rate-limit expression for `/api/jobs`.
2. Document bot mitigation threshold and tuning process.
3. Write incident runbook: tighten, verify, rollback, rotate, evidence capture.

**Acceptance:**

- [ ] Concrete rate-limit policy and tuning guidance exist.
- [ ] Abuse runbook is actionable for on-call operator.

## Risks

| Risk                                   | Severity | Mitigation                                     |
| -------------------------------------- | -------- | ---------------------------------------------- |
| Access rollout breaks deploy smoke     | HIGH     | Implement Task 1.2 before Access enforcement   |
| Turnstile bypass via weak validation   | HIGH     | Strict Siteverify response checks and tests    |
| False positives from rate-limit policy | MEDIUM   | Start conservative, tune with observed traffic |

## Verification commands

```bash
vp run verify:secrets
wp audit absolute-path-policy --root .
vp run audit:secret-provider-quarantine
vp run test
```
