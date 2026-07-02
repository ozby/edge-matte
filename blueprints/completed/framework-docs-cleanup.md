---
type: blueprint
complexity: XS
owner: ozby
title: "EdgeMatte: framework docs cleanup"
status: completed
created: 2026-06-17
last_updated: "2026-07-02"
review_target: public GitHub repository
completed_at: "2026-07-02"
depends_on: []
progress: "Completed from fresh origin/main evidence: docs already reference @webpresso/framework, quarantine audit worktree handling is already landed, and architecture-drift now passes."
---

# EdgeMatte: framework docs cleanup

Update the remaining framework package reference in repo docs from the deprecated
`@webpresso/webpresso` umbrella wording to `@webpresso/framework` and keep the
existing EdgeMatte topology unchanged.

## Architecture governance

Architecture docs:

- [Architecture](../../docs/architecture.md)
- [Architecture Contract](../../docs/architecture.contract.json)

This lane stays on the existing `wp` / `vp` quality surface and does not add any
new runtime, deploy, or package boundaries.

## Architecture before

```text
Docs/secrets guidance mentions the deprecated @webpresso/webpresso package name.
The secret-provider quarantine audit also walks sibling _worktrees directories,
which can produce false positives during multi-worktree maintenance.
```

## Architecture after

```text
Docs/secrets guidance points to @webpresso/framework.
The secret-provider quarantine audit ignores sibling _worktrees clones, but the
EdgeMatte app/client/workers/infra topology and deploy lanes stay exactly the same.
```

## Objective

Record the docs-only framework package reference cleanup in a blueprint format
that satisfies repo governance, while documenting the paired audit guardrail
needed to keep CI green in a multi-worktree workspace.

## Tasks

### 1.1 Docs and audit cleanup

- [x] Replace the stale `@webpresso/webpresso` reference in `docs/secrets.md`
      with `@webpresso/framework`.
- [x] Update `wp audit secret-provider-quarantine` to ignore sibling
      `_worktrees` directories so the audit evaluates the actual repo, not local
      parallel worktree clones.
- [x] Keep the audit messaging aligned with the public framework package name.

## Verification

- [x] `pnpm check`
- [x] `~/.vite-plus/bin/wp audit blueprint-lifecycle blueprints/draft/framework-docs-cleanup.md`
- [x] `~/.vite-plus/bin/wp audit tph`
- [x] `~/.vite-plus/bin/wp audit architecture-drift --root .`

## Non-goals

- No runtime, routing, Worker, or deploy contract changes.
- No package version or release process changes.
- No new dependencies or CI workflows.

## Completion evidence

- `docs/secrets.md` already uses `@webpresso/framework`.
- `wp audit architecture-drift --root .` now passes on fresh `origin/main`.
- No runtime, deploy, or package-boundary changes were required beyond lifecycle truth.
