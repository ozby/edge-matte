---
type: research
last_updated: 2026-05-27
title: "Cloudflare-native image transformation service"
subject: "Public OSS image upload, background-removal, flip, hosting, and deletion service"
date: 2026-05-27
confidence: high
verdict: adopt
---

# Cloudflare-native image transformation service

> Build a public, company-neutral OSS reference app for a typed image matting pipeline on Cloudflare Workers, R2, and Cloudflare Images.

## TL;DR

- Recommended repo identity: **EdgeMatte** (`edge-matte`) — a Cloudflare-native reference app for image cutout, transform, hosting, and deletion.
- Use a single Cloudflare Worker deployment with Hono API routes, Workers Static Assets for the UI, R2 for object storage, and Cloudflare Images transformations for the horizontal flip.
- Use a provider interface for background removal. Default to the Cloudflare-native path for the demo; keep an adapter swap point if a future external provider is ever needed.
- Keep the core app small but not toy-like: typed pipeline, capability-based delete token, object lifecycle cleanup, structured errors, rate limits, and a testable adapter boundary.
- Reuse Webpresso/IngestLens patterns, not private application names: generated Cloudflare types, Hono route modularity, exact CORS, Pulumi for long-lived resources, Wrangler for Worker-owned route/binding deployment, and Webpresso runtime helpers where package access is acceptable.

## What This Is

The task is a full-stack TypeScript product that accepts one image, removes its background through a third-party service, flips it horizontally, hosts the processed image online, returns a unique URL, and lets the user delete both uploaded and processed artifacts.

The OSS framing should make this more than an interview exercise:

```text
EdgeMatte
Cloudflare-native image matting pipeline:
upload -> third-party cutout -> edge transform -> R2 hosted result -> capability delete
```

## State of the Art (2026)

### Cloudflare platform fit

