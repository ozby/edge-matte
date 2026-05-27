---
type: blueprint
title: "EdgeMatte: Cloudflare-native image matting platform"
status: planned
created: 2026-05-27
review_target: public GitHub repository
timebox: "6 hours"
---

# EdgeMatte: Cloudflare-native image matting platform

## Office-Hours Decision

`/office-hours` selected the **Full Edge Pipeline Platform** direction on 2026-05-27.

Guardrail: the first shipped version is a thin platform slice, not a sprawling product. It processes one image end-to-end, but internally it has:

- job/status metadata,
- explicit processing phases,
- artifact lifecycle,
- provider/transform/store seams,
- capability-token deletion.

Queue mode is optional and only lands if the inline processing path is already green and deployed.

Design doc: `/Users/ozby/.gstack/projects/ozby-repos/ozby-main-design-20260527-114304.md`

## Objective

Ship a public, company-neutral OSS app that lets a user upload one image, creates a processing job, removes the background through a third-party provider, flips the result horizontally, hosts the processed image online, exposes job status, and lets the user delete every stored artifact.

Recommended public identity:

- **Project name:** EdgeMatte
- **Repository:** `edge-matte`
- **Package/app slug:** `edge-matte`
- **One-line OSS positioning:** Cloudflare-native TypeScript reference app for image cutout pipelines: upload, background removal, edge transform, R2 hosting, job status, and capability-based deletion.

Other viable names:

1. `matteflow` — good pipeline feel, less Cloudflare-specific.
2. `cutout-worker` — clear, but less distinctive.
3. `maskshift` — strong transform language, slightly abstract.
4. `alpha-turn` — image alpha channel + flip, clever but less searchable.
5. `flipmatte` — exact to this task, but too narrow for OSS reuse.

Decision: use **EdgeMatte** unless the repo name is unavailable.

## Success Criteria

- A live URL accepts a single image upload from a polished UI.
- Upload flow shows validation, job timeline, progress/loading, success, and recoverable error states.
- Backend is TypeScript.
- Background removal goes through a third-party provider using an API key stored as a secret.
- The processed result is horizontally flipped after background removal.
- The result is hosted online at a unique URL.
- Job status can be read without exposing secrets or provider internals.
- A delete action removes original, processed, and metadata artifacts from storage.
- GitHub repo is public and company-neutral.
- README gives reviewer setup, architecture, live demo URL, provider setup, and verification commands.
- CI runs lint, typecheck, tests, and deploy dry-run.

## What Already Exists

| Existing asset | Reuse decision |
|---|---|
| Private task brief | Source of product requirements only. Do not commit extracted company-specific language. |
| Webpresso vision | Reuse product discipline: honest readiness, evidence provenance, rollback/recovery paths. |
| IngestLens repo structure | Reuse public README/reviewer path style and Cloudflare app organization. |
| IngestLens Worker patterns | Reuse Hono app, exact CORS, route grouping, rate limit posture, generated Worker types. |
| IngestLens infra boundary | Reuse Pulumi-for-durable-resources and Wrangler-for-Worker-deployment boundary. |
| Webpresso runtime patterns | Reuse deadline-bounded fetch, structured validation, and explicit error taxonomy where package install is public-friendly; otherwise mirror tiny local helpers. |

## NOT in Scope

- User accounts or auth: delete-token capability is enough for a one-image public demo.
- Multi-image batch uploads: the first slice accepts one image.
- Provider marketplace: implement one production provider and one mock provider for tests.
- Database metadata: R2 metadata JSON is enough for job status, object keys, provider, timestamps, and delete-token hash.
- Batch processing dashboard: future work after single-job flow is green.
- WASM image processing: fallback only if Cloudflare Images binding and URL transformations are blocked.
- Billing/credit tracking: document provider quotas, do not build account-level credit management.

Conditional scope:

- Cloudflare Queue execution may be added if the inline processing path is deployed and tested first. Otherwise the v1 still has job/status APIs with inline processing.

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Browser                                                              │
│ ┌──────────────────────────────┐                                     │
│ │ Upload UI                    │                                     │
│ │ - file picker/dropzone       │                                     │
│ │ - validation + preview       │                                     │
│ │ - job status timeline        │                                     │
│ │ - result URL + delete button │                                     │
│ └──────────────┬───────────────┘                                     │
└────────────────┼─────────────────────────────────────────────────────┘
                 │ multipart/form-data
                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Cloudflare Worker                                                    │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Hono API                                                         │ │
