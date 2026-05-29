---
type: guide
title: EdgeMatte Execution Sheet
status: draft
created: 2026-05-27
last_updated: 2026-05-27
links:
  - ../docs/architecture.md
  - ../docs/architecture.contract.json
  - ../blueprints/completed/2026-05-27-edge-matte.md
  - ../blueprints/completed/2026-05-27-edge-matte-workspace-scaffold.md
  - ../blueprints/completed/2026-05-27-edge-matte-core-pipeline.md
  - ../blueprints/completed/2026-05-27-edge-matte-ui-and-e2e.md
  - ../blueprints/completed/2026-05-27-edge-matte-infra-and-release.md
---

# EdgeMatte Execution Sheet

Production target: `https://edge-matte.ozby.dev`

## Blueprint order

1. Workspace scaffold
2. Core pipeline
3. UI + E2E
4. Infra + release

## Lane families

- `scaffold/root` → root config files, bootstrap docs, shared config
- `worker/core` → `apps/worker/**`
- `client/ui` → `apps/client/**`
- `e2e` → `apps/e2e/**`, `agent-kit.config.ts`
- `infra/release` → `infra/**`, `.github/workflows/**`, `wrangler.toml`, release docs

Rule: no two agents write to the same lane family in the same wave.

---

## Blueprint 1 — Workspace scaffold

### Wave 1

- `WS-1` failing checks for root scripts/config discovery
- `WS-2` failing checks for app/E2E topology discovery
- `WS-3` bootstrap + secret onboarding docs draft

### Wave 2

- `WS-4` root workspace/package metadata and scripts — depends on `WS-1`
- `WS-5` Worker/client directory skeletons — depends on `WS-2`
- `WS-6` E2E skeleton + host-adapter/config wiring — depends on `WS-2`

### Wave 3

- `WS-7` Wrangler + TypeScript + shared config merge — depends on `WS-4`, `WS-5`, `WS-6`
- `WS-8` install/build/test/guardrail verification + drift fixes — depends on `WS-3`, `WS-7`

### Handoff gate

Start Blueprint 2 only when:

- `vp install`, build, lint, typecheck, and test resolve
- Worker/client/E2E topology is stable
- `wp audit architecture-drift --root .` passes

---

## Blueprint 2 — Core pipeline

### Wave 1

- `CP-1` failing tests for domain model, keys, token hashing, error taxonomy
- `CP-2` failing tests for route contract and validation
- `CP-3` failing tests for orchestration, provider/transform failures, cleanup

### Wave 2

- `CP-4` domain model/helpers — depends on `CP-1`
- `CP-5` ports + adapters + repositories/object store — depends on `CP-3`
- `CP-6` Hono routes + validation layer — depends on `CP-2`

### Wave 3

- `CP-7` `processImageJob()` + delete orchestration merge — depends on `CP-4`, `CP-5`
- `CP-8` route/orchestration/hosted-URL contract reconciliation — depends on `CP-6`, `CP-7`

### Wave 4

- `CP-9` backend suites + `upload-delete` + drift verification — depends on `CP-8`

### Handoff gate

Start Blueprint 3 only when:

- backend contract is stable
- exact flow is working: upload → background removal → flip → hosted URL → delete
- safe public API contract is locked

---

## Blueprint 3 — UI + E2E

### Wave 1

- `UI-1` failing client tests for preview/progress/result/delete/error states
- `UI-2` failing E2E journey definitions for `smoke` and `upload-delete`
- `UI-3` failing tests for suite manifest/host-adapter discovery

### Wave 2

- `UI-4` client upload/result/delete UI + state handling — depends on `UI-1`
- `UI-5` E2E manifest + host adapter plumbing — depends on `UI-3`
- `UI-6` browser journeys and fixtures for `smoke` / `upload-delete` — depends on `UI-2`, `UI-5`

### Wave 3

- `UI-7` bind UI to stable backend contract + finalize status/error UX — depends on `UI-4` and Blueprint 2 completion
- `UI-8` local browser/public-HTTP contract verification + fixes — depends on `UI-6`, `UI-7`

### Handoff gate

Start Blueprint 4 only when:

- reviewer-visible journey works locally
- `smoke` and `upload-delete` are green
- returned URL is visible/openable
- delete flow ends in post-delete 404

---

## Blueprint 4 — Infra + release

### Wave 1

- `IR-1` failing checks for CI/dry-run/smoke workflow expectations
- `IR-2` failing checks for Wrangler/Pulumi binding/domain expectations
- `IR-3` release/bootstrap/secret-ownership docs draft

### Wave 2

- `IR-4` Pulumi/R2 ownership and lifecycle config — depends on `IR-2`
- `IR-5` Wrangler bindings/routes/domain config — depends on `IR-2`
- `IR-6` PR/main workflows with dry-run and smoke stages — depends on `IR-1`

### Wave 3

- `IR-7` docs/bootstrap/secret ownership reconciliation — depends on `IR-3`, `IR-4`, `IR-5`, `IR-6`
- `IR-8` deploy verification + `production-smoke` + drift checks — depends on `IR-4`, `IR-5`, `IR-6`, and Blueprint 3 completion

### Handoff gate

Ship only when:

- app is live at `https://edge-matte.ozby.dev`
- PR CI proves deployability
- `production-smoke` is green
- `/health` is green

---

## Global stop conditions

- Do not skip red → green → refactor.
- Do not treat mocked internals as E2E coverage.
- Do not declare shipped before `production-smoke` passes on `edge-matte.ozby.dev`.
