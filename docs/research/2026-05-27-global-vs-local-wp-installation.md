---
type: research
title: "Global vs Local `wp` Installation (Webpresso) for EdgeMatte"
subject: "Whether this repo should use global `wp` or a repo-pinned local Webpresso/agent-kit dependency"
date: 2026-05-27
last_updated: 2026-05-27
confidence: high
verdict: superseded
superseded_by: "Repo decision 2026-05-27 — global `wp`/`vp` on PATH; no `@webpresso/agent-kit` in root `package.json`. See README and parent blueprint public-install caveat."
---

# Global vs Local `wp` Installation (Webpresso) for EdgeMatte

> **Superseded.** EdgeMatte adopted **global `wp`/`vp`** so `pnpm install` stays public-token-free. This doc remains as historical analysis of the trade-off; do not treat the "local pinned default" recommendation as current policy.

> ~~Local, repo-pinned `wp` is the best default for reproducibility and policy enforcement; keep global `wp` only as an operator convenience fallback.~~

## TL;DR

- The Node/npm/pnpm ecosystem supports global CLIs, but modern reproducibility guidance favors project-scoped tooling executed via local bins (`pnpm exec` / scripts).
- For this repo specifically, local `wp` is structurally better because project `.npmrc` scope routing and token interpolation are part of install/auth behavior.
- `gh auth token` can supply a token, but package download still fails if package ACL/permissions are missing; this is an access-governance issue, not a CLI issue.
- Recommendation: keep local pinned dependency as the governed default; document a global fallback only for emergency/manual ops.

## What This Is

This research evaluates the trade-off between:

1. relying on a globally installed `wp` CLI; versus
2. pinning Webpresso/agent-kit in `devDependencies` and running via local tool surfaces (`pnpm exec wp`, scripts, hooks, CI).

## State of the Art (2026)

