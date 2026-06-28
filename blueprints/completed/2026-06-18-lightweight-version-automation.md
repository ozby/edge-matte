---
type: blueprint
owner: ozby
title: "Lightweight version automation"
status: completed
completed_at: "2026-06-28"
complexity: S
created: "2026-06-18"
last_updated: "2026-06-28"
progress_pct: 100
progress: "100% (workflow lane lightening and shared workflow pin refresh are already present on main)"
depends_on: []
---

# Lightweight version automation

## Goal

- Keep `Version Packages` automation green without duplicating heavy PR/browser/preview/security work already covered on feature branches.

## Architecture governance

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

## Architecture before

- `changeset-release/main` PRs used the same heavy preview/security/browser lanes as feature branches.
- generated `Version Packages` merges on `main` could still trigger mutation/browser work that did not add new product signal.

## Architecture after

- feature branches remain the place where heavy preview/browser/security validation runs.
- generated release automation keeps lightweight integrity checks while skipping duplicated heavy lanes.

## Tasks

- Skip preview deploy and security scan on `changeset-release/main` PRs.
- Skip e2e and mutation on generated `Version Packages` pushes to `main`.
- Preserve the existing branch-protection-facing `wp-check` contract.
- Refresh shared Webpresso reusable workflow SHAs to the Node-24-safe release proven in ozby.dev.

#### [ci] Task 1.1: Lighten version automation workflow lanes

**Status:** done

**Depends:** None

- keep `wp-check` as the required quality gate
- skip duplicate preview/security PR lanes for generated release branches
- skip duplicate e2e/mutation work on generated `Version Packages` main merges
- bump shared preview/production/release reusable workflow pins to the validated Node-24-safe SHA

## Verification

- Workflow contract tests assert the skip rules.
- `wp audit architecture-drift --root .`
- Local targeted test suites pass after workflow edits.
- Release/preview workflow caller contract tests assert the shared SHA refresh.

## Current completion evidence

- Current `main` already implements the release-lane skip rules in:
  - `.github/workflows/ci.yml` for generated `Version Packages` mutation skips
  - `.github/workflows/ci.yml`, `.github/workflows/deploy-preview.yml`, and `.github/workflows/security-scan.yml` for `changeset-release/main` PR skips
- Shared reusable workflow callers are already pinned to the Node-24-safe SHA on current `main`.
- Local contract verification passed on 2026-06-28:
  - `node --test test/reusable-deploy-workflows.test.ts`
- Current-main GitHub evidence:
  - `CI` success on `9ecc1162444c3b50a858ed40556690b2e6a264cc`: https://github.com/ozby/edge-matte/actions/runs/28240218079
  - `Deploy preview` success on `9ecc1162444c3b50a858ed40556690b2e6a264cc`: https://github.com/ozby/edge-matte/actions/runs/28240218423
  - `Release` success on `9ecc1162444c3b50a858ed40556690b2e6a264cc`: https://github.com/ozby/edge-matte/actions/runs/28240218405
  - `Security scan` success on `9ecc1162444c3b50a858ed40556690b2e6a264cc`: https://github.com/ozby/edge-matte/actions/runs/28311390474
- `gh pr list --repo ozby/edge-matte --base main --state open` returned no open PRs on 2026-06-28.
