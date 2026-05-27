---
type: architecture
title: EdgeMatte Architecture
status: draft
created: 2026-05-27
---

# Architecture

EdgeMatte is a Cloudflare-native image matting pipeline. The first public slice
is intentionally small: one image in, one processed URL out, one capability token
to delete every stored artifact. The internals are platform-shaped so future
async execution, retries, and additional providers can land without rewriting the
user-facing flow.

## Architecture at a glance

```mermaid
flowchart LR
    UI[Browser / SPA] --> API[Cloudflare Worker API]
    API --> JOBS[(R2 job metadata)]
    API --> BLOBS[(R2 image objects)]
    API --> RUNNER[Processing runner]
    RUNNER --> BG[Background removal provider]
    RUNNER --> IMG[Cloudflare Images transform]
    IMG --> BLOBS
    BLOBS --> URL[Public processed image URL]
    URL --> UI
```

The first implementation runs the processing runner inline. Queue mode is a
future execution adapter, not a separate product path.

## Runtime request path

```mermaid
flowchart TD
    START[User selects one image] --> CLIENT_VALIDATE[Client-side size/type preview]
    CLIENT_VALIDATE --> POST["POST /api/jobs<br/>multipart/form-data"]
    POST --> LIMIT[Worker body limit]
    LIMIT --> MAGIC[Magic-byte + MIME validation]
    MAGIC --> JOB_CREATE["Create ImageJob<br/>status=uploading"]
    JOB_CREATE --> STORE_ORIGINAL[(R2 original object)]
    STORE_ORIGINAL --> BG_STATUS["status=removing_background"]
    BG_STATUS --> BG_CALL[Provider remove background<br/>deadline bounded]
    BG_CALL --> FLIP_STATUS["status=flipping"]
    FLIP_STATUS --> FLIP[Cloudflare Images flip=h]
    FLIP --> STORE_PROCESSED[(R2 processed object)]
    STORE_PROCESSED --> READY["status=ready<br/>imageUrl available"]
    READY --> RESPONSE["201 { id, status, imageUrl,<br/>deleteToken, pollUrl }"]

    LIMIT -->|too large| ERR_413[413 file_too_large]
    MAGIC -->|unsupported/spoofed| ERR_415[415 unsupported_media_type]
    BG_CALL -->|timeout/provider error| FAIL_PROVIDER["status=failed<br/>background_provider_failed"]
    FLIP -->|transform error| FAIL_TRANSFORM["status=failed<br/>image_transform_failed"]
    FAIL_PROVIDER --> CLEANUP[Best-effort orphan cleanup]
    FAIL_TRANSFORM --> CLEANUP
```

## Upload sequence

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Browser / SPA
    participant API as Hono Worker
    participant R2 as R2 bucket
    participant BG as Background provider
    participant IMG as Cloudflare Images

    U->>UI: Select image
    UI->>UI: Preview + client validation
    UI->>API: POST /api/jobs
    API->>API: Validate size, MIME, magic bytes
    API->>R2: Put original + job metadata
    API->>BG: Remove background with deadline
    BG-->>API: Cutout image
    API->>IMG: Transform flip=h
    IMG-->>API: Flipped image stream
    API->>R2: Put processed + update job ready
    API-->>UI: imageUrl + deleteToken + pollUrl
    UI->>API: GET /api/jobs/:id
    API-->>UI: safe public job state
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

Only safe status values and coarse error codes are exposed publicly. Provider
payloads, internal stack traces, object keys, and token hashes stay private.

## Storage layout

```mermaid
flowchart TD
    ID["job id<br/>job_..."] --> META["jobs/{id}.json<br/>ImageJob metadata"]
    ID --> ORIGINAL["images/{id}/original<br/>source upload"]
    ID --> PROCESSED["images/{id}/processed<br/>background removed + flipped"]

    META --> SAFE["PublicJobResponse<br/>id, status, imageUrl, timestamps, errorCode"]
    META --> SECRET["Private fields<br/>deleteTokenHash, object keys, provider"]
    ORIGINAL --> CLEANUP[deleteAll]
    PROCESSED --> CLEANUP
    META --> CLEANUP
```

R2 is the only persistence layer in v1. This avoids a database while still making
artifact lifecycle explicit and testable.

## Delete flow

```mermaid
sequenceDiagram
    participant UI as Browser / SPA
    participant API as Hono Worker
    participant R2 as R2 bucket

    UI->>API: DELETE /api/jobs/:id { deleteToken }
    API->>R2: Read jobs/{id}.json
    API->>API: SHA-256 hash(deleteToken)
    alt token valid
        API->>R2: Delete original object
        API->>R2: Delete processed object
        API->>R2: Delete job metadata
        API-->>UI: 204 No Content
    else token invalid
        API-->>UI: 401 invalid_delete_token
    else job missing
        API-->>UI: 404 image_not_found
    end
```

The delete token is a capability. Losing it is unrecoverable by design because
v1 has no user accounts.

## Deployment ownership

```mermaid
flowchart LR
    GH[GitHub repo] --> CI[GitHub Actions]
    CI --> CHECKS[lint + typecheck + tests + build]
    CHECKS --> DRY["wrangler deploy --dry-run"]

    PULUMI[Pulumi] --> R2[(R2 bucket)]
    PULUMI --> LIFE[R2 lifecycle rules]

    WRANGLER[Wrangler] --> WORKER[Cloudflare Worker]
    WRANGLER --> ASSETS[Workers Static Assets]
    WRANGLER --> BINDINGS[Worker bindings + secrets]
    WRANGLER --> ROUTES[workers.dev or custom domain]

    WORKER --> R2
    WORKER --> PROVIDER[Background provider API]
```

Boundary rule: Pulumi owns durable infrastructure. Wrangler owns Worker-scoped
deployment, static assets, routes, bindings, and secrets.

## Optional queue execution

```mermaid
flowchart TD
    POST["POST /api/jobs"] --> CREATE["Create job<br/>status=queued"]
    CREATE --> PUT[(R2 original + metadata)]
    PUT --> ENQUEUE[(Cloudflare Queue)]
    ENQUEUE --> RESPONSE["202 { id, pollUrl, deleteToken }"]

    ENQUEUE --> CONSUMER[Queue consumer]
    CONSUMER --> RUNNER[Processing runner]
    RUNNER --> READY["status=ready"]
    RUNNER --> FAILED["status=failed"]

    POLL["GET /api/jobs/:id"] --> STATUS[(R2 job metadata)]
    STATUS --> UI[Status timeline]
```

Queue mode is valuable only after the inline runner proves the provider and
transform path. It should not block the first live demo.
