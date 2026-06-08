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

## Active work (2026-06-08)

| Blueprint            | Path                                                                                                                                                 | Purpose                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit remediation    | [`in-progress/2026-05-27-edge-matte-audit-remediation.md`](./in-progress/2026-05-27-edge-matte-audit-remediation.md)                                 | Truthful CI/E2E/runtime verification; remaining live work is quality-rail alignment, a green production deploy, and final truth-state capture                                                           |
| Deploy contract      | [`in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`](./in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md) | Extract a reusable Cloudflare deploy contract: EdgeMatte now uses the same custom-domain preview lane shape as IngestLens while `agent-kit` policy is in scope and private infra plumbing stays private |
| Security hardening   | [`parked/2026-05-28-edge-matte-security-hardening.md`](./parked/2026-05-28-edge-matte-security-hardening.md)                                           | Parked after repo-local closure; remaining work is external Cloudflare rollout/evidence for Access, Turnstile, public security config, and WAF/rate limiting                                            |
| E2E confidence suite | [`in-progress/2026-05-29-edge-matte-e2e-confidence-suite.md`](./in-progress/2026-05-29-edge-matte-e2e-confidence-suite.md)                           | Partially landed follow-through lane: hermetic PR `e2e` gate is shipped; remaining work is release/docs parity, live `production-smoke` + `production-journey` evidence, and required-check proof       |

Wave 0 (secrets governance) is complete in the working tree. The three active
blueprints plus the one parked follow-up were refreshed against the current repo
state on **2026-06-08**; use each blueprint’s lane-boundary notes before
parallel edits.

For the deploy-contract lane specifically, treat **agent-kit** as the only
shared-policy upstream in scope; do not expand that blueprint into gstack or
OMX work just because adjacent external bugs exist.
The reusable Cloudflare/Pulumi helper package for that lane is
**private/internal by default**. If it is ever proposed as a public package,
that promotion must happen in a separate package-surface blueprint with
`catalog/agent/rules/public-package-safety.md` review plus tarball and
denied-content auditing; reusability alone is not permission to publish.

## Historical EdgeMatte blueprints

| Blueprint                                 | Status     | Path                                                                                                                                                     | Notes                                                                                                                                           |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent roadmap                            | archived   | [`archived/2026-05-27-edge-matte.md`](./archived/2026-05-27-edge-matte.md)                                                                               | Archived as the historical parent record; remaining deploy-truth follow-through lives in audit remediation.                                    |
| Workspace scaffold                        | archived   | [`archived/2026-05-27-edge-matte-workspace-scaffold.md`](./archived/2026-05-27-edge-matte-workspace-scaffold.md)                                         | Historical milestone record.                                                                                                                   |
| Core pipeline                             | archived   | [`archived/2026-05-27-edge-matte-core-pipeline.md`](./archived/2026-05-27-edge-matte-core-pipeline.md)                                                   | Historical milestone record.                                                                                                                   |
| UI + E2E                                  | archived   | [`archived/2026-05-27-edge-matte-ui-and-e2e.md`](./archived/2026-05-27-edge-matte-ui-and-e2e.md)                                                         | Historical milestone record.                                                                                                                   |
| Infra + release                           | archived   | [`archived/2026-05-27-edge-matte-infra-and-release.md`](./archived/2026-05-27-edge-matte-infra-and-release.md)                                           | Historical milestone record referenced by the deploy-contract lane.                                                                            |
| Result page URL                           | completed  | [`completed/2026-06-02-edge-matte-result-page-url.md`](./completed/2026-06-02-edge-matte-result-page-url.md)                                             | Completed and verified.                                                                                                                        |
| `wp` deploy adapter + toolchain isolation | completed  | [`completed/2026-06-02-edge-matte-wp-deploy-adapter-toolchain-isolation.md`](./completed/2026-06-02-edge-matte-wp-deploy-adapter-toolchain-isolation.md) | Closed with preview-lane mapping fix, fresh dry-run proof for `prd` / `preview_main` / `preview_pr_123`, and green `wp` quality + audit gates. |

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
