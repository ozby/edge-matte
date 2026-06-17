---
type: blueprint
last_updated: "2026-06-06"
complexity: M
owner: ozby
title: "EdgeMatte: infrastructure, CI, and production release"
status: archived
created: 2026-05-27
review_target: public GitHub repository
parent_blueprint: 2026-05-27-edge-matte
depends_on:
  - 2026-05-27-edge-matte-workspace-scaffold
  - 2026-05-27-edge-matte-core-pipeline
  - 2026-05-27-edge-matte-ui-and-e2e
---

# EdgeMatte: infrastructure, CI, and production release

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

## Architecture before

The repo documents the desired Pulumi/Wrangler ownership split and production
CI/CD path, but no implementation artifacts prove resource ownership, deploy
serialization, or production smoke behavior yet.

## Architecture after

Pulumi owns the durable R2 resource, Wrangler owns the Worker/runtime route, CI
runs the shared quality gates, and `main` deploys to `edge-matte.ozby.dev` with
post-deploy smoke verification.

## Objective

Turn the documented deployment architecture into a reproducible release path.

## TDD + release verification contract

Infra changes are only ready when their verification path is codified first:

- dry-run deploy expectations;
- smoke/test workflow expectations;
- production E2E contract execution after deploy.

## Gap addressed

The architecture is not complete until infrastructure ownership and CI/CD are
codified. This blueprint closes the production-readiness gap.

## Write scope

- `infra/*`
- `.github/workflows/*`
- `wrangler.toml`
- release/deploy docs
- smoke verification helpers if needed

## Not in scope

- new product behavior
- non-release UI work
- queue-mode runtime promotion
- cross-repo extraction of shared deployment contract or private Cloudflare
  deploy plumbing (tracked separately in
  [`../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`](../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md))

## Tasks

1. Write failing verification expectations first for dry-run deploy, smoke workflow, and post-deploy contract execution.
2. Add Pulumi project for the production R2 bucket and lifecycle cleanup.
3. Finalize Wrangler env config, bindings, vars, and route ownership.
4. Bind Cloudflare Images in Wrangler as the Worker-side transform surface (`IMAGES`).
5. Add PR CI: install, format, lint, typecheck, test, build, docs/blueprints check, dry-run deploy.
6. Add `main` deploy workflow using `cloudflare/wrangler-action@v3`.
   (Superseded: production deploy uses inline `wrangler deploy` + secret-provider injection —
   see `.github/workflows/deploy-production.yml` and `docs/release.md`.)
7. Add post-deploy smoke checks for `/health`, `/`, and `production-smoke` E2E.
8. Document GitHub-vs-Cloudflare secret ownership and setup.
9. Add concurrency/serialization so production deploys do not overlap.

## Acceptance criteria

- Deploy path is source-controlled and matches the architecture doc.
- Pulumi/Wrangler ownership split is explicit and minimal.
- Wrangler-owned runtime bindings explicitly include the Images binding needed for the horizontal flip path.
- PRs prove deployability without mutating production.
- `main` deploy targets `edge-matte.ozby.dev` and runs smoke verification.
- A production deployment is not considered healthy unless `production-smoke` passes against `https://edge-matte.ozby.dev`.
- Secret handling stays provider-first and architecture-aligned: provider secret
  values live in Cloudflare, not GitHub, and no `.dev.vars*` / `.env*` files
  are required (except `.env.example` as documentation only).
- A maintainer can run the release/bootstrap path from a clean clone without
  hidden manual side paths.
- Stop condition: PR and main deploy paths are codified and match the architecture docs without manual hidden steps.

## Execution checklist

- [x] Add failing verification expectations for dry-run deploy and smoke flow.
- [x] Codify R2/Pulumi/Wrangler ownership split.
- [x] Bind `IMAGES`, `ASSETS`, and R2 runtime surfaces correctly.
- [x] Make PR CI run quality gates, tests, and dry-run deploy.
- [x] Make `main` deploy route to `edge-matte.ozby.dev`.
- [x] Add post-deploy smoke and `production-smoke`.
- [x] Document secret ownership/bootstrap path.
- [x] Run architecture drift check.