- npm still distinguishes local vs global installs; local executables are linked under `node_modules/.bin`, which scripts and runners consume naturally ([npm folders](https://docs.npmjs.com/cli/v11/configuring-npm/folders/)).
- pnpm explicitly recommends running dependency CLIs via project scope (`pnpm exec` adds `node_modules/.bin` to `PATH`, no global install needed) ([pnpm exec](https://pnpm.io/cli/exec)).
- Lockfile-first CI behavior is now standard: pnpm fails in CI when lockfile update is needed, and frozen installs are default in CI when lockfile exists ([pnpm install](https://pnpm.io/cli/install)).
- Package-manager version pinning through project metadata is first-class: Corepack recommends declaring `packageManager` for deterministic installs ([Corepack README](https://nodejs.org/api/corepack.html)).

## Positive Signals

### Reproducibility and deterministic execution

- Local binaries via project dependency graph reduce “works on my machine” drift because every developer/CI runner resolves the same version path ([pnpm exec](https://pnpm.io/cli/exec), [pnpm install](https://pnpm.io/cli/install)).
- Corepack’s guidance aligns with project-level pinning and strict package-manager matching for deterministic behavior ([Corepack README](https://nodejs.org/api/corepack.html)).  
  **Credibility:** high (official runtime/tooling docs).

### Better fit for scoped private registries

- GitHub Packages npm usage is designed around project `.npmrc` scope mapping (`@NAMESPACE:registry=...`) ([GitHub npm registry docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)).
- npm config docs state project `.npmrc` applies in project root and **is not read in global mode** (`npm install -g`) ([npmrc docs](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc/)).  
  **Inference:** this strongly favors local/project installs for scoped registry consistency.  
  **Credibility:** high.

### Secret-handling compatibility

- npm supports environment-variable interpolation in `.npmrc` (`${VARIABLE_NAME}`), so package auth can remain secret-provider driven and off disk ([npmrc docs](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc/)).
- GitHub package install requires correct token scope/access (`read:packages` + package read permission), independently of CLI choice ([GitHub package permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)).  
  **Credibility:** high.

## Negative Signals

### Global CLIs are convenient and officially valid

- npm explicitly documents global installs as normal for command-line tools ([npm folders](https://docs.npmjs.com/cli/v11/configuring-npm/folders/)).
- `npx`/`npm exec` can run package commands without adding a permanent local dependency, lowering setup friction for one-off usage ([npx docs](https://docs.npmjs.com/cli/commands/npx/)).  
  **Credibility:** high, but these are convenience-oriented workflows.

### Local pinning increases dependency/auth coupling

- Repo-pinned private packages create hard dependency on registry ACL correctness and token validity; 403s block install even when command surface is otherwise correct ([GitHub npm registry docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry), [GitHub package permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)).
- In practice, `gh auth token` only provides a token value; it does not guarantee that token/package permissions are sufficient for tarball fetches ([gh auth token](https://cli.github.com/manual/gh_auth_token), [gh auth login](https://cli.github.com/manual/gh_auth_login)).  
  **Credibility:** high.

## Community Sentiment

Practitioner norms in official docs and tool design trend toward:

- **local/project execution for reproducibility** (pnpm/Corepack conventions);
- **global installs for operator convenience** when strict reproducibility is less critical.

I did **not** rely on forum anecdotes for core claims here; the recommendation is grounded in official docs and observed repo behavior.

## Project Alignment

### Vision Fit

`VISION.md` is currently a template stub, so alignment confidence is constrained. Given this repo’s explicit governance posture (`wp` audits, architecture drift checks, secret policy), local pinned tooling better matches the current “contract-first” operating model.

### Tech Stack Fit

- Stack already uses pnpm + TypeScript + script-driven QA.
- `packageManager` is declared, and CI/dev checks already assume lockfile-driven repeatability.
- Using project `.npmrc` for scoped registry/token interpolation is directly compatible with current “no secrets on disk” policy.

### Trade-offs for Current Stage

- **Now:** local pinning is the right default for consistency and policy compliance.
- **Operational caveat:** install reliability depends on package ACL/token hygiene; this must be owned as part of repo onboarding/runbooks.

## Recommendation

**Verdict: adopt (high confidence).**

Adopt a local, repo-pinned Webpresso/agent-kit dependency as the default execution path (`pnpm exec wp`, package scripts, hooks, CI). Keep global `wp` as a documented fallback for ad hoc/manual use only.

Conditions that would change this recommendation:

1. if this repo intentionally drops Webpresso governance/audits; or
2. if package-access constraints make private-registry installs consistently unworkable across the team.

## Sources

1. [npm Docs: Folders](https://docs.npmjs.com/cli/v11/configuring-npm/folders/) — official docs, high credibility, neutral/mixed.
2. [pnpm Docs: `pnpm exec`](https://pnpm.io/cli/exec) — official docs, high credibility, positive for local execution.
3. [pnpm Docs: `pnpm install`](https://pnpm.io/cli/install) — official docs, high credibility, positive for lockfile/CI determinism.
4. [Node.js Corepack README](https://nodejs.org/api/corepack.html) — official runtime docs, high credibility, positive for project pinning.
5. [npm Docs: `.npmrc`](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc/) — official docs, high credibility, positive for env-var secret injection and project config behavior.
6. [GitHub Docs: Working with npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) — official docs, high credibility, mixed (best practices + auth constraints).
7. [GitHub Docs: About permissions for GitHub Packages](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages) — official docs, high credibility, negative risk signal for ACL/token mismatch.
8. [GitHub CLI Manual: `gh auth token`](https://cli.github.com/manual/gh_auth_token) — official docs, high credibility, neutral.
9. [GitHub CLI Manual: `gh auth login`](https://cli.github.com/manual/gh_auth_login) — official docs, high credibility, mixed (token sourcing guidance + caveats).
10. [npm Docs: `npx`](https://docs.npmjs.com/cli/commands/npx/) — official docs, high credibility, positive for one-off global-less convenience.