│ │ POST /api/jobs                                                   │ │
│ │   1 validate file size/type/magic bytes                          │ │
│ │   2 create job + delete token                                    │ │
│ │   3 store original in R2                                         │ │
│ │   4 run processing inline for v1                                 │ │
│ │   5 update job status at each phase                              │ │
│ │   6 return imageUrl + deleteToken + pollUrl                      │ │
│ │                                                                  │ │
│ │ GET /api/jobs/:id      -> safe public job status                 │ │
│ │ GET /i/:id             -> stream processed image                 │ │
│ │ DELETE /api/jobs/:id   -> verify token hash, delete all objects  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│             │                │                   │                    │
│             ▼                ▼                   ▼                    │
│         JobStore         ImageStore        ProcessingRunner           │
│         R2 meta          R2 blobs          provider + transform        │
│                                              │             │          │
│                                              ▼             ▼          │
│                                  BackgroundRemovalProvider  Images     │
│                                  - Photoroom default        flip=h     │
│                                  - remove.bg seam                      │
└──────────────────────────────────────────────────────────────────────┘
```

Optional queue mode, only after inline mode works:

```text
POST /api/jobs
  -> create job(status=queued)
  -> store original
  -> enqueue { jobId }
  -> return 202 + pollUrl

Queue consumer
  -> ProcessingRunner.run(jobId)
  -> update status -> ready | failed
```

## Domain Model

```ts
type ImageJob = {
  id: string
  originalKey: string
  processedKey: string
  metadataKey: string
  originalContentType: "image/png" | "image/jpeg" | "image/webp"
  processedContentType: "image/png" | "image/webp"
  provider: "photoroom"
  createdAt: string
  updatedAt: string
  deleteTokenHash: string
  status:
    | "queued"
    | "validating"
    | "uploading"
    | "removing_background"
    | "flipping"
    | "ready"
    | "deleted"
    | "failed"
  errorCode?: string
}
```

No database is needed. `jobs/{id}.json` in R2 is the job source of truth. Public reads only return safe fields:

```ts
type PublicJobResponse = {
  id: string
  status: ImageJob["status"]
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  errorCode?: string
}
```

## Provider and Platform Interfaces

Keep DRY by putting orchestration in one runner and all external systems behind tiny adapters:

```ts
interface BackgroundRemovalProvider {
  removeBackground(input: File, signal: AbortSignal): Promise<Blob>
}

interface ImageTransformer {
  flipHorizontal(input: ReadableStream, output: "image/png" | "image/webp"): Promise<Response>
}

interface JobStore {
  create(job: ImageJob): Promise<void>
  update(job: ImageJob): Promise<void>
  get(id: string): Promise<ImageJob | null>
  delete(id: string): Promise<void>
}

interface ImageStore {
  putOriginal(job: ImageJob, file: File): Promise<void>
  putProcessed(job: ImageJob, body: ReadableStream | ArrayBuffer, contentType: string): Promise<void>
  getProcessed(id: string): Promise<Response | null>
  deleteAll(job: ImageJob): Promise<void>
}

interface ProcessingRunner {
  run(job: ImageJob, file: File, signal: AbortSignal): Promise<ImageJob>
}
```

The runner is the only place that knows the sequence:

```text
validate -> create job -> store original -> status removing_background
  -> provider cutout -> status flipping -> edge transform
  -> store processed -> status ready
  └──────── cleanup + status failed on unrecoverable failure ───────┘