- Cloudflare Workers has first-class TypeScript support and recommends generating Worker-specific `Env` types with `wrangler types`, because bindings and runtime APIs depend on compatibility date, flags, and config. Source: [Cloudflare Workers TypeScript docs](https://developers.cloudflare.com/workers/languages/typescript).
- R2 can be used directly from Workers through a bucket binding, including `put`, `get`, and `delete`. R2 writes are documented as strongly consistent once `put()` resolves. Source: [Cloudflare R2 Workers API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
- Cloudflare Images supports a `flip=h` transformation and can be invoked through URL options or Workers. Source: [Cloudflare Images features](https://developers.cloudflare.com/images/optimization/features/).
- The Images binding can transform an uploaded stream and upload the output directly into R2 without requiring a public source URL, but every binding call counts as a transformation and local testing has fidelity caveats. Source: [Cloudflare Images binding docs](https://developers.cloudflare.com/images/optimization/transformations/bindings/).
- Cloudflare Images Free includes 5,000 monthly unique transformations for images stored outside Images, including R2-backed flows. Binding availability and billing should be verified before implementation because tutorial docs still reference an Images Paid prerequisite. Source: [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) and [Cloudflare user-upload tutorial](https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/).

### API and upload handling

- Hono is a good fit for Workers because it uses web-standard Request/Response primitives and has Cloudflare Worker setup docs, env binding examples, and Vitest guidance. Source: [Hono Cloudflare Workers docs](https://hono.dev/docs/getting-started/cloudflare-workers).
- Hono supports multipart uploads via `c.req.parseBody()` and has `bodyLimit` middleware for explicit max-size rejection. Source: [Hono file upload example](https://hono.dev/examples/file-upload).
- For this task, proxying upload through the Worker is acceptable because the challenge asks the backend to process the image immediately. Presigned R2 upload is still a useful future path, but it adds a second client/server round trip and status tracking that is unnecessary for the core demo.

### Background-removal providers

- remove.bg advertises 50 free low-res API calls per month, up to 50 megapixels, and API-key based setup. Source: [remove.bg API page](https://www.remove.bg/tr/i/api).

## Positive Signals

### Product polish with small infrastructure surface

- **Cloudflare Worker + Assets** lets one deployment serve both UI and API. This keeps review setup simple and reduces deployment risk. Credibility: official Hono/Cloudflare docs.
- **R2 object model** fits the task exactly: one original object, one processed object, one metadata object per image ID. Deletion is a bounded multi-key operation.
- **Cloudflare Images flip** avoids a native Node dependency like Sharp, which is not a natural fit for Workers. The official feature set includes horizontal flip.

### Principal-level signal without overbuilding

- A provider interface isolates the third-party background-removal dependency without pretending this is a marketplace of providers.
- Capability-based deletion avoids fake auth while still handling security thoughtfully:

```text
POST /api/images
  -> returns { id, imageUrl, deleteToken }

DELETE /api/images/:id
  body { deleteToken }
  -> verifies hash from R2 metadata
  -> deletes original + processed + metadata keys
```

- Structured error types, deadline-bounded upstream calls, and object cleanup on partial failure show production instincts without expanding scope into queues, auth, or a database.

### Reuse fit

- IngestLens already uses Cloudflare Workers, Hono, R2, Pulumi, Wrangler environments, exact-origin CORS, route grouping, rate limits, and split node/Workers test pools.
- Webpresso's vision emphasizes honest readiness, evidence provenance, rollback, and avoiding magical generated artifacts. This project can embody that by exposing clear processing state, provider caveats, and cleanup behavior.

## Negative Signals

### Cloudflare Images binding ambiguity

- The binding docs say it can transform streams and write outputs into R2, while pricing docs emphasize free transformations for images stored outside Images. A tutorial still says an Images Paid subscription is a prerequisite for binding usage.
- Mitigation: implement an `ImageTransformer` adapter with two options:
  1. preferred: Images binding `.input(stream).transform({ flip: "h" }).output(...)`;
  2. fallback: URL-based `fetch(sourceUrl, { cf: { image: { flip: "h", format: "png" }}})` against a private raw-image route, with loop protection.

### Background-removal quality and free-tier variability

- Provider pricing and quotas change. External APIs may still be useful as future fallback options, but the app should keep adapter swap points isolated.
- Mitigation: one default adapter, one mock adapter for tests, and a README section called "Provider contract" instead of hardcoding provider-specific behavior throughout the pipeline.

### Worker memory and request duration

- Workers have a 128 MB isolate memory limit. Cloudflare recommends streaming bodies and storing large data in R2 rather than holding large in-memory objects. Source: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
- Mitigation: cap uploads at 8 MB for the demo, reject unsupported MIME/magic bytes before provider calls, stream where APIs allow, and store originals before transformation for cleanup/retry.

### Public repo dependency access

- A public GitHub repo should not require private registry credentials just to install. If `@webpresso/webpresso` is used, it must be a public package with documented registry setup.
- Mitigation: prefer copying patterns from Webpresso/IngestLens into local tiny helpers for this repo, and use Webpresso packages only for dev/test helpers if they install cleanly for reviewers.

## Community Sentiment

- Practitioner sentiment around Cloudflare Workers is positive for microservices and static+API apps, but less positive for trying to force entire complex apps into one Worker. That supports this project: it is a focused image microservice with a small UI.
- R2 sentiment is generally strong for low-cost object storage, with caveats around observability and upload-region behavior.
- WASM image processing is possible on Workers, but community and official docs both point to memory/startup caveats. Since Cloudflare Images already supports flip, WASM should stay a fallback, not the primary path.

## Project Alignment

### Vision Fit

Webpresso's north star is an honest idea-to-live-app-to-signal loop. EdgeMatte is aligned because it is:

- a complete running app, not just generated CRUD;
- explicit about provider readiness and deletion guarantees;
- traceable from user action to stored artifacts;
- small enough to ship and verify in hours.

### Tech Stack Fit

Recommended stack:

```text
Public repo: edge-matte

Cloudflare Worker
├── Hono API
│   ├── POST /api/images
│   ├── GET  /i/:id
│   ├── GET  /api/images/:id
│   └── DELETE /api/images/:id
├── Workers Static Assets
│   └── React/Vite or minimal TS UI
├── R2
│   ├── original image object
│   ├── processed image object
│   └── metadata/delete-token hash object
└── Cloudflare Images binding
    └── horizontal flip + output encoding
```

Reuse patterns:

- IngestLens style `wrangler.toml` with `dev`/`prd` envs, custom domains, exact CORS, rate limiter bindings when available.
- IngestLens Pulumi boundary: Pulumi owns long-lived resources like R2 buckets; Wrangler owns Worker deployment, routes, custom domains, and bindings.
- Webpresso runtime-http pattern: deadline-bounded provider calls and explicit failure classification.
- Webpresso runtime-validation pattern: schema-driven request validation with structured field errors.

### Trade-offs for Current Stage

- **Do now:** polished single-image flow, typed pipeline, public URL, delete token, tests, deployment docs.
- **Do not do now:** auth, multi-image batch processing, queue-based async jobs, database metadata, payments, galleries, account dashboards.
- **Why:** the challenge evaluates end-to-end quality, API design, upload safety, provider orchestration, and hosted result management. Auth and queues would hide the core signal behind unnecessary setup.

## Naming and OSS Positioning

Recommended: **EdgeMatte** (`edge-matte`)

Why it works:

- "Edge" signals Cloudflare/edge-native deployment.
- "Matte" is the image-processing term for an alpha mask/cutout.
- It does not mention the target company or sound like an interview exercise.
- It can be meaningfully open sourced as a reference architecture.

Other candidates:

1. `matteflow` — good pipeline feel, less Cloudflare-specific.
2. `cutout-worker` — very clear, but more generic.
3. `alpha-turn` — clever but less searchable.
4. `maskshift` — good transform meaning, slightly abstract.
5. `r2-image-lab` — infra-specific, less product-like.
6. `flipmatte` — describes this exact task, but too narrow for OSS reuse.

OSS description:

> EdgeMatte is a Cloudflare-native TypeScript reference app for image cutout pipelines: upload an image, remove its background through a provider adapter, transform it at the edge, host the result in R2, and delete every artifact through a capability token.

## Recommendation

Adopt the Cloudflare-native plan with EdgeMatte as the public identity.

Confidence: **high** for the architecture and OSS positioning; **medium-high** for the Cloudflare Images binding until binding availability is verified on the deployment account.

Implementation posture:

- Use the Cloudflare-native provider path as the default for the live demo.
- Keep remove.bg documented as an adapter-compatible alternative.
- Use Cloudflare Images binding first. If account capability blocks it, switch to the URL-based Cloudflare Image Transformation fallback before adding WASM.
- Keep the repo public, MIT licensed, and company-neutral.

## Sources

1. [Cloudflare Workers TypeScript](https://developers.cloudflare.com/workers/languages/typescript) — official docs, high credibility, positive.
2. [Cloudflare R2 Workers API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) — official docs, high credibility, positive.
3. [Cloudflare Images features](https://developers.cloudflare.com/images/optimization/features/) — official docs, high credibility, positive.
4. [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/transformations/bindings/) — official docs, high credibility, positive with billing caveat.
5. [Cloudflare user-upload image tutorial](https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/) — official docs, high credibility, mixed because it mentions a paid prerequisite.
6. [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) — official docs, high credibility, positive for free transformation allowance.
7. [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) — official docs, high credibility, cautionary.
8. [Hono Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers) — official framework docs, high credibility, positive.
9. [Hono file upload](https://hono.dev/examples/file-upload) — official framework docs, high credibility, positive.
10. [Pulumi Cloudflare Worker tutorial](https://developers.cloudflare.com/pulumi/tutorial/hello-world/) — official docs, high credibility, positive for IaC.
11. [remove.bg API page](https://www.remove.bg/tr/i/api) — vendor docs, medium-high credibility, positive but vendor-biased.
12. `/Users/ozby/repos/webpresso/monorepo/docs/research/product/VISION.md` — local product vision, high repo-local relevance.
15. `/Users/ozby/repos/ozby/ingest-lens/README.md` and `infra/src/resources/main.ts` — local reuse evidence, high repo-local relevance.
