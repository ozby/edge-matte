---
type: blueprint
title: "EdgeMatte: end-to-end confidence suite"
status: planned
created: 2026-05-29
last_updated: 2026-05-29
review_target: public GitHub repository
depends_on:
  - 2026-05-27-edge-matte-audit-remediation
  - 2026-05-29-edge-matte-shared-cloudflare-deploy-contract
---

# EdgeMatte: end-to-end confidence suite

Make a green CI mean the product actually works. Today the e2e scaffolding
exists but no PR runs it; only a post-deploy `/health` + shell smoke executes.
This blueprint gates every PR on a hermetic, deterministic upload → remove-bg →
flip → host → delete suite (HTTP contract + smoke + Playwright browser, all in
mock mode, no secrets), and adds a real post-deploy journey that proves the live
`cf.image` transform end to end.

## Product wedge anchor

- **Stage outcome:** A YC take-home reviewer must trust the live demo
  ([Architecture](../../docs/architecture.md) flow) on first contact — the
  upload→matte→flip→host→delete journey is the product.
- **Consuming surface:** the CI `e2e` job in
  [ci.webpresso.yml](../../.github/workflows/ci.webpresso.yml), the journey specs
  under [apps/e2e/journeys](../../apps/e2e/journeys), and the post-deploy
  `production-journey` in
  [deploy.production.yml](../../.github/workflows/deploy.production.yml).
- **New user-visible capability:** every PR shows a green check that proves the
  full journey works, and every deploy proves the real background-removal + flip
  transform on `edge-matte.ozby.dev` before users see it.

Deployment-contract note: this blueprint should eventually consume whatever
shared preview/main/prod lane contract lands via
[`../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md`](../in-progress/2026-05-29-edge-matte-shared-cloudflare-deploy-contract.md).
It owns confidence coverage, not the reusable deploy-policy extraction itself.

## Architecture governance

Architecture docs:

- [Architecture](../../docs/architecture.md)
- [Architecture Contract](../../docs/architecture.contract.json)

## Architecture before

- No PR-gating e2e. CI ([ci.webpresso.yml](../../.github/workflows/ci.webpresso.yml))
  runs `check`/`test`/`deploy-verify` only; the journey suites never execute.
- Only `production-smoke` runs post-deploy
  ([deploy.production.yml](../../.github/workflows/deploy.production.yml)) and it
  checks `/health` + the SPA shell, never an actual upload/transform.
- The browser spec
  [upload-delete.spec.mjs](../../apps/e2e/journeys/upload-delete.spec.mjs) is
  `.mjs` (violates the no-`.mjs` policy) and asserts stale strings/IDs that no
  longer match [ui.ts](../../apps/client/src/ui.ts).
- The contract test
  [upload-delete.contract.test.ts](../../apps/e2e/journeys/upload-delete.contract.test.ts)
  asserts `output.length !== input.length`, which is false in mock mode (a byte
  pass-through), so it only passes by accident.
- Nothing green anywhere asserts that background removal + flip actually
  transform pixels.

## Architecture after

- A new `e2e` CI job gates every PR: builds the client, installs cached chromium,
  and runs `upload-delete-contract` + `smoke` + `upload-delete` against
  `wrangler dev` with `E2E_MOCK_PIPELINE:1` — hermetic, no secrets, deterministic.
- Browser + contract suites are TypeScript
  ([playwright.config.ts](../../apps/e2e/playwright.config.ts),
  [upload-delete.spec.ts](../../apps/e2e/journeys/upload-delete.spec.ts)) and
  assert the real DOM IDs/strings and the full visible journey (pick + drag-drop,
  progress, ready, copy/download links, delete-confirm → deleted → 404) plus a
  client-side error path.
- The contract suite covers every error envelope (413/415/401/404/400), security
  headers, and SPA asset delegation.
