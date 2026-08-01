# Contributing to EdgeMatte

Thanks for your interest in EdgeMatte — a Cloudflare-native reference app for
image matting. This guide covers local setup, the verification commands, and
the commit/PR conventions this repo expects.

## Prerequisites

- Node `>=24`
- `pnpm@11.1.1` (managed via the `packageManager` field)
- `vp` (vite-plus)

`vp install --frozen-lockfile` installs the repo's pinned dependencies and runs
`wp setup` during `postinstall`. Consumers keep `@webpresso/app-config` as
their direct package surface; `wp` remains a separately installed global CLI.

The worker runs on Cloudflare Workers (Hono). Background removal in production
uses the native `cf.image segment: "foreground"` (BiRefNet) transform — there
is **no external API key**. Locally you can run the full flow against a mock
pipeline with no Cloudflare account or secrets.

## Setup

```bash
vp install --frozen-lockfile
```

`vp install` runs `postinstall`, which invokes `wp setup` to bootstrap the
managed hooks/runtime surfaces. If those drift later, rerun `wp setup`.

Run the app locally against the no-setup mock pipeline:

```bash
wp run --filter @edge-matte/worker dev:mock
```

This boots `wrangler dev` with `E2E_MOCK_PIPELINE:1` and prints a local URL;
the full upload → process → host → delete flow works without any secrets.

## Verify your change

**Fast contributor check** — run this before opening a PR. It is hermetic
(no secrets, no network):

```bash
vp install --frozen-lockfile
wp run -r lint
wp run -r check-types
wp run test
wp run e2e -- --suite smoke
```

For the HTTP contract surface, also run:

```bash
wp run e2e -- --suite upload-delete-contract
```

**Full maintainer check (maintainer only)** — adds mutation testing, the
architecture-drift gate, and production e2e. Requires deploy credentials and a
live deployment, so contributors do not need to run it:

```bash
wp run qa                               # wp lint + typecheck + vitest + mutation + playwright e2e
wp audit architecture-drift --root .
E2E_RUN_PRODUCTION=1 wp run e2e -- --suite production-smoke
E2E_RUN_PRODUCTION=1 wp run e2e -- --suite production-journey
```

## No secrets on disk

EdgeMatte follows a secret-provider-first workflow: secrets come from a runtime
secret provider, never from `.env` / `.dev.vars` files committed to the repo.
Do not add one. See [`docs/secrets.md`](./docs/secrets.md).

## Architecture and blueprints

Architecture is treated as a living, drift-checked contract:

- [`docs/architecture.md`](./docs/architecture.md) — source-of-truth diagrams.
- [`docs/architecture.contract.json`](./docs/architecture.contract.json) — the
  machine-checkable contract enforced by `wp audit architecture-drift`.
- Non-trivial changes go through a blueprint under `blueprints/`.

If your change touches the runtime topology, storage, or routes, update the
architecture contract in the same PR so the drift gate stays green.

## Commit conventions (Lore Commit Protocol)

Commits use Conventional-Commit subjects plus a structured **`Verified:`**
trailer block recording exactly how the change was checked. Commit messages are
treated as durable decision records, not diff labels.

Format (mirror existing `git log`):

```
fix(ci): route edge-matte act e2e through wp secrets run

Short rationale describing the decision and why.

Verified:
- node --test test/thin-consumer-contract.test.ts
- wp audit docs-frontmatter
- git diff --check on the staged files

Co-Authored-By: Your Name <you@example.com>
```

- Use a Conventional-Commit type/scope subject (`feat`, `fix`, `chore`,
  `style`, `docs`, etc.).
- List the actual verification commands you ran under `Verified:`.
- Keep one logical change per commit.

## Pull requests

- Branch off `main`; do not push directly to `main`.
- Keep the PR scoped to one logical change.
- Ensure the fast contributor check passes locally before requesting review.
- Describe the change, the verification you ran, and any architecture-contract
  or docs updates.
- Never hand-edit generated agent surfaces (`.agent/`, `.cursor/`,
  etc.) — they are synced by tooling.

## Code style

TypeScript with strict typing — no `any`, no default exports in new code, named
exports, readonly by default, and structured logging. `oxlint` enforces most of
this; run `wp run -r lint` before committing.
