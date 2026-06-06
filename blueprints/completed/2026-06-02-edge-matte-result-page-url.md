---
type: blueprint
complexity: S
owner: ozby
title: "EdgeMatte: result page URL contract"
status: completed
created: 2026-06-02
last_updated: "2026-06-06"
review_target: public GitHub repository
depends_on:
  - 2026-05-27-edge-matte
progress: "Completed 2026-06-02: result URLs shipped on main, preview-main, and production with local QA, e2e, architecture audits, GitHub Actions, and production deploy evidence."
---

# EdgeMatte: result page URL contract

Build `/r/:id` as the canonical share/result page for `edge-matte.ozby.dev`.
Keep `/i/:id` as the raw processed image, add `/i/:id/original` for persisted
compare-slider input, and replace the browser URL with `/r/:id` when upload
processing completes.

## Architecture governance

Architecture docs:

- [Architecture](../../docs/architecture.md)
- [Architecture Contract](../../docs/architecture.contract.json)

This blueprint reuses the existing agent-kit / vite-plus `wp` and `vp` quality
surface rather than adding bespoke test or deployment workflows.

## Architecture before

```text
POST /api/jobs
  -> returns imageUrl=/i/:id
  -> client stays on /
  -> compare slider only works while blob preview is in memory

GET /i/:id
  -> raw processed image
```

## Architecture after

```text
POST /api/jobs
  -> returns resultUrl=/r/:id
  -> returns imageUrl=/i/:id
  -> returns originalImageUrl=/i/:id/original
  -> client history.replaceState("/r/:id")

GET /r/:id
  -> SPA shell
  -> client fetches /api/jobs/:id
  -> slider uses originalImageUrl + imageUrl

GET /i/:id           -> raw processed PNG, no-store
GET /i/:id/original  -> raw original upload, no-store
```

## Objective

Make the share URL a durable result page instead of a raw image URL while
preserving deletion semantics and the current one-Worker/static-assets topology.

## Tasks

### 1.1 Public result URL contract and original image route

- [x] Add `resultUrl` and `originalImageUrl` to public job metadata.
- [x] Add `ImageObjectStore.getOriginal(id)` and serve `GET /i/:id/original`.
- [x] Set `Cache-Control: no-store` on `/i/:id` and `/i/:id/original`.
- [x] Ensure delete removes both raw routes.

### 1.2 Result page state and upload URL sync

- [x] Add direct `/r/:id` loading and missing-result UI states.
- [x] Replace browser history with `/r/:id` on upload completion.
- [x] Hide delete controls on shared result pages without a delete token.
- [x] Use `resultUrl` for copy/share and `imageUrl` for download.

### 2.1 Browser journey coverage

- [x] Assert upload lands on `/r/:id`.
- [x] Assert refresh of `/r/:id` keeps the compare slider visible.
- [x] Assert processed and original raw image routes return 404 after delete.

### 2.2 Architecture and docs update

- [x] Update `docs/architecture.md`, `docs/architecture.contract.json`, and
      `README.md` to name `/r/:id`, `/i/:id`, and `/i/:id/original`.
- [x] Run `wp audit blueprint-lifecycle` and `wp audit architecture-drift --root .`.

## Edge cases

| Case                             | Expected behavior                                     |
| -------------------------------- | ----------------------------------------------------- |
| `/r/:id` for missing/deleted job | Show explicit missing-result state.                   |
| `/r/:id` without delete token    | Slider visible; delete controls hidden.               |
| Delete after upload session      | Return to `/`; raw image routes return 404.           |
| Refresh after upload             | Fetch metadata and render slider from persisted URLs. |
| Browser cache after delete       | `no-store` prevents stale raw image display.          |

## Verification

- [x] `wp test --package @edge-matte/worker`
- [x] `wp test --package @edge-matte/client`
- [x] `wp e2e --config playwright.config.ts --workers 1`
- [x] `wp qa`
- [x] `wp audit blueprint-lifecycle`
- [x] `wp audit architecture-drift --root .`
- [x] GitHub Actions green on `main`
- [x] Production deploy success to `edge-matte.ozby.dev`

## Completion evidence

- Main commit: `7bd7b7a` (`feat: add result page and deploy lane contract`).
- Production deploy: GitHub Actions `Deploy production` run `26811663121`
  completed successfully on 2026-06-02.
- Preview-main redeploy: commit `24280ea` deployed
  `https://preview-main.edge-matte.ozby.dev` successfully on 2026-06-02.
- Live smoke: `https://preview-main.edge-matte.ozby.dev/health` returned `200`
  after the custom-domain preview deployment.
