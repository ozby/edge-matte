---
type: blueprint
title: "EdgeMatte: result compare slider and Ozby network footer"
status: in-progress
complexity: S
created: "2026-05-31"
last_updated: "2026-05-31"
progress: "67% (2 of 3 tasks completed)"
tags:
  - ui
  - product
  - branding
  - edge-matte
---

# EdgeMatte: result compare slider and Ozby network footer

## Architecture governance

Architecture docs:

- [`docs/architecture.md`](../../docs/architecture.md)
- [`docs/architecture.contract.json`](../../docs/architecture.contract.json)

## Objective

Make the result/details experience more legible by showing the original upload
beside the transformed image through an in-page compare slider, and add subtle
sitewide Ozby network attribution plus GitHub/LinkedIn links in the footer.

## Architecture before

The SPA result surface swaps the original preview image for the transformed
hosted image when a job becomes ready. The footer is a single line of runtime
copy with no site-network attribution or social links.

## Architecture after

The SPA keeps the original preview blob and the transformed hosted image visible
together in the ready/confirm-delete states through a compare slider. The
existing footer becomes a compact Ozby network utility bar with links to
`ozby.dev`, GitHub, and LinkedIn. No worker/API/storage topology changes.

## Gap addressed

Without side-by-side comparison, the user loses visual access to the original
image at the exact moment they need to judge transform quality. Without the
footer update, the site lacks the requested Ozby network attribution and social
presence.

## Write scope

- `apps/client/src/ui.ts`
- `apps/client/src/styles.css`
- `apps/client/test/ui.test.ts`
- `apps/client/test/app.test.ts`
- `blueprints/README.md`

## Cross-plan references

| Type     | Blueprint                                    | Relationship                                                                                                     |
| -------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Adjacent | `2026-05-29-edge-matte-e2e-confidence-suite` | UI assertions may later expand browser coverage for the new compare-ready states                                 |
| Adjacent | `2026-05-28-edge-matte-security-hardening`   | No new public config or secret surface; footer/client work must stay within the existing client/runtime contract |

## Tasks

#### [ui] Task 1.1: Replace ready-state image swap with a compare slider

**Status:** done

**Depends:** None

Use the existing `previewUrl` and `job.imageUrl` sources to render a before/after
compare module in the ready and confirm-delete phases, while leaving
preview/uploading/processing as original-only.

**Files:**

- Modify: `apps/client/src/ui.ts`
- Modify: `apps/client/src/styles.css`

**Steps (TDD):**

1. Add failing ready/confirm-delete UI expectations for original + transformed rendering.
2. Run targeted client UI tests — verify FAIL.
3. Implement the compare module and slider interaction with no API changes.
4. Run targeted client UI tests — verify PASS.

**Acceptance:**

- [x] Ready state shows original + transformed images together.
- [x] Confirm-delete preserves the compare context.
- [x] Processing still shows the original preview only.

#### [ui] Task 1.2: Add a subtle Ozby network footer bar

**Status:** done

**Depends:** Task 1.1

Extend the existing footer into a compact utility bar linking to `ozby.dev`,
GitHub, and LinkedIn without overpowering the image workflow.

**Files:**

- Modify: `apps/client/src/ui.ts`
- Modify: `apps/client/src/styles.css`

**Steps (TDD):**

1. Add failing footer assertions for Ozby network text and outbound links.
2. Run targeted client UI tests — verify FAIL.
3. Implement the footer bar and responsive styling.
4. Run targeted client UI tests — verify PASS.

**Acceptance:**

- [x] Footer shows Ozby network attribution.
- [x] Footer includes `https://ozby.dev`, `https://github.com/ozby`, and `http://linkedin.com/in/ozberk-ercin/`.
- [x] Footer stays compact and responsive.

#### [qa] Task 1.3: Re-run narrow client verification on the changed surface

**Status:** blocked

**Depends:** Task 1.1, Task 1.2

Capture the client-local verification evidence and note the current workspace
typecheck/lint limitation caused by the checked-out agent-kit package surface in
this branch.

**Blocked:** `apps/client` targeted tests pass locally, but client package `wp typecheck` / type-aware lint currently hit an existing workspace dependency-resolution problem (`@webpresso/agent-kit/tsconfig/base.json` not found in the current install surface), which is outside this feature’s owning UI boundary.

**Files:**

- Modify: `apps/client/test/ui.test.ts`
- Modify: `apps/client/test/app.test.ts`

**Steps (TDD):**

1. Run `vitest` on `apps/client/test/ui.test.ts` and `apps/client/test/app.test.ts` — verify PASS.
2. Attempt client-local typecheck/lint surfaces.
3. Record the existing external blocker instead of papering over it in UI code.

**Acceptance:**

- [x] Targeted UI/app tests pass.
- [ ] Client-local typecheck/lint pass, or the external blocker is explicitly recorded.

## Verification

```bash
cd apps/client
./node_modules/.bin/vitest run test/ui.test.ts test/app.test.ts
```

Observed on 2026-05-31:

- targeted client tests: PASS
- client-local `wp typecheck` / type-aware lint: blocked by existing workspace
  dependency-resolution issue outside this UI feature boundary
