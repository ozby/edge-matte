---
type: guide
title: EdgeMatte Architecture
status: draft
created: 2026-05-27
last_updated: 2026-05-29
---

# Architecture

EdgeMatte is a Cloudflare-native image matting pipeline deployed at
`https://edge-matte.ozby.dev`. The v1 shape is deliberately small and stable:
**one Worker, static assets, one R2 bucket, one pure pipeline core**.

The public product flow is: upload one image, remove the background, flip the
result horizontally, host the processed artifact, expose safe job status, and
delete every artifact through a capability token.

## Architecture at a glance

```mermaid
flowchart LR
    DOMAIN[edge-matte.ozby.dev] --> WORKER[Cloudflare Worker]

    subgraph WORKER[Cloudflare Worker + Static Assets]
        ASSETS[Workers Static Assets<br/>SPA shell]
        ROUTES[Hono route adapter<br/>/api/jobs /i/:id /health<br/>/internal/raw/segment-tmp/*]
        CORE[Pure processImageJob core]
        ROUTES --> CORE
        ROUTES --> ASSETS
    end

    CORE --> BGPORT[BackgroundRemovalProvider port]
    CORE --> IMGPORT[ImageTransformer port]
    CORE --> JOBPORT[JobRepository port]
    CORE --> STOREPORT[ImageObjectStore port]

    BGPORT --> CFSEG[CfImageSegmentProvider<br/>cf.image segment via sub-request]
    CFSEG --> ROUTES
    IMGPORT --> CFIMG[Cloudflare Images binding adapter<br/>env.IMAGES flip=h]
    JOBPORT --> R2[(R2 jobs/*.json)]
    STOREPORT --> R2BLOBS[(R2 image objects)]
    CFSEG --> R2BLOBS
    CFIMG --> R2BLOBS
```

The first implementation runs the processing runner inline. Queue mode is a
promotion adapter only; it should land after inline provider behavior proves a
real need for reliable out-of-band execution.

## Runtime request path

```mermaid
flowchart TD
    START[User selects one image] --> CLIENT_VALIDATE[Client-side size/type preview]
    CLIENT_VALIDATE --> POST[POST /api/jobs multipart/form-data]
    POST --> LIMIT[Hono bodyLimit]
    LIMIT --> MAGIC[Magic-byte + MIME validation]
    MAGIC --> JOB_CREATE[Create ImageJob + delete token]
    JOB_CREATE --> STORE_ORIGINAL[(R2 original object)]
    STORE_ORIGINAL --> BG_STATUS[status=removing_background]
    BG_STATUS --> BG_CALL[Provider remove background<br/>deadline bounded]
    BG_CALL --> FLIP_STATUS[status=flipping]
    FLIP_STATUS --> FLIP[Cloudflare Images binding<br/>env.IMAGES flip=h]
    FLIP --> STORE_PROCESSED[(R2 processed object)]
    STORE_PROCESSED --> READY[status=ready imageUrl available]
    READY --> RESPONSE[201 id/status/imageUrl/deleteToken/pollUrl]

    LIMIT -->|too large| ERR_413[413 file_too_large]
    MAGIC -->|unsupported/spoofed| ERR_415[415 unsupported_media_type]
    BG_CALL -->|timeout/provider error| FAIL_PROVIDER[failed background_provider_failed]
    FLIP -->|transform error| FAIL_TRANSFORM[failed image_transform_failed]
    FAIL_PROVIDER --> CLEANUP[Best-effort orphan cleanup]
    FAIL_TRANSFORM --> CLEANUP
```

## Ports and adapters

```mermaid
classDiagram
    class ProcessImageJob {
      +run(command, deps) ImageJob
    }
    class BackgroundRemovalProvider {
      <<interface>>
      +removeBackground(input, signal) Blob
    }
    class ImageTransformer {
      <<interface>>
      +flipHorizontalAsPng(input) Blob
    }
    class JobRepository {
      <<interface>>
      +create(job)
      +update(job)
      +get(id) ImageJob
      +delete(id)
    }
    class ImageObjectStore {
      <<interface>>
      +putOriginal(job, file)
      +putProcessed(job, body, contentType)
      +getProcessed(id) Response
      +deleteAll(job)
    }

    ProcessImageJob --> BackgroundRemovalProvider
    ProcessImageJob --> ImageTransformer
    ProcessImageJob --> JobRepository
    ProcessImageJob --> ImageObjectStore

    BackgroundRemovalProvider <|.. CfImageSegmentProvider
    BackgroundRemovalProvider <|.. MockProvider
    ImageTransformer <|.. CloudflareImagesTransformer
    ImageTransformer <|.. MockTransformer
    JobRepository <|.. R2JobRepository
    ImageObjectStore <|.. R2ImageObjectStore
```

This is the DRY/SOLID boundary: HTTP, provider APIs, image transforms, and R2
never leak into the pure pipeline core.

The image-transform adapter is concrete at the principal level: the horizontal
flip runs through the Cloudflare Images **Workers binding** rather than a vague
remote-URL-only assumption. The port returns a `Blob`; the adapter resolves the
CF Images response to bytes internally:

