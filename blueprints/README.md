# Blueprints

This directory is the canonical home for implementation plans (blueprints).
Each subdirectory represents a lifecycle state:

- `draft/` — early-stage sketches. Expect churn; move to `planned/` once scoped.
- `planned/` — committed-to specs, ready to pick up.
- `in-progress/` — actively being executed. Exactly one blueprint per lane.
- `completed/` — execution finished and verified. Kept for reference.
  EdgeMatte (2026-05-27): parent + four child blueprints live under
  [`completed/`](./completed/).
- `parked/` — intentionally paused. Include a reason in the spec's frontmatter.
- `archived/` — superseded or abandoned. Not deleted — the record matters.

## Authoring

- Use [blueprint template](../docs/templates/blueprint.md) as the starting point.
- Blueprint YAML keys validated against [blueprint schema](../docs/templates/blueprint.yaml).
- For iterative refinement, load the `plan-refine` skill
  ([plan-refine skill](https://github.com/webpresso/agent-kit/blob/main/skills/plan-refine/SKILL.md)).

## Moving between states

- `draft → planned`: the spec passes the plan-audit checklist
  ([plan audit checklist](https://github.com/webpresso/agent-kit/blob/main/docs/guides/plan-audit-checklist.md)).
- `planned → in-progress`: work has started in a worktree or a lane.
- `in-progress → completed`: all acceptance criteria verified.
- Any state → `archived`: when the work is dropped or replaced.

Move files with `git mv` so history follows the spec through its lifecycle.

## Current state (2026-06-16)

No EdgeMatte blueprint is actively in progress. The repo's current truth is:

- the consumer standard (`apps/client` + `apps/workers` + `infra`) is completed,
- deploy helpers are infra-owned under `infra/src/deploy/**`,
- the June 16 standardization closeout is now recorded as completed, and
- `2026-05-28-edge-matte-security-hardening.md` remains intentionally parked.

Use completed blueprints as historical implementation records and the parked
security lane only when that external rollout work is explicitly re-opened.

## Historical EdgeMatte blueprints

| Blueprint                                     | Status    | Path                                                                                                                                                                 | Notes                                                                                                                                          |
| --------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent roadmap                                | archived  | [`archived/2026-05-27-edge-matte.md`](./archived/2026-05-27-edge-matte.md)                                                                                           | Archived as the historical parent record; remaining deploy-truth follow-through lives in audit remediation.                                    |
| Workspace scaffold                            | archived  | [`archived/2026-05-27-edge-matte-workspace-scaffold.md`](./archived/2026-05-27-edge-matte-workspace-scaffold.md)                                                     | Historical milestone record.                                                                                                                   |
| Core pipeline                                 | archived  | [`archived/2026-05-27-edge-matte-core-pipeline.md`](./archived/2026-05-27-edge-matte-core-pipeline.md)                                                               | Historical milestone record.                                                                                                                   |
| UI + E2E                                      | archived  | [`archived/2026-05-27-edge-matte-ui-and-e2e.md`](./archived/2026-05-27-edge-matte-ui-and-e2e.md)                                                                     | Historical milestone record.                                                                                                                   |
| Infra + release                               | archived  | [`archived/2026-05-27-edge-matte-infra-and-release.md`](./archived/2026-05-27-edge-matte-infra-and-release.md)                                                       | Historical milestone record referenced by the deploy-contract lane.                                                                            |
| Result page URL                               | completed | [`completed/2026-06-02-edge-matte-result-page-url.md`](./completed/2026-06-02-edge-matte-result-page-url.md)                                                         | Completed and verified.                                                                                                                        |
| `wp` deploy adapter + toolchain isolation     | completed | [`completed/2026-06-02-edge-matte-wp-deploy-adapter-toolchain-isolation.md`](./completed/2026-06-02-edge-matte-wp-deploy-adapter-toolchain-isolation.md)             | Closed with preview-lane mapping fix, fresh dry-run proof for `prd` / `preview_main` / `preview_pr_123`, and green `wp` quality + audit gates. |
| Shared deploy workflow alignment cleanup      | completed | [`completed/2026-06-09-edge-matte-shared-reusable-deploy-workflow-alignment.md`](./completed/2026-06-09-edge-matte-shared-reusable-deploy-workflow-alignment.md)     | Completed truth-state cleanup after the reusable workflow callers landed.                                                                      |
| Consumer apps/workers + infra standardization | completed | [`completed/2026-06-16-edge-matte-consumer-apps-workers-infra-standardization.md`](./completed/2026-06-16-edge-matte-consumer-apps-workers-infra-standardization.md) | Closed the final bookkeeping lane after confirming the standardized repo shape was already present on branch.                                  |

## Governance

Active blueprints must align with:

- [Architecture](../docs/architecture.md)
- [Architecture Contract](../docs/architecture.contract.json)

## Link policy

Blueprint docs must not reference local filesystem paths from a workstation.
Use relative links for same-repo files and allow full URLs for cross-repo references.
Enforced by `pnpm run audit:blueprint-links`.

## Architecture before

No topology, routing, or deployment boundary changes.

## Architecture after

No topology, routing, or deployment boundary changes.