```

## API Contract

### `POST /api/jobs`

Request:

- `multipart/form-data`
- `image`: exactly one file

Validation:

- max size: 8 MiB
- supported MIME: `image/png`, `image/jpeg`, `image/webp`
- verify magic bytes, not MIME alone
- reject multiple files

Inline-mode response `201`:

```json
{
  "id": "job_...",
  "status": "ready",
  "imageUrl": "https://<host>/i/job_...",
  "deleteToken": "del_...",
  "pollUrl": "https://<host>/api/jobs/job_..."
}
```

Optional queue-mode response `202`:

```json
{
  "id": "job_...",
  "status": "queued",
  "imageUrl": null,
  "deleteToken": "del_...",
  "pollUrl": "https://<host>/api/jobs/job_..."
}
```

Errors:

- `400 invalid_upload`
- `413 file_too_large`
- `415 unsupported_media_type`
- `502 background_provider_failed`
- `502 image_transform_failed`
- `500 storage_failed`

### `GET /api/jobs/:id`

Returns public job status:

```json
{
  "id": "job_...",
  "status": "removing_background",
  "imageUrl": null,
  "createdAt": "2026-05-27T00:00:00.000Z",
  "updatedAt": "2026-05-27T00:00:01.000Z"
}
```

### `GET /i/:id`

Streams the processed image from R2 with:

- `Content-Type`
- `Cache-Control: public, max-age=31536000, immutable`
- `ETag` when available

Returns `404` until ready and after deletion.

### `DELETE /api/jobs/:id`

Request:

```json
{ "deleteToken": "del_..." }
```

Behavior:

- hash token with Web Crypto SHA-256;
- compare to `job.deleteTokenHash`;
- delete original, processed, and job metadata keys;
- return `204`.

Errors:

- `401 invalid_delete_token`
- `404 image_not_found`
- `500 delete_failed`

## Security and Privacy

- API keys live in Wrangler secrets, not repo files.
- Public repo includes `.dev.vars.example`, never `.dev.vars`.
- Delete token is shown once and never stored in plaintext.
- Metadata never exposes provider response details or secrets.
- Exact CORS per environment if API and UI are on separate origins; same-origin is preferred.
- Upload size limit prevents accidental memory exhaustion.
- Log request IDs and failure classes, not image bytes or provider secrets.

## UX Requirements

```text
Initial
  └── Upload card: supported formats + size limit visible

File selected
  ├── client-side preview
  ├── "Remove background + flip" button
  └── validation errors before upload

Processing
  ├── disabled form
  ├── status timeline
  │   ├── validating
  │   ├── uploading
  │   ├── removing background
  │   └── flipping
  └── clear "this can take a few seconds" state

Success
  ├── processed image preview
  ├── copyable image URL
  ├── download link
  └── delete button with confirmation

Delete success
  ├── result disabled
  └── "image deleted" confirmation

Error
  ├── specific recoverable message
  ├── failed phase visible
  └── retry affordance
```

## Implementation Tasks

### Phase 1 — Public repo shell and docs

- [ ] Create `README.md`, `LICENSE`, `.gitignore`, `package.json`, `tsconfig.json`, `wrangler.toml`, and CI workflow.
- [ ] Document live URL placeholder, setup, secrets, architecture, trade-offs, and verification commands.
- [ ] Add `.dev.vars.example` with `BACKGROUND_PROVIDER=photoroom` and `PHOTOROOM_API_KEY=...`.

### Phase 2 — Cloudflare Worker API

- [ ] Build Hono routes for job upload, job status read, image read, and delete.
- [ ] Add upload validation with size, MIME, and magic-byte checks.
- [ ] Add typed response/error helpers.
- [ ] Generate Worker types with `wrangler types`.

### Phase 3 — Core pipeline and adapters

- [ ] Implement `ImageJob` key derivation, status transitions, and delete-token hashing.
- [ ] Implement R2-backed `JobStore`.
- [ ] Implement R2-backed `ImageStore`.
- [ ] Implement `ProcessingRunner.run()` orchestration.
- [ ] Implement `PhotoroomBackgroundRemovalProvider`.
- [ ] Implement mock provider for tests.
- [ ] Implement `CloudflareImagesTransformer`.
- [ ] Ensure partial failures update status and delete orphaned image objects where safe.
- [ ] Add optional queue-mode adapter only after inline processing is green.

### Phase 4 — UI

- [ ] Build polished single-page upload UI.
- [ ] Add client-side validation, preview, status timeline, result preview, copy URL, download, delete confirmation, and error recovery.
- [ ] Keep the UI company-neutral and OSS-oriented.

### Phase 5 — Infra and deployment

- [ ] Add `infra/Pulumi.yaml` and R2 bucket resource.
- [ ] Keep Worker routes/bindings in `wrangler.toml`.
- [ ] Add R2 lifecycle cleanup for stale failed/intermediate prefixes if supported in account.
- [ ] Add deploy instructions for Cloudflare secrets and custom domain.

### Phase 6 — Verification

- [ ] Unit test validation, token hashing, key derivation, status transitions, and pipeline cleanup.
- [ ] Route test upload success/failure with mocked provider/store.
- [ ] Workers-pool test for R2 binding behavior where practical.
- [ ] Manual smoke on deployed URL: upload -> status ready -> URL loads -> delete -> URL 404.

## Testing Plan

```text
CODE PATHS                                             USER FLOWS
[+] POST /api/jobs                                     [+] Upload happy path
  ├── valid PNG/JPEG/WebP                                ├── preview before submit
  ├── [GAP] missing file                                 ├── status timeline during provider call
  ├── [GAP] multiple files                               ├── result preview after processing
  ├── [GAP] unsupported MIME                             └── copy/download URL
  ├── [GAP] MIME spoof / bad magic bytes
  ├── [GAP] file > 8 MiB                               [+] Status flow
  ├── provider success                                   ├── queued/processing/ready states
  ├── [GAP] provider timeout/failure                     ├── failed state with safe error
  ├── transform success                                  └── deleted state disappears
  ├── [GAP] transform failure
  └── [GAP] cleanup on partial failure                 [+] Delete flow
                                                           ├── confirmation before delete
