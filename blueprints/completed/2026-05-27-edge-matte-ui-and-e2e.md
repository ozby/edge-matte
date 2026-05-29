---
type: blueprint
title: "EdgeMatte: UI flow and agent-kit E2E adoption"
status: completed
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
QA plumbing, with production smoke pointed at `https://edge-matte.ozby.dev`.

## Objective

Deliver the reviewer-visible UX and the DRY verification surface that proves the
architecture with executable user journeys.

## TDD + E2E contract

UI work is test-first and E2E-driven:

- write failing client tests before component/state changes;
- write or update failing browser/HTTP journey tests before flow changes;
- only treat the feature as complete when the relevant journey passes end-to-end.

E2E journeys are contract tests, not implementation tests: they must go through
the browser and public HTTP surfaces and must not import internal Worker/core
modules to manufacture a passing result.

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

1. Write failing client tests first for preview, progress, result, copy URL, download, delete confirmation, and recoverable error states.
2. Build the single-page upload UI with preview, progress, result, download, and delete.
3. Keep client state aligned with the documented status machine and safe error handling.
4. Add client Vitest config via `@webpresso/agent-kit/vitest/react` (preset import — may use scoped devDeps or global agent-kit install; not the same as repo-local CLI pinning).
5. Add Worker test split via `@webpresso/agent-kit/vitest/workers` (same preset resolution rule as task 4).
6. Write failing E2E journey definitions first for `smoke`, `upload-delete`, and `production-smoke`.
7. Create `apps/e2e/src/e2e-suite-manifest.ts` and `agent-kit-host-adapter.ts`.
8. Add `smoke`, `upload-delete`, and `production-smoke` journeys.
9. Ensure `ak_qa`/shared E2E surfaces can target suites without local duplication.

## Acceptance criteria

- Reviewer can upload one image, see progress, copy URL, and delete artifacts.
- The reviewer-visible UX stays task.pdf-principal: upload one image -> wait for processing -> receive hosted URL -> delete artifacts.
- UI states match documented happy-path and failure-path transitions.
- E2E suites are manifest-driven and agent-kit-compatible.
- Client/testing config reuses agent-kit/vite-plus surfaces instead of local wrappers.
- `production-smoke` targets `https://edge-matte.ozby.dev`.
- `upload-delete` is the contract suite for the assignment’s core feature set: one-file upload, processing wait, hosted result URL, and delete -> 404.
- A maintainer can run the documented local flow from a clean clone with global `wp`/`vp` installed and `pnpm install` completed — no GitHub Packages token required for npm deps.
- Stop condition: a reviewer-visible local flow is demonstrable and covered by manifest-driven suites.

## Execution checklist

- [x] Add failing client tests for preview/progress/result/delete/error states.
- [x] Add failing browser journeys for `smoke` and `upload-delete`.
- [x] Implement minimal UI to pass the targeted client tests.
- [x] Implement E2E manifest + host adapter plumbing.
- [x] Make `smoke` pass locally.
- [x] Make `upload-delete` pass locally through browser/public HTTP only.
- [x] Verify copy URL, open result URL, delete, and post-delete 404 behavior.
- [x] Refresh README/local run steps if the user journey changed.
- [x] Run architecture drift check.

Exact stop condition:

- Stop only when a reviewer can complete the assignment’s visible journey
  without manual dev intervention and the same journey is covered by E2E.

## Test design

### Unit tests

- client state reducer/store tests for upload lifecycle, polling/status transitions, and delete/reset behavior;
- formatter/helper tests for file-size messages, URL copy labels, and error-to-UI mapping;
- component-level tests for preview rendering, CTA enable/disable rules, and delete confirmation state.

### Integration tests

- React/jsdom integration tests for the full local UI slice: file select -> submit -> loading -> success -> delete;
- client/API integration tests with realistic HTTP mocks at the network boundary only, not mocked component internals;
- E2E manifest/host-adapter integration tests to ensure suite discovery and execution plan resolution.

### Strict confidence checks

- assert the user cannot accidentally upload multiple files through the primary path;
- assert visible progress/loading feedback appears during processing;
- assert the returned hosted URL is visible, copyable, and openable;
- assert deletion updates the UI and a re-opened result URL returns 404 in the contract suite;
- assert recoverable backend errors map to actionable user-facing states instead of silent failure.

## Parallel execution waves

### Wave 1 — independent red tests

| Task ID | Task                                                                     | Depends on | Write scope                                     |
| ------- | ------------------------------------------------------------------------ | ---------- | ----------------------------------------------- |
| UI-1    | Add failing client tests for preview/progress/result/delete/error states | none       | `apps/client/**tests**`                         |
| UI-2    | Add failing E2E journey definitions for `smoke` and `upload-delete`      | none       | `apps/e2e/**`                                   |
| UI-3    | Add failing tests for suite manifest/host-adapter discovery              | none       | `apps/e2e/src/**tests**`, `agent-kit.config.ts` |

### Wave 2 — independent implementation lanes

| Task ID | Task                                                                  | Depends on | Write scope                               |
| ------- | --------------------------------------------------------------------- | ---------- | ----------------------------------------- |
| UI-4    | Implement client upload/result/delete UI and local state handling     | UI-1       | `apps/client/**`                          |
| UI-5    | Implement E2E manifest + host adapter plumbing                        | UI-3       | `apps/e2e/src/**`, `agent-kit.config.ts`  |
| UI-6    | Implement browser journeys and fixtures for `smoke` / `upload-delete` | UI-2, UI-5 | `apps/e2e/journeys/**`, Playwright config |

### Wave 3 — merge and harden

| Task ID | Task                                                                           | Depends on                   | Write scope               |
| ------- | ------------------------------------------------------------------------------ | ---------------------------- | ------------------------- |
| UI-7    | Bind UI to stable backend route contract and finalize error/status UX          | UI-4, core pipeline complete | `apps/client/**`          |
| UI-8    | Run local browser/public-HTTP contract suites and fix drift between UI and E2E | UI-6, UI-7                   | client + E2E verification |

Parallelization notes:

- `UI-4` and `UI-5` can run in parallel.
- `UI-6` can start once suite plumbing exists, even while UI implementation is still progressing.
- `UI-8` is a merge/verification lane.

## Verification

```bash
vp run test
vp run check-types
wp audit guardrails
vp run e2e -- --suite smoke
vp run e2e -- --suite upload-delete
wp audit architecture-drift --root .
```

## Completion notes

Superseding note (2026-05-27): subsequent audit found that the local
`upload-delete` / smoke coverage was still using an internal-import Worker
harness rather than a true browser/runtime reviewer path. See
`blueprints/planned/2026-05-27-edge-matte-audit-remediation.md` for the
corrective blueprint that hardens this boundary.

Completed 2026-05-27. Local verification passed (build, lint, typecheck, tests, smoke, upload-delete E2E, architecture drift). Production deploy to `https://edge-matte.ozby.dev` and post-deploy `production-smoke` remain pending a CI fix.
