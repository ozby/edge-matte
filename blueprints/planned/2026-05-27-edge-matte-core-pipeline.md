---
type: blueprint
title: "EdgeMatte: core pipeline and Worker API"
status: planned
created: 2026-05-27
review_target: public GitHub repository
parent_blueprint: 2026-05-27-edge-matte
depends_on:
  - 2026-05-27-edge-matte-workspace-scaffold
---

# EdgeMatte: core pipeline and Worker API

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

## Architecture before

The architecture defines the pipeline, ports, state machine, and API contract,
but there is no implemented domain model, no Worker routes, and no adapter code.

## Architecture after

The Worker exposes the documented `POST /api/jobs`, `GET /api/jobs/:id`,
`GET /i/:id`, `DELETE /api/jobs/:id`, and `/health` routes backed by a pure core
pipeline plus R2/provider/transform adapters.

## Objective

Implement the minimal end-to-end backend path for one-image processing while
preserving the DRY/SOLID/KISS boundaries already chosen.

## Gap addressed

This is the biggest functional hole: the architecture is credible, but there is
no executable backend that proves the documented request flow and lifecycle.

## Write scope

- `apps/worker/src/core/image-job.ts`
- `apps/worker/src/core/object-keys.ts`
- `apps/worker/src/core/process-image-job.ts`
- `apps/worker/src/core/errors.ts`
- `apps/worker/src/ports/*`
- `apps/worker/src/adapters/cloudflare/*`
- `apps/worker/src/adapters/photoroom/*`
- `apps/worker/src/adapters/hono/*`
- `apps/worker/src/index.ts`
- Worker test files for the same surfaces

## Not in scope

- polished browser UI
- E2E harness plumbing beyond backend-facing tests
- Pulumi resources or GitHub deploy workflows

## Tasks

1. Implement `ImageJob`, public response model, key derivation, and error taxonomy.
2. Implement `BackgroundRemovalProvider`, `ImageTransformer`, `JobRepository`, and `ImageObjectStore` ports.
3. Add R2-backed repositories/stores.
4. Add Photoroom provider adapter and mock provider.
5. Add Cloudflare Images transformer and mock transformer.
6. Implement pure `processImageJob()` orchestration and delete flow.
7. Implement Hono routes with validation, multipart parsing, and typed responses.
8. Add `/health` for deploy smoke tests.

## Acceptance criteria

- API contract matches the architecture doc.
- Status transitions and delete-token behavior match the documented state machine.
- Only safe public fields leave the Worker.
- Partial failures produce explicit failed states and safe cleanup.
- Queue execution remains out of scope for this blueprint.
- Stop condition: a mock-backed backend demo path works end-to-end without requiring the client blueprint.

## Verification

```bash
pnpm test -- --filter worker
pnpm check-types
pnpm lint
python3 scripts/check_architecture_drift.py
```