[+] GET /api/jobs/:id                                    ├── success clears UI state
  ├── job exists/status public                           └── [GAP] second delete shows gone
  ├── [GAP] failed job redacts internals
  └── [GAP] deleted job returns 404                    [+] Error states
                                                           ├── validation error
[+] GET /i/:id                                            ├── provider unavailable
  ├── processed exists                                    ├── transform unavailable
  └── [GAP] deleted/missing image                         └── network retry

[+] DELETE /api/jobs/:id
  ├── valid token deletes all keys
  ├── [GAP] invalid token returns 401
  ├── [GAP] missing record returns 404
  └── [GAP] partial delete failure reports 500
```

Required tests:

- `src/domain/image-job.test.ts`
- `src/validation/upload.test.ts`
- `src/pipeline/processing-runner.test.ts`
- `src/routes/jobs.test.ts`
- `src/platform/r2-job-store.workers.test.ts` if Workers pool can cover R2 cheaply
- one Playwright or Vitest browser interaction smoke for the UI if time remains

## Verification Commands

```bash
pnpm install
pnpm lint
pnpm check-types
pnpm test
pnpm build
pnpm exec wrangler deploy --dry-run
```

Manual deployed smoke:

```text
1. Open live URL.
2. Upload PNG/JPEG/WebP under 8 MiB.
3. Confirm job status reaches ready.
4. Confirm processed image has transparent background and horizontal flip.
5. Open returned image URL in a new tab.
6. Delete from UI.
7. Reload image URL and confirm 404.
```

## 6-Hour Execution Plan

| Time | Work |
|---|---|
| 0:00-0:30 | Scaffold repo, configs, README skeleton, Cloudflare bindings. |
| 0:30-1:30 | Job model, upload validation, R2 job/image stores, token hashing. |
| 1:30-2:30 | Provider adapter, transform adapter, processing runner, status transitions. |
| 2:30-3:30 | Hono job/image/delete routes and typed errors. |
| 3:30-4:30 | Polished UI with status timeline and result/delete flows. |
| 4:30-5:15 | Unit/route tests and deploy dry-run. |
| 5:15-5:45 | Live deployment and smoke test. |
| 5:45-6:00 | README final pass, architecture diagram, known caveats. |

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Full-platform scope blows the timebox | Ship inline runner first; queue mode is conditional. |
| Cloudflare Images binding unavailable | Switch to URL-based `cf.image` flip with private raw route and loop guard. |
| Provider quota/API friction | Keep adapter boundary; Photoroom default, remove.bg documented fallback. |
| Worker memory pressure | 8 MiB cap, streaming where possible, no batch uploads. |
| Public repo install friction from private packages | Avoid requiring Webpresso packages unless public install path is verified. |
| Partial storage after failure | Runner updates failed status and deletes orphaned image objects where safe. |
| Delete token lost by user | Document that token is shown once; no auth means no recovery. Acceptable for demo. |

## Distribution

- Public GitHub repo: `edge-matte`.
- License: MIT.
- Live deployment: Cloudflare custom domain or `workers.dev` URL.
- CI: GitHub Actions with `pnpm install`, lint, typecheck, tests, build, and `wrangler deploy --dry-run`.
- Deploy: manual `wrangler deploy --env prd` after setting Cloudflare secrets.

## Review Notes

- The plan intentionally spends complexity on visible job lifecycle and reliable artifact cleanup.
- The provider/transform/store/job interfaces are the DRY seams. Do not add more abstractions unless implementation shows duplication.
- The README should explicitly call out what is production-minded vs demo-scoped so the project looks honest, not overclaimed.
