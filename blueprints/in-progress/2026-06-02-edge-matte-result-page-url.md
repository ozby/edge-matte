---
type: blueprint
title: "EdgeMatte: result page URL contract"
status: in-progress
created: 2026-06-02
last_updated: 2026-06-02
review_target: public GitHub repository
depends_on:
  - 2026-05-27-edge-matte
progress: "Implementation landed locally; final QA, e2e, and production deploy evidence pending"
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

- Add `resultUrl` and `originalImageUrl` to public job metadata.
- Add `ImageObjectStore.getOriginal(id)` and serve `GET /i/:id/original`.
- Set `Cache-Control: no-store` on `/i/:id` and `/i/:id/original`.
- Ensure delete removes both raw routes.

### 1.2 Result page state and upload URL sync

- Add direct `/r/:id` loading and missing-result UI states.
- Replace browser history with `/r/:id` on upload completion.
- Hide delete controls on shared result pages without a delete token.
- Use `resultUrl` for copy/share and `imageUrl` for download.

### 2.1 Browser journey coverage

- Assert upload lands on `/r/:id`.
- Assert refresh of `/r/:id` keeps the compare slider visible.
- Assert processed and original raw image routes return 404 after delete.

### 2.2 Architecture and docs update

- Update `docs/architecture.md`, `docs/architecture.contract.json`, and
  `README.md` to name `/r/:id`, `/i/:id`, and `/i/:id/original`.
- Run `wp audit blueprint-lifecycle` and `wp audit architecture-drift --root .`.

## Edge cases

| Case                             | Expected behavior                                     |
| -------------------------------- | ----------------------------------------------------- |
| `/r/:id` for missing/deleted job | Show explicit missing-result state.                   |
| `/r/:id` without delete token    | Slider visible; delete controls hidden.               |
| Delete after upload session      | Return to `/`; raw image routes return 404.           |
| Refresh after upload             | Fetch metadata and render slider from persisted URLs. |
| Browser cache after delete       | `no-store` prevents stale raw image display.          |

## Verification

- `wp test --package @edge-matte/worker`
- `wp test --package @edge-matte/client`
- `wp e2e --config playwright.config.ts --workers 1`
- `wp qa`
- `wp audit blueprint-lifecycle`
- `wp audit architecture-drift --root .`
- GitHub Actions green on `main`
- Production deploy success to `edge-matte.ozby.dev`
