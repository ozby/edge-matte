---
type: vision
last_updated: 2026-05-27
---

# EdgeMatte Vision

EdgeMatte is a public, Cloudflare-native reference app for image matting: upload one image, remove background through a provider adapter, apply an edge transform, host in R2, and delete artifacts safely.

## The problem

Small teams often need image-processing flows but end up with ad hoc scripts that are hard to deploy, hard to reason about, and unsafe around credentials/artifact lifecycle. Interview-style demos usually prove only a single transform, not a production-shaped flow with storage, status, cleanup, and deployment discipline. EdgeMatte exists to show a thin but real end-to-end pipeline that is understandable, testable, and deployable at the edge.

## North star

> **From upload to clean hosted result at the edge — with honest lifecycle boundaries.**

Success means a reviewer or maintainer can clone the repo, understand the architecture quickly, run a full user flow, and see clear boundaries between core processing logic and side-effect adapters (provider, transformer, storage, deployment). The project should feel product-polished while staying intentionally small.

## Boundaries

**In scope**

- Cloudflare Worker + TypeScript reference implementation.
- Single-image processing vertical slice (upload → remove background → transform → host).
- R2-backed artifact lifecycle, including deletion path.
- Contract-first docs and blueprint governance for architecture decisions.
- Secret-provider-first workflow (no secret files written to disk).

**Out of scope**

- Multi-tenant auth/permissions platform.
- Batch orchestration and queue-heavy pipeline framework (unless demanded by a proven use case).
- Model/provider experimentation lab.
- General-purpose media platform scope creep beyond the thin reference slice.

## Design principles

- **Thin vertical slice first.** Ship complete user value before adding platform breadth.
- **One pure pipeline core.** Keep processing logic deterministic and isolate side effects behind adapters.
- **Contract over vibes.** Keep architecture, blueprints, and docs aligned and drift-checked.
- **No secrets on disk.** Secrets must come from runtime secret providers, not `.env`/`.dev.vars`.
- **Polish with restraint.** Prefer clarity and maintainability over “clever” complexity.
