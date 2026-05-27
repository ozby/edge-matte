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
python3 scripts/check_architecture_drift.py
```

This repo currently uses the local contract checker above. The intended shared
long-term surface is an agent-kit audit such as:

```bash
wp audit architecture-drift --root .
```

When that upstream audit exists, prefer it over the local checker.

## DRY / SOLID / KISS

- Keep one pure pipeline core.
- Add ports only at real side-effect boundaries.
- Reuse agent-kit/Webpresso quality rails instead of bespoke wrappers.
- Prefer deleting duplication over adding abstraction.

## Quality surface

Use agent-kit/Webpresso for tests, formatting, linting, and QA when the app is
scaffolded:

- `vp` for package scripts
- `wp` for setup/audits
- `ak_*` structured verification lanes when available

Do not invent parallel local QA workflows when agent-kit already owns the lane.
