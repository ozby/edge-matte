---
type: blueprint
owner: ozby
title: "Lightweight version automation"
status: in-progress
complexity: S
created: "2026-06-18"
last_updated: "2026-06-18"
progress: "80% (workflow contract changes implemented locally; PR verification running)"
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

#### [ci] Task 1.1: Lighten version automation workflow lanes

**Status:** in progress

**Depends:** None

- keep `wp-check` as the required quality gate
- skip duplicate preview/security PR lanes for generated release branches
- skip duplicate e2e/mutation work on generated `Version Packages` main merges

## Verification

- Workflow contract tests assert the skip rules.
- `wp audit architecture-drift --root .`
- Local targeted test suites pass after workflow edits.
