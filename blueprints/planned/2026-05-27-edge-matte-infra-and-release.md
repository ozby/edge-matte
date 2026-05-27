---
type: blueprint
title: "EdgeMatte: infrastructure, CI, and production release"
status: planned
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

## Gap addressed

The architecture is not complete until infrastructure ownership and CI/CD are
codified. This blueprint closes the production-readiness gap.

## Scope

- `infra/*`
- `.github/workflows/*`
- `wrangler.toml`
- release/deploy docs
- smoke verification helpers if needed

## Tasks

1. Add Pulumi project for the production R2 bucket and lifecycle cleanup.
2. Finalize Wrangler env config, bindings, vars, and route ownership.
3. Add PR CI: install, format, lint, typecheck, test, build, docs/blueprints check, dry-run deploy.
4. Add `main` deploy workflow using `cloudflare/wrangler-action@v3`.
5. Add post-deploy smoke checks for `/health`, `/`, and `production-smoke` E2E.
6. Document GitHub-vs-Cloudflare secret ownership and setup.
7. Add concurrency/serialization so production deploys do not overlap.

## Acceptance criteria

- Deploy path is source-controlled and matches the architecture doc.
- Pulumi/Wrangler ownership split is explicit and minimal.
- PRs prove deployability without mutating production.
- `main` deploy targets `edge-matte.ozby.dev` and runs smoke verification.
- Secret handling avoids provider-key sprawl into GitHub unless explicitly required.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm build
pnpm docs:check
pnpm blueprints:check
pnpm exec wrangler deploy --dry-run
python3 scripts/check_architecture_drift.py
```
