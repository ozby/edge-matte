---
type: blueprint
title: "EdgeMatte: UI flow and agent-kit E2E adoption"
status: planned
created: 2026-05-27
review_target: public GitHub repository
parent_blueprint: 2026-05-27-edge-matte
depends_on:
  - 2026-05-27-edge-matte-workspace-scaffold
  - 2026-05-27-edge-matte-core-pipeline
---

# EdgeMatte: UI flow and agent-kit E2E adoption

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

## Architecture before

The repo documents the desired user journey and the agent-kit E2E/testing reuse
pattern, but there is no UI, no local host adapter, and no executable journey
coverage for the documented product flow.

## Architecture after

The client implements the upload/status/result/delete flow, and E2E coverage is
wired through agent-kit’s host-adapter/suite-manifest model instead of bespoke
QA plumbing.

## Objective

Deliver the reviewer-visible UX and the DRY verification surface that proves the
architecture with executable user journeys.

## Gap addressed

Without UI + E2E, the repo only signals architecture taste. This blueprint makes
the core flow visible and verifiable to reviewers.

## Write scope

- `apps/client/src/*`
- `apps/e2e/*`
- `agent-kit.config.ts`
- client/worker Vitest configs
- README verification snippets if needed

## Not in scope

- provider business logic
- R2 repository internals
- Pulumi resources or production deploy workflow

## Tasks

1. Build the single-page upload UI with preview, progress, result, download, and delete.
2. Keep client state aligned with the documented status machine and safe error handling.
3. Add client Vitest config via `@webpresso/agent-kit/vitest/react`.
4. Add Worker test split via `@webpresso/agent-kit/vitest/workers`.
5. Create `apps/e2e/src/e2e-suite-manifest.ts` and `agent-kit-host-adapter.ts`.
6. Add `smoke`, `upload-delete`, and `production-smoke` journeys.
7. Ensure `ak_qa`/shared E2E surfaces can target suites without local duplication.

## Acceptance criteria

- Reviewer can upload one image, see progress, copy URL, and delete artifacts.
- UI states match documented happy-path and failure-path transitions.
- E2E suites are manifest-driven and agent-kit-compatible.
- Client/testing config reuses agent-kit/vite-plus surfaces instead of local wrappers.
- Stop condition: a reviewer-visible local flow is demonstrable and covered by manifest-driven suites.

## Verification

```bash
pnpm test
pnpm e2e -- --suite smoke
pnpm e2e -- --suite upload-delete
python3 scripts/check_architecture_drift.py
```
