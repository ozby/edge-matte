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

- Use `docs/templates/blueprint.md` as the starting point.
- Blueprint YAML keys validated against `docs/templates/blueprint.yaml`.
- For iterative refinement, load the `plan-refine` skill
  (`.agent/skills/plan-refine/SKILL.md`).

## Moving between states

- `draft → planned`: the spec passes the plan-audit checklist
  (`.agent/guides/plan-audit-checklist.md`).
- `planned → in-progress`: work has started in a worktree or a lane.
- `in-progress → completed`: all acceptance criteria verified.
- Any state → `archived`: when the work is dropped or replaced.

Move files with `git mv` so history follows the spec through its lifecycle.

## Completed EdgeMatte blueprints (2026-05-27)

| Blueprint          | Path                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Parent roadmap     | [`completed/2026-05-27-edge-matte.md`](./completed/2026-05-27-edge-matte.md)                                       |
| Workspace scaffold | [`completed/2026-05-27-edge-matte-workspace-scaffold.md`](./completed/2026-05-27-edge-matte-workspace-scaffold.md) |
| Core pipeline      | [`completed/2026-05-27-edge-matte-core-pipeline.md`](./completed/2026-05-27-edge-matte-core-pipeline.md)           |
| UI + E2E           | [`completed/2026-05-27-edge-matte-ui-and-e2e.md`](./completed/2026-05-27-edge-matte-ui-and-e2e.md)                 |
| Infra + release    | [`completed/2026-05-27-edge-matte-infra-and-release.md`](./completed/2026-05-27-edge-matte-infra-and-release.md)   |

Production deploy to `https://edge-matte.ozby.dev` remains pending a CI fix;
local verification passed on 2026-05-27.

## Governance

Active blueprints must align with:

- [`docs/architecture.md`](../docs/architecture.md)
- [`docs/architecture.contract.json`](../docs/architecture.contract.json)

## Architecture before

No topology, routing, or deployment boundary changes.

## Architecture after

No topology, routing, or deployment boundary changes.