Exact stop condition:

- Stop only when the app is live at `https://edge-matte.ozby.dev`, CI proves
  deployability, and post-deploy smoke confirms the public URL is healthy.

## Test design

### Unit tests

- config helper tests for environment selection, route/build command generation, and smoke target resolution;
- secret-ownership documentation helper tests if scripted checks exist;
- deploy-plan helper tests for concurrency group naming and workflow condition logic.

### Integration tests

- workflow/config integration tests that validate CI steps, dry-run deploy presence, and production deploy sequencing;
- Wrangler/Pulumi config integration tests for expected bindings, bucket references, and production domain wiring;
- post-deploy smoke integration tests for `/health`, `/`, and `production-smoke` invocation.

### Strict confidence checks

- fail if production route is not `edge-matte.ozby.dev`;
- fail if `IMAGES`, R2, or `ASSETS` bindings required by the architecture are missing;
- fail if PR CI skips quality gates, tests, or dry-run deploy;
- fail if production deploy can complete without `production-smoke` or smoke verification.

## Parallel execution waves

### Wave 1 — independent red verification

| Task ID | Task                                                               | Depends on | Write scope         |
| ------- | ------------------------------------------------------------------ | ---------- | ------------------- |
| IR-1    | Add failing checks for CI/dry-run/smoke workflow expectations      | none       | workflow tests/docs |
| IR-2    | Add failing checks for Wrangler/Pulumi binding/domain expectations | none       | infra/config tests  |
| IR-3    | Draft release/bootstrap/secret-ownership docs                      | none       | docs                |

### Wave 2 — independent implementation lanes

| Task ID | Task                                                      | Depends on | Write scope                    |
| ------- | --------------------------------------------------------- | ---------- | ------------------------------ |
| IR-4    | Implement Pulumi/R2 ownership and lifecycle config        | IR-2       | `infra/**`                     |
| IR-5    | Implement Wrangler bindings/routes/domain config          | IR-2       | `wrangler.toml`, worker config |
| IR-6    | Implement PR/main workflows with dry-run and smoke stages | IR-1       | `.github/workflows/**`         |

### Wave 3 — merge and production verify

| Task ID | Task                                                                                      | Depends on                              | Write scope            |
| ------- | ----------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------- |
| IR-7    | Reconcile docs, secret ownership, and bootstrap path with final config                    | IR-3, IR-4, IR-5, IR-6                  | docs                   |
| IR-8    | Run deploy verification, `production-smoke`, and drift checks; fix remaining release gaps | IR-4, IR-5, IR-6, UI blueprint complete | repo-wide verification |

Parallelization notes:

- `IR-4`, `IR-5`, and `IR-6` are parallel-safe once their failing verification exists.
- `IR-8` must stay single-owner because it merges deployment, smoke, and doc truth.

## Verification

```bash
vp run format:check
vp run lint
vp run check-types
vp run test
vp run build
vp run docs:check
vp run blueprints:check
vp run deploy:dry-run
wp audit guardrails
wp audit architecture-drift --root .
```

## Completion notes

Superseding note (2026-05-27): subsequent audit found that the production truth
surface was weaker than this blueprint's stop condition because
`https://edge-matte.ozby.dev` was not healthy on 2026-05-27 and additional
truthfulness / verification remediation was required. See
`blueprints/planned/2026-05-27-edge-matte-audit-remediation.md`.

Completed 2026-05-27 for infra/release automation. Local verification passed.
Deploy workflow post-smoke propagation and green `production-smoke` are tracked in
[`in-progress/2026-05-27-edge-matte-audit-remediation.md`](../in-progress/2026-05-27-edge-matte-audit-remediation.md)
(Wave 0.5).

Platform follow-up note (2026-05-29): if this release contract is generalized
across EdgeMatte and other Cloudflare repos, the extraction lane lives in
[`in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`](../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md),
with shared policy expected to land in `agent-kit` and provider-specific
plumbing expected to stay in a separate private Cloudflare/Pulumi package.
