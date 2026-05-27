---
type: blueprint
title: "EdgeMatte: core pipeline and Worker API"
status: completed
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
pipeline plus R2/provider/transform adapters, with hosted URLs resolving under
`https://edge-matte.ozby.dev`.

## Objective

Implement the minimal end-to-end backend path for one-image processing while
preserving the DRY/SOLID/KISS boundaries already chosen.

## TDD contract

No Worker/core/adapters code lands before a failing test exists for the exact
behavior slice being added. Prefer integration-style route/core tests over
mock-heavy unit tests for the main path.

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

1. Write failing tests first for `ImageJob`, public response mapping, key derivation, and error taxonomy.
2. Implement `ImageJob`, public response model, key derivation, and error taxonomy.
3. Write failing tests first for port contracts and R2-backed repository/store behavior.
4. Implement `BackgroundRemovalProvider`, `ImageTransformer`, `JobRepository`, and `ImageObjectStore` ports plus R2-backed repositories/stores.
5. Write failing tests first for provider success/failure and transformer success/failure with exact state transitions.
6. Add Photoroom provider adapter and mock provider.
7. Add Cloudflare Images Workers-binding transformer (`IMAGES`) and mock transformer.
8. Write failing tests first for `processImageJob()` orchestration and delete flow.
9. Implement pure `processImageJob()` orchestration and delete flow.
10. Write failing route/integration tests first for validation, multipart parsing, typed responses, and `/health`.
11. Implement Hono routes with validation, multipart parsing, and typed responses.
12. Add `/health` for deploy smoke tests.

## Acceptance criteria

- API contract matches the architecture doc.
- The processing order is exact: upload -> background removal -> horizontal flip -> hosted result URL.
- `POST /api/jobs` enforces documented validation: oversized uploads return `413 file_too_large`; unsupported/spoofed media returns `415 unsupported_media_type`.
- `POST /api/jobs` and `GET /api/jobs/:id` return `imageUrl`/`pollUrl` values under `https://edge-matte.ozby.dev`.
- Status transitions and delete-token behavior match the documented state machine.
- Only safe public fields leave the Worker.
- `GET /api/jobs/:id` and `POST /api/jobs` responses never expose object keys, token hashes, provider payloads, or stack traces.
- `DELETE /api/jobs/:id` returns `401 invalid_delete_token` on token mismatch and `404 image_not_found` for missing jobs.
- Partial failures produce explicit failed states and safe cleanup.
- The flip adapter is implemented via the Cloudflare Workers Images binding, not a remote-URL-only transform assumption.
- Backend behavior is covered by failing-then-passing tests before implementation, and the feature is not ready until the downstream `upload-delete` E2E contract also passes.
- Queue execution remains out of scope for this blueprint.
- Stop condition: a mock-backed backend demo path works end-to-end without requiring the client blueprint.

## Execution checklist

- [x] Add failing tests for domain model and error taxonomy.
- [x] Add failing tests for storage/repository port behavior.
- [x] Add failing tests for provider + transformer success/failure paths.
- [x] Add failing tests for orchestration state transitions and cleanup.
- [x] Add failing route tests for upload/status/image/delete/health.
- [x] Implement minimal code until targeted tests pass.
- [x] Verify exact public API contract and safe-field redaction.
- [x] Verify hosted URL and delete-token flows.
- [x] Run broader worker/backend suites plus `upload-delete`.
- [x] Run architecture drift check.

Exact stop condition:

- Stop only when a reviewer could use the backend contract from a client without
  needing any undocumented route, payload, status, or deletion behavior changes.

## Test design

### Unit tests

- `ImageJob` factory/mapper tests for ids, keys, timestamps, and safe public response mapping;
- error taxonomy tests for exact error-code selection and redaction behavior;
- magic-byte/content-type validator tests for supported/unsupported/spoofed files;
- delete-token hashing/compare helpers;
- object-key derivation tests.

### Integration tests

- `processImageJob` integration tests with real orchestration flow and controlled provider/transform/store boundaries;
- route integration tests for `POST /api/jobs`, `GET /api/jobs/:id`, `GET /i/:id`, `DELETE /api/jobs/:id`, and `/health`;
- storage integration tests for R2-backed repository/object-store behavior where practical in Workers test surfaces;
- failure-path integration tests for provider failure, transform failure, storage failure, and cleanup behavior.

### Strict confidence checks

- assert exact state progression: `validating -> uploading -> removing_background -> flipping -> ready` or terminal `failed`;
- assert safe-field redaction on every public route;
- assert `imageUrl`/`pollUrl` shape and same-origin production contract;
- assert delete removes metadata + original + processed object, and repeated reads return 404/gone behavior as designed;
- assert unsupported, spoofed, missing, multiple, and oversized uploads fail with the exact contract codes.

## Parallel execution waves

### Wave 1 — independent red tests

| Task ID | Task | Depends on | Write scope |
|---|---|---|---|
| CP-1 | Add failing tests for domain model, keys, token hashing, error taxonomy | none | `apps/worker/**tests**`, core test files |
| CP-2 | Add failing tests for route contract and validation behavior | none | route test files |
| CP-3 | Add failing tests for orchestration, provider/transform failures, cleanup | none | orchestration/integration test files |

### Wave 2 — independent implementation lanes

| Task ID | Task | Depends on | Write scope |
|---|---|---|---|
| CP-4 | Implement domain model/helpers | CP-1 | `apps/worker/src/core/**` |
| CP-5 | Implement provider/transform/repository/object-store ports + adapters | CP-3 | `apps/worker/src/ports/**`, `apps/worker/src/adapters/**` |
| CP-6 | Implement Hono route layer and request validation | CP-2 | `apps/worker/src/adapters/hono/**`, `apps/worker/src/index.ts` |

### Wave 3 — merge lane

| Task ID | Task | Depends on | Write scope |
|---|---|---|---|
| CP-7 | Implement/finish `processImageJob()` and delete orchestration across all adapters | CP-4, CP-5 | `apps/worker/src/core/**` |
| CP-8 | Reconcile route wiring with orchestration and hosted URL contract | CP-6, CP-7 | `apps/worker/src/index.ts`, route files |

### Wave 4 — verify

| Task ID | Task | Depends on | Write scope |
|---|---|---|---|
| CP-9 | Run worker/backend suites, `upload-delete`, and drift checks; fix contract gaps | CP-8 | repo-wide verification |

Parallelization notes:

- `CP-4`, `CP-5`, and `CP-6` are parallel-safe after their red tests exist.
- `CP-7` and `CP-8` are merge tasks and should not be split across agents.

## Verification

```bash
vp run test -- --filter worker
vp run check-types
vp run lint
vp run e2e -- --suite upload-delete
wp audit guardrails
python3 scripts/check_architecture_drift.py
```

## Completion notes

Completed 2026-05-27. Local verification passed (build, lint, typecheck, tests, smoke, upload-delete E2E, architecture drift). Production deploy to `https://edge-matte.ozby.dev` and post-deploy `production-smoke` remain pending a CI fix.