```ts
const result = await env.IMAGES.input(cutoutStream)
  .transform({ flip: "h" })
  .output({ format: "image/png" });
return (await result.response()).blob();
```

That keeps the brief’s order exact:

1. upload one image
2. remove background through a third-party provider
3. flip the cutout horizontally
4. host the processed artifact at `https://edge-matte.ozby.dev/i/:id`
5. delete original object, processed object, and metadata with the delete token

## Upload sequence

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Browser / SPA
    participant API as Hono Worker
    participant Core as processImageJob
    participant R2 as R2 bucket
    participant BG as Background provider
    participant IMG as Cloudflare Images binding

    U->>UI: Select image
    UI->>UI: Preview + client validation
    UI->>API: POST /api/jobs
    API->>API: bodyLimit + parse multipart
    API->>Core: command + Cloudflare/provider adapters
    Core->>Core: validate type, size, magic bytes
    Core->>R2: Put original + job metadata
    Core->>BG: Remove background with deadline
    BG-->>Core: Cutout image
    Core->>IMG: Transform cutout via env.IMAGES flip=h
    IMG-->>Core: Flipped image stream
    Core->>R2: Put processed + update job ready
    Core-->>API: Public job + delete token
    API-->>UI: imageUrl + deleteToken + pollUrl
    UI->>API: GET /i/:id
    API->>R2: Read processed object
    API-->>UI: Processed image
```

## Job state machine

```mermaid
stateDiagram-v2
    [*] --> validating
    validating --> failed: invalid upload
    validating --> uploading: accepted image
    uploading --> failed: R2 write failed
    uploading --> removing_background: original stored
    removing_background --> failed: provider timeout/error
    removing_background --> flipping: cutout returned
    flipping --> failed: transform failed
    flipping --> ready: processed stored
    ready --> deleted: valid delete token
    failed --> deleted: valid delete token / cleanup
    deleted --> [*]
```

`validating` is the initial in-memory status only. Upload rejections
(size, MIME, magic-byte) throw in `assertSupportedFile` **before** a job is
persisted, so the `validating --> failed` edge is the logical lifecycle, not a
stored `failed` record — no orphan metadata is written for a rejected upload.
A persisted `failed` job is only produced once processing has begun
(`uploading` onward).

Only safe status values and coarse error codes are exposed publicly. Provider
payloads, internal stack traces, object keys, and token hashes stay private.

## Storage layout

```mermaid
flowchart TD
    ID[job id job_...] --> META[jobs/{id}.json<br/>ImageJob metadata]
    ID --> ORIGINAL[images/{id}/original<br/>source upload]
    ID --> PROCESSED[images/{id}/processed<br/>background removed + flipped]
    TMP[segment-tmp/{ts}-{rand}<br/>transient blob for cf.image sub-request<br/>deleted in CfImageSegmentProvider.finally]

    META --> SAFE[PublicJobResponse<br/>id status imageUrl timestamps errorCode]
    META --> SECRET[Private fields<br/>deleteTokenHash object keys]
    ORIGINAL --> CLEANUP[deleteAll]
    PROCESSED --> CLEANUP
    META --> CLEANUP
```

R2 is the only persistence layer in v1. This avoids a database while still making
artifact lifecycle explicit and testable.

## Principal requirement traceability

| task.pdf requirement                       | Architecture contract                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload a single image                      | `POST /api/jobs` accepts exactly one multipart file after client + server validation.                                                               |
| Remove background via third-party service  | `BackgroundRemovalProvider` port with `CfImageSegmentProvider` production adapter (Cloudflare's BiRefNet via the `cf.image segment` CDN transform). |
| Flip horizontally after background removal | `ImageTransformer` port with Cloudflare Images Workers binding adapter using `flip=h`.                                                              |
| Host processed image online at unique URL  | Worker serves `GET /i/:id` on `https://edge-matte.ozby.dev`.                                                                                        |
| Delete uploaded and processed images       | `DELETE /api/jobs/:id` deletes original object, processed object, and job metadata.                                                                 |
| Backend must be TypeScript                 | Worker/core/adapters are TypeScript-only surfaces.                                                                                                  |
| Full stack deployed online                 | Worker + static assets deploy together to `edge-matte.ozby.dev`.                                                                                    |
| Code shared in GitHub repository           | Blueprint/release flow assumes public GitHub review target.                                                                                         |

## Delete flow

```mermaid
sequenceDiagram
    participant UI as Browser / SPA
    participant API as Hono Worker
    participant Core as deleteJob
    participant R2 as R2 bucket

    UI->>API: DELETE /api/jobs/:id { deleteToken }
    API->>Core: id + deleteToken
    Core->>R2: Read jobs/{id}.json
    Core->>Core: SHA-256 hash(deleteToken)
    alt token valid
        Core->>R2: Delete original object
        Core->>R2: Delete processed object
        Core->>R2: Delete job metadata
        Core-->>API: deleted
        API-->>UI: 204 No Content
    else token invalid
        API-->>UI: 401 invalid_delete_token
    else job missing
        API-->>UI: 404 image_not_found
    end
```

