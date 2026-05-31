---
type: blueprint
status: planned
complexity: M
created: "2026-05-30"
last_updated: "2026-05-31"
progress: "0% (drafted)"
cross_repo_depends_on:
  - repo: webpresso/agent-kit
    slug: 2026-05-30-cross-project-wp-execution-map
    require_status: planned
  - repo: webpresso/agent-kit
    slug: 2026-05-30-agent-kit-base-wp-core
    require_status: planned
tags:
  - wp
  - edge-matte
  - thin-consumer
  - tooling
---

# EdgeMatte: align thin-consumer cleanup with the shipped `vp` + `wp` contract

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

**Goal:** Keep EdgeMatte a thin consumer of shared `agent-kit` / `vite-plus`
quality rails by following the command model that actually ships today:
**`vp` owns install and package-manager/script orchestration; `wp` owns setup,
audits, and shipped quality-tool entrypoints such as typecheck/lint/format.**
Refine package-local drift against that real contract without inventing a local
future `wp`-only consumer model.

## Planning Summary

- Goal input: `EdgeMatte thin-consumer cleanup aligned to the shipped vp + wp split`
- Complexity: `M`
- Draft slug: `2026-05-30-edge-matte-wp-thin-consumer`
- Output path: `blueprints/planned/2026-05-30-edge-matte-wp-thin-consumer.md`
- Validation scope: parser compliance + architecture-contract consistency
- Current upstream truth: `agent-kit@0.21.5` still treats `vp` as the substrate
  for install/workspace script orchestration while shipping `wp` for setup,
  audits, and selected quality lanes

## Architecture Overview

```text
developer/CI
  -> vp install / vp run ...
  -> wp setup / wp audit / wp typecheck / wp lint / wp format
  -> agent-kit-owned generic workflows
  -> edge-matte keeps only app/runtime/deploy-specific behavior
```

## Architecture before

EdgeMatte root workflows already mostly match the shipped upstream split:
workspace orchestration runs through `vp`, while setup/audits already run
through `wp`. The remaining drift is mainly package-local direct tool usage
(`tsc --noEmit`, `vitest run`) whose treatment should depend on whether current
upstream surfaces already cover the need.

## Architecture after

EdgeMatte keeps the current root truth intact:

- **`vp`** remains the substrate for workspace orchestration (`vp install`,
  `vp run -r build`, `vp run -r lint`, `vp run -r check-types`, `vp run -r test`)
- **`wp`** remains the shared surface for setup/audits and shipped quality lanes
  (`wp setup`, `wp audit ...`, `wp typecheck`, `wp lint`, `wp format`)

Package-local drift is narrowed only where the shared surface already exists
today. Any remaining package-local direct-tool usage is preserved only with an
explicit reason tied to a current upstream capability gap or package-specific
runtime/config coupling.

## Key Decisions

| Decision                     | Choice                                    | Rationale                                                                                             |
| ---------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Consumer class               | thin consumer                             | EdgeMatte should consume shared `agent-kit` / `vite-plus` rails instead of growing repo-local clones  |
| Command model                | keep `vp` + `wp` split                    | Current shipped upstream still uses `vp` as substrate and `wp` for setup/audits/shipped quality lanes |
| No forced `wp`-only contract | do **not** replace all `vp` usage locally | Pushing past upstream reality would create local divergence and maintenance burden                    |
| Drift enforcement            | keep architecture checks in the loop      | repo contract requires architecture consistency on active blueprints                                  |

## Quick Reference (Execution Waves)

| Wave              | Tasks           | Dependencies | Parallelizable | Effort (T-shirt) |
| ----------------- | --------------- | ------------ | -------------- | ---------------- |
| **Wave 0**        | 1.1             | None         | 1 agent        | S                |
| **Wave 1**        | 1.2, 1.3        | Task 1.1     | 2 agents       | S                |
| **Wave 2**        | 2.1             | Wave 1       | 1 agent        | S                |
| **Critical path** | 1.1 → 1.2 → 2.1 | --           | 3 waves        | M                |

### Phase 1: package-local contract cleanup [Complexity: M]

#### [audit] Task 1.1: Audit every remaining package-local direct-tool surface

**Status:** todo

**Depends:** None