- A real `production-journey` runs post-deploy
  ([deploy.production.yml](../../.github/workflows/deploy.production.yml)):
  uploads a real fixture to live prod, asserts a valid transformed PNG (bytes
  differ from input) is served, then deleted (404). This is the only layer that
  asserts the real transform — by design, since mock mode cannot.

## Task pool

#### [test] Task 1: Real image fixture + path-safe reader

**Status:** todo

**Depends:** none

Commit a tiny asymmetric PNG and a lint-clean reader so specs upload a real
image without `../` traversal or hardcoded roots.

**Files:**

- Create: `apps/e2e/fixtures/sample.png` (committed binary, < 1 KB, 8×8, asymmetric)
- Create: [apps/e2e/src/fixtures.ts](../../apps/e2e/src/fixtures.ts)
- Modify: [.gitattributes](../../.gitattributes) (add `apps/e2e/fixtures/*.png binary`)

**Steps (TDD):**

1. Generate `sample.png` once locally (e.g. ImageMagick or a one-off zlib script); commit it.
2. Add `readFixture(name)` using `findRepoRoot(import.meta.dirname)` from [repo-root.ts](../../apps/e2e/src/repo-root.ts) + `join(root, "apps/e2e/fixtures", name)`.
3. Confirm `wp audit absolute-path-policy --root .` stays green (no hardcoded relative root).

**Acceptance:**

- [ ] `sample.png` is a valid PNG (magic bytes + IHDR/IDAT/IEND), passes the worker magic-byte check.
- [ ] `readFixture` resolves with no `../` and no absolute-path-policy violation.

#### [test] Task 2: Convert browser e2e to TypeScript and rewrite the journey

**Status:** todo

**Depends:** Task 1

Replace the stale `.mjs` browser spec with a TS spec covering the full visible flow.

**Files:**

- Create: [apps/e2e/playwright.config.ts](../../apps/e2e/playwright.config.ts) (delete `playwright.config.mjs`)
- Create: [apps/e2e/journeys/upload-delete.spec.ts](../../apps/e2e/journeys/upload-delete.spec.ts) (delete `upload-delete.spec.mjs`)
- Modify: [apps/e2e/tsconfig.json](../../apps/e2e/tsconfig.json) (`lib` includes `DOM`; include the new files)

**Steps (TDD):**

1. Port the config to typed `defineConfig`, `testMatch: ["**/*.spec.ts"]`, keep webServer/retries/trace.
2. Write tests: pick-file happy path (preview → submit → ready → working hosted URL via `request.get` 200 → copy `Copied!` → download attr → delete-confirm → deleted → 404), drag-drop entry, and a client-side unsupported-type error showing `#error`.
3. Use real IDs/strings from [ui.ts](../../apps/client/src/ui.ts); explicit matchers only (no weak assertions).

**Acceptance:**

- [ ] `vp run e2e -- --suite upload-delete` is green locally in mock mode.
- [ ] No `.mjs` files remain under `apps/e2e/`.

#### [test] Task 3: Expand the HTTP contract suite

**Status:** todo

**Depends:** Task 1

Cover the full contract and fix the byte-length assertion.

**Files:**

- Modify: [apps/e2e/journeys/upload-delete.contract.test.ts](../../apps/e2e/journeys/upload-delete.contract.test.ts)

**Steps (TDD):**

1. Upload the real fixture; replace `length !==` with valid-PNG + `image/*` + non-empty assertions.
2. Add 413/415/401/404/400 envelope cases, security-header assertions, and `GET /` SPA-delegation + CSP assertions.
3. Run via the existing `getE2EBaseUrlOrThrow` harness — no new infra.

**Acceptance:**

- [ ] `vp run e2e -- --suite upload-delete-contract` is green; every error code asserted.

#### [ci] Task 4: PR-gating `e2e` job

**Status:** todo

**Depends:** Task 2, Task 3

Add a hermetic, secret-free `e2e` job that gates every PR.

**Files:**