The delete token is a capability. Losing it is unrecoverable by design because
v1 has no user accounts.

## Quality and E2E reuse

```mermaid
flowchart TD
    DEV[Developer / CI] --> VP[vite-plus scripts<br/>vp check / vp fmt / vp run test]
    DEV --> WP[agent-kit CLI<br/>wp setup / wp audit]
    DEV --> MCP[agent-kit MCP tools<br/>wp_audit / structured verification lanes]

    VP --> UNIT[Unit + route tests]
    UNIT --> WORKERS[Cloudflare Workers pool tests]
    UNIT --> REACT[React/jsdom tests]

    WP --> E2E[agent-kit E2E host adapter]
    E2E --> MANIFEST[apps/e2e suite manifest]
    MANIFEST --> CONTRACT[upload-delete-contract: HTTP upload→serve→delete + error envelopes]
    MANIFEST --> SMOKE[smoke: /health + SPA shell]
    MANIFEST --> UPLOAD[upload-delete: Playwright browser journey]
    MANIFEST --> PROD[production-smoke: edge-matte.ozby.dev health + shell]
    MANIFEST --> PRODJOURNEY[production-journey: real upload→transform→delete on prod]

    CONTRACT --> PRGATE[CI e2e job — gates every PR, hermetic mock mode]
    SMOKE --> PRGATE
    UPLOAD --> PRGATE
    PROD --> POSTDEPLOY[deploy.production.yml — post-deploy]
    PRODJOURNEY --> POSTDEPLOY

    WP --> DOCS[docs + blueprint lifecycle audits]
```

The three hermetic suites (`upload-delete-contract`, `smoke`, `upload-delete`)
gate every PR via the CI `e2e` job using `wrangler dev` + `E2E_MOCK_PIPELINE:1`
— no secrets, deterministic. `production-journey` runs post-deploy against live
prod and is the only suite that asserts the real `cf.image` transform (output
bytes differ from input); the mock pipeline is a pass-through and cannot.

Quality gates are adopted from the Webpresso/IngestLens pattern rather than
reinvented locally. EdgeMatte should keep only project-specific journey files and
suite registration in `apps/e2e`; execution planning, structured QA lanes,
formatting, test presets, and blueprint audits come from agent-kit/vite-plus.

## Infrastructure deployment ownership

Release/bootstrap companions:
[`docs/release.md`](./release.md) and [`infra/README.md`](../infra/README.md).

```mermaid
flowchart LR
    GH[GitHub repo] --> CI[GitHub Actions]
    CI --> CHECKS[agent-kit/vite-plus gates<br/>format check, lint, typecheck, tests, e2e smoke, build]
    CHECKS --> DRY[wrangler deploy --dry-run]
    DRY --> DEPLOY[Doppler-injected credentials<br/>pnpm wrangler deploy --env production]
    DEPLOY --> URL[edge-matte.ozby.dev]
    URL --> SMOKE[post-deploy smoke<br/>GET /health + GET /]

    PULUMI[Pulumi] --> R2[(R2 bucket)]
    PULUMI --> LIFE[R2 lifecycle rules]

    WRANGLER[Wrangler config] --> WORKER[Cloudflare Worker]
    WRANGLER --> ASSETS[Workers Static Assets]
    WRANGLER --> BINDINGS[Worker bindings + secret names]
    WRANGLER --> ROUTES[custom_domain=true route]

    WORKER --> R2
    WORKER --> PROVIDER[Background provider API]
```

Boundary rule: Pulumi owns durable infrastructure. Wrangler owns Worker-scoped
deployment, static assets, routes, bindings, and secret names. Provider secret
values live in Cloudflare, not GitHub.

## Optional queue execution

```mermaid
flowchart TD
    POST[POST /api/jobs] --> CREATE[Create job status=queued]
    CREATE --> PUT[(R2 original + metadata)]
    PUT --> ENQUEUE[(Cloudflare Queue)]
    ENQUEUE --> RESPONSE[202 id/pollUrl/deleteToken]

    ENQUEUE --> CONSUMER[Queue consumer adapter]
    CONSUMER --> CORE[processImageJob core]
    CORE --> READY[status=ready]
    CORE --> FAILED[status=failed]

    POLL[GET /api/jobs/:id] --> STATUS[(R2 job metadata)]
    STATUS --> UI[Status timeline]
```

Queue mode reuses the same ports and `processImageJob` core. It is valuable only
after inline mode proves that provider latency/reliability requires it.

## Governance

`docs/architecture.md` is the human-readable architecture source of truth.
`docs/architecture.contract.json` is the machine-checkable contract that active
blueprints must link and satisfy.

Architecture-changing blueprints must:

- link `docs/architecture.md`
- link `docs/architecture.contract.json`
- include `## Architecture before`
- include `## Architecture after`

Shared enforcement for EdgeMatte, IngestLens, and sibling repos:

```bash
wp audit architecture-drift --root .
```
