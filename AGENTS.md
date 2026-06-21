# Operating Contract

This repo treats architecture as a **living contract**, not a one-off design
artifact.

## Architecture source of truth

Authoritative order for architecture decisions:

1. `docs/architecture.md`
2. `docs/architecture.contract.json`
3. active blueprints under `blueprints/`
4. supporting research under `docs/research/`

If these disagree, update them in the same change.

## Required blueprint linkage

Every active blueprint must:

- link `docs/architecture.md`
- link `docs/architecture.contract.json`
- stay consistent with the current deployment target: `edge-matte.ozby.dev`

If a blueprint changes runtime topology, ports/adapters, deployment shape,
storage boundaries, queue strategy, state machine, or public contract, it must
contain these sections:

- `## Architecture before`
- `## Architecture after`

Do not mark architecture-changing work ready without both sections.

## Architecture drift enforcement

Before claiming completion on architecture, blueprint, deployment, or boundary
changes:

```bash
wp audit architecture-drift --root .
```

## DRY / SOLID / KISS

- Keep one pure pipeline core.
- Add ports only at real side-effect boundaries.
- Reuse agent-kit/Webpresso quality rails instead of bespoke wrappers.
- Prefer deleting duplication over adding abstraction.
- Never use hardcoded relative filesystem paths in executable code or config.
  Use absolute paths derived from an explicit anchor (repo root finder, package
  root finder, or runtime-provided absolute base path).

## Quality surface

Use agent-kit/Webpresso for tests, formatting, linting, and QA when the app is
scaffolded:

- `vp` for package scripts
- `wp` for setup/audits
- agent-kit MCP tools first when available; otherwise use the canonical `wp` / `vp` surface

Do not invent parallel local QA workflows when agent-kit already owns the lane.

## Secret-handling policy

- Never create or persist files like `.dev.vars` / `.dev.vars.example` or
  `.env` / `.env.*` (except `.env.example`); keep secrets only in platform
  secret stores and documented secret management paths.
- Do not write provider keys, tokens, or credentials to disk.
- Webpresso tooling (`wp`, `vp`, agent-kit audits) is expected on `PATH` via a
  global install — not as a repo-local npm dependency.

Enforced checks:

- Pre-commit runs `wp audit secrets-policy`, `wp audit absolute-path-policy --root .`,
  `wp audit secrets-config`, and `wp audit secret-provider-quarantine`
  via `.husky/pre-commit`.
- `vp run verify:secrets` runs the policy verifier and committed secrets metadata validation.
- Agents should prefer the shared `wp_audit(kind=absolute-path-policy)` / `wp audit absolute-path-policy --root .` surface.
- `verify:paths` remains a package-script wrapper, but agents should prefer `wp_audit(kind=absolute-path-policy)` / `wp audit absolute-path-policy --root .` directly.
- `vp run audit:secret-provider-quarantine` enforces provider-neutral secret execution.