Inventory every remaining package-local generic tool surface (`vitest run`,
`tsc --noEmit`, and similar raw quality-tool entrypoints) and classify each as:

- convert now
- keep intentionally
- move upstream to `agent-kit`

**Files:**

- Modify: `apps/**/package.json`
- Modify: `infra/package.json`
- Modify: `blueprints/planned/2026-05-30-edge-matte-wp-thin-consumer.md`

**Steps (TDD):**

1. Enumerate package-local `vitest` / `tsc` usage.
2. Compare each case to the current shipped upstream `vp` + `wp` contract.
3. Mark each case as convert-now, justified-exception, or upstream-gap.
4. Record the reasoning in this blueprint before changing scripts.

**Acceptance:**

- [ ] Every remaining package-local direct-tool surface has an explicit classification.
- [ ] This blueprint reflects current upstream reality rather than an aspirational local model.

#### [config] Task 1.2: Convert only the unjustified direct-tool package scripts

**Status:** todo

**Depends:** Task 1.1

Replace package-local direct generic tooling only where the shared surface is
already shipped and meaningfully better. Do not rewrite packages to a local
`wp`-only command model.

**Files:**

- Modify: `apps/**/package.json`
- Modify: `infra/package.json`

**Steps (TDD):**

1. Add or refresh a contract check that fails on unjustified package-local raw tooling.
2. Run scoped checks — verify FAIL.
3. Convert only the cases already covered by shipped upstream surfaces.
4. Run scoped checks — verify PASS.

**Acceptance:**

- [ ] Package-local `tsc --noEmit` drift is removed only after package-local `wp typecheck` is smoke-proven in this repo.
- [ ] The root `vp` orchestration surface remains unchanged.

#### [docs] Task 1.3: Preserve and document justified exceptions

**Status:** todo

**Depends:** Task 1.1

If a package-local direct tool remains, document the reason here and keep the
exception narrow. Current examples include package-local Vitest entrypoints that
need explicit configs or package-specific prebuild coupling while upstream does
not yet ship a package-local `wp test` surface.

**Files:**

- Modify: `blueprints/planned/2026-05-30-edge-matte-wp-thin-consumer.md`
- Modify: `test/**`

**Steps (TDD):**

1. Encode allowed exceptions in contract tests.
2. Document the reason for each allowed exception in this blueprint.
3. Run scoped checks — verify PASS.

**Acceptance:**

- [ ] Every remaining direct `vitest run` surface is explicitly justified.
- [ ] No extra package-local wrapper dependencies are introduced just to fake shared tooling locally.

### Phase 2: consumer proof [Complexity: S]

#### [qa] Task 2.1: Add regression checks for the refined thin-consumer contract

**Status:** todo

**Depends:** Task 1.2, Task 1.3

Pin the actual intended split:

- root orchestration stays on `vp` + `wp`
- consumers do not add package-local wrapper dependencies without reason
- package-local direct-tool surfaces are either eliminated or explicitly justified

**Files:**

- Modify: `test/**`
- Modify: `apps/**/package.json`
- Modify: `infra/package.json`

**Steps (TDD):**

1. Add failing contract checks for the refined `vp` + `wp` split.
2. Run scoped checks — verify FAIL.
3. Implement the minimal script/test updates.
4. Run scoped checks — verify PASS.

**Acceptance:**

- [ ] Thin-consumer checks enforce wrapper-first root workflows.
- [ ] Package-local direct-tool usage is either absent or explicitly allowed.
- [ ] Consumers do not accrete extra local wrapper dependencies.

## Verification Gates

| Gate                | Command                                     | Success Criteria |
| ------------------- | ------------------------------------------- | ---------------- |
| Format check        | `vp run format:check`                       | Pass             |
| Lint                | `vp run -r lint`                            | Zero violations  |
| Type safety         | `vp run -r check-types`                     | Zero errors      |
| Governance tests    | `node --test "test/**/*.test.mjs"`          | Pass             |
| Workspace tests     | `vp run -r test`                            | Pass             |
| Docs audit          | `wp audit docs-frontmatter`                 | Pass             |
| Blueprint lifecycle | `wp audit blueprint-lifecycle --legacy-omx` | Pass             |
| Architecture drift  | `wp audit architecture-drift --root .`      | No drift         |
| Absolute paths      | `wp audit absolute-path-policy --root .`    | Pass             |
| Secrets policy      | `vp run verify:secrets`                     | Pass             |
| Secret quarantine   | `vp run audit:secret-provider-quarantine`   | Pass             |
| Blueprint links     | `vp run audit:blueprint-links`              | Pass             |

