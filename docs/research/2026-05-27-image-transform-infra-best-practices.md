---
type: best-practice-research
title: "Image transformation infra best practices"
subject: "Cloudflare/Pulumi/Webpresso-aligned implementation guidance for EdgeMatte"
date: 2026-05-27
confidence: high
---

# Best-Practice Research: Cloudflare-native image transform infra

## Direct Recommendation

Build **EdgeMatte** as a single public, company-neutral Cloudflare Worker app:

```text
Browser UI
  -> POST /api/images multipart image
  -> Hono validates size/type/magic bytes
  -> R2 stores original + metadata
  -> BackgroundRemovalProvider removes background
  -> Cloudflare Images transforms flip=h
  -> R2 stores processed PNG/WebP
  -> Response returns public image URL + one-time delete token
```

Use **Wrangler** for Worker deployment, routes, bindings, generated types, and static assets. Use **Pulumi** only for long-lived Cloudflare resources like R2 buckets, lifecycle rules, and optional CORS. This follows the IngestLens boundary: Pulumi owns durable resources; Wrangler owns Worker-scoped deployment.

## Evidence Used

- Official/upstream: [Cloudflare Workers TypeScript](https://developers.cloudflare.com/workers/languages/typescript) — generate `Env` types with `wrangler types`; do not hand-maintain binding types.
- Official/upstream: [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) — use R2 bindings for direct `put`, `get`, and `delete`; writes are strongly consistent after resolution.
- Official/upstream: [Cloudflare Images features](https://developers.cloudflare.com/images/optimization/features/) — supports `flip=h`, so do not add a native image library for the core flip.
- Official/upstream: [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/transformations/bindings/) — can transform streams and upload results to R2 without making source images public.
- Official/upstream: [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) — Free plan includes 5,000 monthly unique transformations for images stored outside Images, but binding calls have separate billing semantics.
- Official/upstream: [Hono Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers) — Hono fits Workers, env bindings, static assets, GitHub Actions deployment, and Vitest.
- Official/upstream: [Hono file upload](https://hono.dev/examples/file-upload) — use multipart parsing, `File` checks, and body limits for uploads.
- Official/upstream: [Pulumi Cloudflare Worker tutorial](https://developers.cloudflare.com/pulumi/tutorial/hello-world/) and Context7 Pulumi Cloudflare docs — Pulumi can create Workers and R2 buckets, but this project should avoid duplicating Wrangler ownership.
- Official/upstream: [Photoroom Remove Background API](https://www.photoroom.com/api/remove-background/) — current free-trial fit and supported formats.
- Official/upstream: [remove.bg API](https://www.remove.bg/tr/i/api) — viable provider alternative with free low-res monthly calls.
- Repo-local: Webpresso vision requires honest readiness, provenance, review/approval, and rollback paths.
- Repo-local: IngestLens uses Hono, Workers, R2, Pulumi, exact CORS, Worker envs, and split testing.

## Version / Date Context

- Date checked: 2026-05-27.
- IngestLens catalog observed: Node >=24, pnpm 11, Hono ^4.12, Wrangler ^4.84, `@cloudflare/vitest-pool-workers` ^0.14, `@pulumi/cloudflare` ^6.14, React 19, Vite 8, Vitest 4.
- Cloudflare Workers TypeScript docs last updated April 2026 in search result context.
- Cloudflare Images/R2 docs crawled/updated in April-May 2026 search context.

## Repo-Local Context

Current local working folder only contains the private task PDF and generated agent runtime state. There is no existing app scaffold.

Reusable sibling patterns:

- **IngestLens README:** public-facing repo narrative, reviewer path, architecture proof points, and "why worth reviewing" positioning.
- **IngestLens Worker:** Hono app, exact CORS, route grouping, rate limits, typed env bindings.
- **IngestLens infra:** Pulumi provisions durable resources; Wrangler deploys Worker-specific route/binding details.
- **IngestLens tests:** node pool for pure units, Workers pool only for Cloudflare-native behavior.
- **Webpresso runtime:** deadline-bounded fetch, retry classification, validation helpers, slug/id utilities. Use as package imports only if public install is frictionless; otherwise mirror the tiny patterns locally to keep the public repo self-contained.

## Boundaries / Non-goals

In scope:

- Public repo identity and README positioning.
- Single-image upload.
- Background removal via provider adapter.
- Horizontal flip via Cloudflare Images.
- Public processed-image URL.
- Delete endpoint that removes original, processed, and metadata objects.
- Tests for validation, provider failures, cleanup, and delete-token behavior.
- CI and deployment instructions.

Not in scope:

- User accounts/auth.
- Multi-image batch jobs.
- Queue-based async processing.
- Database metadata.
- Payments or provider-credit management.
- Full gallery/history UI.
- Custom WASM image processing unless Cloudflare Images binding is blocked.

## Handoff

Implementation should create this shape:

```text
edge-matte/
├── README.md
├── package.json
├── wrangler.toml
├── infra/
│   ├── Pulumi.yaml
│   └── src/resources/storage.ts
├── src/
│   ├── index.ts                 # Hono app + static asset fallback
│   ├── domain/image-record.ts   # ids, keys, metadata, delete-token hash
│   ├── pipeline/process-image.ts
│   ├── providers/background-removal.ts
│   ├── providers/photoroom.ts
│   ├── platform/r2-image-store.ts
│   ├── platform/cloudflare-images-transformer.ts
│   └── errors.ts
├── web/
│   └── upload UI
└── tests/
    ├── process-image.test.ts
    ├── routes.test.ts
    └── delete-flow.test.ts
```

Keep abstractions narrow:

```ts
interface BackgroundRemovalProvider {
  removeBackground(input: File, signal: AbortSignal): Promise<Blob>
}

interface ImageTransformer {
  flipHorizontal(input: ReadableStream, output: "image/png" | "image/webp"): Promise<Response>
}

interface ImageStore {
  putOriginal(record, file): Promise<void>
  putProcessed(record, body, contentType): Promise<void>
  getProcessed(id): Promise<Response | null>
  deleteAll(record): Promise<void>
}
```

Verification gates:

- `pnpm lint`
- `pnpm check-types`
- `pnpm test`
- `pnpm build`
- `wrangler deploy --dry-run`
- manual smoke: upload -> processed URL loads -> delete -> URL returns 404

Primary caveat:

- Verify Cloudflare Images binding availability before relying on it in production. If unavailable, use Cloudflare URL transformations with a private raw-image route and loop guard before introducing a WASM dependency.
