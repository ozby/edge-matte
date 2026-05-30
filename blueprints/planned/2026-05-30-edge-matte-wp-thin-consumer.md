---
type: blueprint
status: planned
complexity: M
created: '2026-05-30'
last_updated: '2026-05-30'
progress: '0% (drafted)'
depends_on:
  - /Users/ozby/repos/webpresso/agent-kit/blueprints/planned/2026-05-30-cross-project-wp-execution-map.md
  - /Users/ozby/repos/webpresso/agent-kit/blueprints/planned/2026-05-30-agent-kit-base-wp-core.md
tags:
  - wp
  - edge-matte
  - thin-consumer
  - tooling
---

# EdgeMatte: `wp`-first thin-consumer migration

**Goal:** Finish EdgeMatte’s transition to a `wp`-first thin-consumer surface by
removing active public raw `pnpm`, direct `vitest`, and bare `tsc` from normal
workflows and shrinking duplicated generic tooling after wrapper checks pass.

## Planning Summary

- Goal input: `EdgeMatte thin-consumer wp-first migration`
- Complexity: `M`
- Draft slug: `2026-05-30-edge-matte-wp-thin-consumer`
- Output path: `blueprints/planned/2026-05-30-edge-matte-wp-thin-consumer.md`
- Validation scope: parser compliance + architecture-contract consistency

## Architecture Overview

```text
developer/CI
  -> wp install/setup/test/typecheck/lint/format --check
  -> agent-kit-owned generic workflows
  -> edge-matte keeps only app/runtime/deploy-specific behavior
```

## Architecture before

EdgeMatte already has significant `wp`/shared tooling adoption, but active
public surfaces still include legacy command leakage and duplicated generic
tooling ownership in places where the repo should behave like a thin consumer.

## Architecture after

EdgeMatte uses `wp` as the default surface for generic workflows and retains
only app/runtime/deploy-specific behavior locally. Generic tooling duplication
is reduced after verification proves the wrapper surface is stable.

## Key Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Consumer class | thin consumer | EdgeMatte should not need framework extension behavior |
| Generic workflow owner | `agent-kit` | Shared quality/setup flows belong upstream |
| Drift enforcement | keep architecture checks in the loop | repo contract requires architecture consistency on active blueprints |

## Quick Reference (Execution Waves)

| Wave | Tasks | Dependencies | Parallelizable | Effort (T-shirt) |
| ---- | ----- | ------------ | -------------- | ---------------- |
| **Wave 0** | 1.1 | None | 1 agent | S |
| **Wave 1** | 1.2, 1.3 | Task 1.1 | 2 agents | S |
| **Wave 2** | 2.1 | Wave 1 | 1 agent | S |
| **Critical path** | 1.1 → 1.2 → 2.1 | -- | 3 waves | M |

### Phase 1: public-surface migration [Complexity: M]

#### [cli] Task 1.1: Replace active public raw `pnpm`, direct `vitest`, and bare `tsc`

**Status:** todo

**Depends:** None

Update active scripts, docs, workflows, and template outputs so generic flows
route through `wp`. Preserve only structural or intentionally low-level
substrate references.

**Files:**

- Modify: `package.json`
- Modify: `apps/**/package.json`
- Modify: `.github/workflows/**`
- Modify: `README.md`
- Modify: `docs/**`

**Steps (TDD):**

1. Add or refresh command-surface tests/audits for public raw `pnpm` / direct tool leakage.
2. Run scoped checks — verify FAIL.
3. Update the public surfaces to `wp`-first usage.
4. Run scoped checks — verify PASS.

**Acceptance:**

- [ ] Active public generic workflows are `wp`-first.
- [ ] Remaining raw `pnpm` references are substrate or intentional exceptions only.

#### [config] Task 1.2: Standardize normal flows on `wp install/setup/test/typecheck/lint/format --check`

**Status:** todo

**Depends:** Task 1.1

Align the repo’s intended daily command set on the base `wp` contract so local
docs, scripts, and CI reinforce the same thin-consumer surface.

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/**`
- Modify: `docs/**`

**Steps (TDD):**

1. Add or update checks that pin the intended command set in active guidance.
2. Run scoped checks — verify FAIL.
3. Update the command set and docs.
4. Run scoped checks — verify PASS.

**Acceptance:**

- [ ] Normal user/CI flows align on the same `wp` command set.
- [ ] Generic upstream behavior is not reimplemented locally.

#### [deps] Task 1.3: Remove duplicated generic tooling after wrapper checks pass

**Status:** todo

**Depends:** Task 1.1

After wrapper-based checks pass, remove duplicated generic tooling that is no
longer needed for public workflow ownership.

**Files:**

- Modify: `package.json`
- Modify: `apps/**/package.json`
- Modify: `infra/package.json`

**Steps (TDD):**

1. Add or refresh package-ownership checks for required local deps.
2. Remove duplicated generic tooling incrementally.
3. Run scoped checks — verify PASS.

**Acceptance:**

- [ ] Generic tooling duplication is reduced safely.
- [ ] App/runtime/deploy-specific dependencies remain intact.

### Phase 2: consumer proof [Complexity: S]

#### [qa] Task 2.1: Add or refresh thin-consumer contract checks

**Status:** todo

**Depends:** Task 1.2, Task 1.3

Pin the intended thin-consumer surface with smoke checks and leakage audits so
future changes do not reintroduce public raw `pnpm`, direct `vitest`, or bare
`tsc`.

**Files:**

- Modify: `test/**`
- Modify: `apps/e2e/**`
- Modify: `**/*.test.*`

**Steps (TDD):**

1. Add failing contract checks for `wp install/setup/typecheck/test/lint/format --check`.
2. Run scoped checks — verify FAIL.
3. Implement the minimal verification updates.
4. Run scoped checks — verify PASS.

**Acceptance:**

- [ ] Thin-consumer contract checks pin the intended command surface.
- [ ] Public direct-tool leakage is part of verification.

## Verification Gates

| Gate | Command | Success Criteria |
| ---- | ------- | ---------------- |
| Architecture drift | `wp audit architecture-drift --root .` | No drift |
| Type safety | repo typecheck recipe | Zero errors |
| Lint | repo lint recipe | Zero violations |
| Tests | repo test recipe | Targeted suites pass |

## Cross-Plan References

| Type | Blueprint | Relationship |
| ---- | --------- | ------------ |
| Upstream | `2026-05-30-cross-project-wp-execution-map` | umbrella execution order |
| Upstream | `2026-05-30-agent-kit-base-wp-core` | base `wp` command contract |

## Edge Cases and Error Handling

| Edge Case | Risk | Solution | Task |
| --------- | ---- | -------- | ---- |
| Wrapper migration breaks local deploy/e2e helper behavior | broken repo-specific lanes | keep app/runtime/deploy-specific behavior local | 1.2, 1.3 |
| Active blueprint/docs drift during command cleanup | contract inconsistency | keep architecture drift audit in final verification | 2.1 |

## Non-goals

- Adopting framework-specific command behavior
- Removing repo-specific runtime/deploy dependencies solely for symmetry

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Public command cleanup collides with in-flight security/deploy work | High | keep this blueprint focused on generic workflow ownership only |
| Architecture docs drift while commands change | Medium | run architecture drift audit as part of verification |

## Technology Choices

| Component | Technology | Version | Why |
| --------- | ---------- | ------- | --- |
| Generic workflow owner | `@webpresso/agent-kit` | workspace consumer | Upstream `wp` surface |
| Local substrate | `pnpm` | repo-declared | Structural workspace dependency only |
