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

## Active work (2026-05-30)

| Blueprint | Path | Purpose |
| --- | --- | --- |
| Audit remediation | [`in-progress/2026-05-27-edge-matte-audit-remediation.md`](./in-progress/2026-05-27-edge-matte-audit-remediation.md) | Truthful CI/E2E/runtime verification; remaining live work is quality-rail alignment, a green production deploy, and final truth-state capture |
| Deploy contract | [`in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`](./in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md) | Extract a reusable Cloudflare deploy contract: agent-kit policy + private infra plumbing |
| Security hardening | [`planned/2026-05-28-edge-matte-security-hardening.md`](./planned/2026-05-28-edge-matte-security-hardening.md) | Private-beta security controls: Access, Turnstile, public security config, WAF/rate limiting |
| E2E confidence suite | [`in-progress/2026-05-29-edge-matte-e2e-confidence-suite.md`](./in-progress/2026-05-29-edge-matte-e2e-confidence-suite.md) | Narrowed follow-through lane for release/docs parity, live production-journey proof, and required-check evidence |

Wave 0 (secrets governance) is complete in the working tree. All four active or
next-up blueprints were refreshed against the current repo state on
**2026-05-30**; use each blueprint’s lane-boundary notes before parallel edits.

## Completed EdgeMatte blueprints (2026-05-27)

| Blueprint          | Path                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Parent roadmap     | [`completed/2026-05-27-edge-matte.md`](./completed/2026-05-27-edge-matte.md)                                       |
| Workspace scaffold | [`completed/2026-05-27-edge-matte-workspace-scaffold.md`](./completed/2026-05-27-edge-matte-workspace-scaffold.md) |
| Core pipeline      | [`completed/2026-05-27-edge-matte-core-pipeline.md`](./completed/2026-05-27-edge-matte-core-pipeline.md)           |
| UI + E2E           | [`completed/2026-05-27-edge-matte-ui-and-e2e.md`](./completed/2026-05-27-edge-matte-ui-and-e2e.md)                 |
| Infra + release    | [`completed/2026-05-27-edge-matte-infra-and-release.md`](./completed/2026-05-27-edge-matte-infra-and-release.md)   |

The parent roadmap retains one open acceptance item (manual production smoke)
until [`in-progress/2026-05-27-edge-matte-audit-remediation.md`](./in-progress/2026-05-27-edge-matte-audit-remediation.md)
closes the deploy CI lane.

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
