---
type: blueprint
title: Repoint setup-wp to the public github-actions action
status: draft
complexity: S
owner: claude
created: "2026-07-15"
last_updated: "2026-07-15"
progress: "0% (drafted; implementation verified manually, pending formal task-verify)"
depends_on: []
tags: [ci, agent-kit]
---

# Repoint setup-wp to the public github-actions action

**Goal:** Repoint this repo's `ci.yml`, `architecture-drift.yml`, and
`release.yml` setup-wp action references from the private
`webpresso/agent-kit` repo to the new public
`webpresso/github-actions/.github/actions/setup-wp` action, since GitHub
cannot grant private-repo Actions access to callers outside the `webpresso`
GitHub org.

- [Architecture narrative](../../../docs/architecture.md)
- [Architecture contract](../../../docs/architecture.contract.json)
- Deployment target remains `edge-matte.ozby.dev`.

This is CI toolchain maintenance. It does not change runtime topology,
deployment shape, storage boundaries, or the public application contract.

## Architecture before

Edge-matte runtime and deployment architecture are unchanged. CI jobs
install `wp` via a `uses:` reference to a composite action hosted in the
private `webpresso/agent-kit` repo, which cannot be resolved by this repo's
GitHub org — every CI run fails at "Set up job".

## Architecture after

Edge-matte runtime and deployment architecture remain unchanged. CI jobs
install `wp` via the same composite-action pattern, now hosted in the public
`webpresso/github-actions` repo, which this repo's org can resolve. The
action now takes an explicit `version` input (`"2.4.1"`), matching this
repo's existing version-pinning convention.

## Product wedge anchor

- **Stage outcome:** This repo is a live, publicly-hosted product
  (`edge-matte.ozby.dev`, background-removal via Cloudflare Workers). Every CI
  run currently fails at "Set up job" with `Unable to resolve action
'webpresso/agent-kit', not found`, because that action lives in a private
  repo this repo's GitHub org cannot access.
- **Consuming surface:** This repo's own `.github/workflows/*.yml` — every PR
  to this repo, regardless of what it changes.
- **New user-visible capability:** Every future PR to this repo can pass CI
  again — currently every PR is red regardless of the actual code change,
  blocking all shipping.

## Key Decisions

| Decision                                | Choice                                                                                                                     | Rationale                                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where to source `wp` install            | Public `webpresso/github-actions/.github/actions/setup-wp` action                                                          | GitHub cannot grant this repo's org access to the private `webpresso/agent-kit` repo's Actions                                                                              |
| Version                                 | Hardcoded `version: "2.4.1"` on each occurrence                                                                            | Matches this repo's existing convention (no env-override, unlike ingest-lens)                                                                                               |
| `scripts/check-workflow-action-pins.ts` | Removed the check that rejected any `setup-wp` `with: version:` input; updated reason text on the `AGENT_KIT_VERSION` rule | The old private action was self-versioning; the new one requires an explicit version, so the old rejection rule is now backwards                                            |
| `vite.config.ts`                        | Added minimal `fmt: {}`                                                                                                    | Pre-commit's `wp format --affected` was failing repo-wide with "No formatter config owner found"; discovered while verifying this change, matches sibling repos' convention |

Note: this repo also has an existing unrelated draft blueprint,
`blueprints/draft/migrate-agent-kit-ci-bootstrap-to-immutable-setup-wp/`,
which documents the original (now known-broken) design this fix supersedes.
Not touched here — left for its own owner to update or archive.

#### Task 1.1: Repoint all 5 setup-wp occurrences and fix pin governance

**Status:** todo

**Depends:** None

Swap all 5 `uses:` occurrences across `ci.yml` (3), `architecture-drift.yml`
(1), and `release.yml` (1) from
`webpresso/agent-kit/.github/actions/setup-wp@e02badc2ba922b2d8cbfe7f3f35fb9cf56848182`
to `webpresso/github-actions/.github/actions/setup-wp@c2c71a7a4be446fc6858e6b57bf55a11ccfa2d88`
(the merge commit of `webpresso/github-actions#23`), each with
`with: version: "2.4.1"`. Fix `scripts/check-workflow-action-pins.ts`'s
hardcoded assumption that `setup-wp` must never receive a `version` input.

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/architecture-drift.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/check-workflow-action-pins.ts`
- Modify: `vite.config.ts`

**Acceptance:**

- [ ] All 5 `uses:` occurrences point at the new public action's SHA with `version: "2.4.1"` (verified manually)
- [ ] `actionlint` (repo root, auto-discovery) exits 0 (verified manually — passed)
- [ ] `node scripts/check-workflow-action-pins.ts` exits 0 (verified manually — passed)
- [ ] `node --test test/*.test.ts`: 67/67 pass (verified manually — passed)
- [ ] `wp format --affected` exits 0 (pre-commit hook) (verified manually — passed)

---

## Verification Gates

| Gate            | Command                                      | Success Criteria |
| --------------- | -------------------------------------------- | ---------------- |
| Action lint     | `actionlint` (repo root, auto-discovery)     | Exit 0           |
| Pin governance  | `node scripts/check-workflow-action-pins.ts` | Exit 0           |
| Full test suite | `node --test test/*.test.ts`                 | 67/67 pass       |

## Cross-Plan References

| Type       | Blueprint                                                                                                                                  | Relationship                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Upstream   | `webpresso/github-actions#23` (adds the public `setup-wp` action)                                                                          | blocking dependency, merged first |
| Downstream | Sibling fixes in `webpresso/framework`, `ozby/ingest-lens`, `ozby/aksaprocess.tr`, and `webpresso/github-actions`'s own reusable workflows | parallel, independent PRs         |

## Non-goals

- Does not add a repo-local `@webpresso/agent-kit` package dependency (forbidden by `test/thin-consumer-contract.test.ts`, left untouched).
- Does not update or archive the pre-existing unrelated draft blueprint documenting the old design.

## Risks

| Risk                                                                      | Impact                | Mitigation                                                                               |
| ------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| Governance scripts encoding the old design could resurface in other repos | Same CI break repeats | Same fix pattern applied to sibling repos in this migration; each verified independently |