## Cross-Plan References

| Type     | Blueprint                                   | Relationship                         |
| -------- | ------------------------------------------- | ------------------------------------ |
| Upstream | `2026-05-30-cross-project-wp-execution-map` | umbrella execution order             |
| Upstream | `2026-05-30-agent-kit-base-wp-core`         | current shared `wp` capability scope |

## Edge Cases and Error Handling

| Edge Case                                                | Risk                   | Solution                                                                                         | Task     |
| -------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| Forcing `wp` where upstream has no package-local surface | local divergence       | keep the direct script, document the exception, and treat broader encapsulation as upstream work | 1.1, 1.3 |
| Package-local Vitest config or prebuild coupling         | broken test ergonomics | preserve direct Vitest entrypoints only where package-specific behavior is real                  | 1.3      |
| Active blueprint/docs drift during command cleanup       | contract inconsistency | keep architecture drift audit in final verification                                              | 2.1      |

## Non-goals

- Replacing all `vp` usage with `wp`
- Inventing a local future `wp test` / `wp install` consumer model before upstream ships it
- Adding package-local `@webpresso/agent-kit` or `vite-plus` dependencies just to mimic shared wrappers
- Removing repo-specific runtime/deploy dependencies solely for symmetry

## Risks

| Risk                                                                  | Impact | Mitigation                                                         |
| --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Thin-consumer cleanup gets expanded into an upstream product decision | High   | keep local changes limited to already-shipped `vp` / `wp` surfaces |
| Package script cleanup collides with in-flight security/deploy work   | Medium | keep this blueprint focused on generic workflow ownership only     |
| Architecture docs drift while commands change                         | Medium | run architecture drift audit as part of verification               |

## Technology Choices

| Component                  | Technology             | Version            | Why                                                                                                     |
| -------------------------- | ---------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| Shared quality/setup owner | `@webpresso/agent-kit` | workspace consumer | ships `wp setup`, `wp audit`, `wp typecheck`, `wp lint`, `wp format` today                              |
| Workspace substrate        | `vite-plus` (`vp`)     | workspace consumer | owns install and workspace script orchestration today                                                   |
| Package-local exceptions   | direct `vitest run`    | package-specific   | retained only where explicit config/prebuild coupling exists and upstream lacks package-local `wp test` |

## Current direct-tool classification

| Package/script            | Status             | Reason                                                                                                            |
| ------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `apps/client#check-types` | keep intentionally | blocked until package-local `wp typecheck` is smoke-proven through the current repo install/orchestration surface |
| `apps/e2e#check-types`    | keep intentionally | blocked until package-local `wp typecheck` is smoke-proven through the current repo install/orchestration surface |
| `apps/worker#check-types` | keep intentionally | blocked until package-local `wp typecheck` is smoke-proven through the current repo install/orchestration surface |
| `infra#check-types`       | keep intentionally | blocked until package-local `wp typecheck` is smoke-proven through the current repo install/orchestration surface |
| `apps/client#test`        | keep intentionally | current upstream does not ship a package-local `wp test`; this stays a direct Vitest entrypoint                   |
| `apps/e2e#test`           | keep intentionally | explicit E2E contract Vitest config entrypoint                                                                    |
| `apps/e2e#test:journeys`  | keep intentionally | explicit journeys Vitest config entrypoint                                                                        |
| `apps/worker#test`        | keep intentionally | package test combines a client prebuild dependency with Vitest execution                                          |

## Upstream boundary

If EdgeMatte later wants package-local `wp` wrappers beyond today’s shipped
setup/audit/typecheck/lint/format surfaces, treat that as an upstream
`agent-kit` capability blueprint first. EdgeMatte may consume shipped upstream
surfaces, but it should not invent a future upstream command model locally.

For `check-types` specifically, this repo should only switch a package from
direct `tsc --noEmit` to `wp typecheck` after both of these pass with fresh
evidence:

1. `wp typecheck` in the package working directory
2. `vp run --filter <package> check-types`