- Modify: [ci.webpresso.yml](../../.github/workflows/ci.webpresso.yml)
- Modify: [package.json](../../package.json) (optional `act:ci` script for the `e2e` job)
- Modify: [.gitignore](../../.gitignore) (`apps/e2e/playwright-report/`, `apps/e2e/test-results/`, `apps/e2e/.client-build-lock/`)

**Steps (TDD):**

1. Add job: install deps, cache `~/.cache/ms-playwright`, `playwright install --with-deps chromium`, build client.
2. Run explicit suites `upload-delete-contract`, `smoke`, `upload-delete` (never the bare default — `CI` selects production otherwise).
3. Upload Playwright artifacts on failure; reference no `secrets.*`.

**Acceptance:**

- [ ] `act -W .github/workflows/ci.webpresso.yml -j e2e` passes with no Doppler token present.
- [ ] Job is a required check on `main`.

#### [ci] Task 5: Real post-deploy `production-journey`

**Status:** todo

**Depends:** Task 1

Prove the real `cf.image` transform end to end after each deploy.

**Files:**

- Create: [apps/e2e/journeys/production-journey.smoke.test.ts](../../apps/e2e/journeys/production-journey.smoke.test.ts)
- Modify: [apps/e2e/src/e2e-suite-manifest.ts](../../apps/e2e/src/e2e-suite-manifest.ts)
- Modify: [apps/e2e/src/e2e-suite-manifest.test.ts](../../apps/e2e/src/e2e-suite-manifest.test.ts)
- Modify: [deploy.production.yml](../../.github/workflows/deploy.production.yml)

**Steps (TDD):**

1. Register a `production-journey` suite (gated by `shouldRunProductionSmoke`), base URL via `getProductionBaseUrl` from [env.ts](../../apps/e2e/src/journeys/env.ts).
2. Write a real POST → ready → `GET /i/:id` (valid PNG, bytes differ from input) → DELETE → 404 against live prod.
3. Add `E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey` after the existing post-deploy smoke step.

**Acceptance:**

- [ ] Suite asserts the served image differs from the uploaded fixture (real transform).
- [ ] Deploy job stays green; the real artifact is created then deleted.

#### [docs] Task 6: Refresh docs to match

**Status:** todo

**Depends:** Task 4, Task 5

**Files:**

- Modify: [README.md](../../README.md)
- Modify: [docs/architecture.md](../../docs/architecture.md)

**Steps (TDD):**

1. Document the suites, the PR `e2e` gate, and the post-deploy real journey.
2. Confirm `wp audit docs-frontmatter` stays green.

**Acceptance:**

- [ ] README test section reflects the new suites and CI gate.

## Risks

- Playwright cold start / headless deps in CI — mitigated by caching
  `~/.cache/ms-playwright` and `--with-deps chromium`; `retries: 1` in CI.
- `wrangler dev` cold start / port conflicts — health-gated startup
  ([global-setup.ts](../../apps/e2e/global-setup.ts)) and per-`port-pid` persist dirs.
- Mock pass-through cannot prove the transform — covered only by the real
  `production-journey` (Task 5); the hermetic suite asserts plumbing/contract.
- Stale manifest literals (`.mjs`/config path) — update
  [e2e-suite-manifest.test.ts](../../apps/e2e/src/e2e-suite-manifest.test.ts) in lockstep.
- Missing `DOM` lib in the e2e tsconfig — would red the `check` job on
  `page.evaluate` browser globals.

## Verification commands

```bash
vp exec --filter @edge-matte/e2e -- playwright install --with-deps chromium
vp run e2e -- --suite upload-delete-contract
vp run e2e -- --suite smoke
vp run e2e -- --suite upload-delete
E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey
vp run typecheck && vp run lint && vp run format:check && wp audit absolute-path-policy --root .
wp audit blueprint-lifecycle --legacy-omx && vp run audit:blueprint-links
```
