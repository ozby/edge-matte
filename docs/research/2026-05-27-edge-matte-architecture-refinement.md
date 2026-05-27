---
type: research
title: "EdgeMatte architecture refinement"
subject: "DRY/SOLID/KISS architecture and CI deployment refinement"
date: 2026-05-27
confidence: high
verdict: refine
---

# EdgeMatte Architecture Refinement

## Direct answer

The current architecture is close, but **not yet the most elegant** if queue/status
machinery becomes mandatory in v1.

The elegant version is:

```text
one Worker + static assets + one R2 bucket + one pure pipeline core
```

The product still exposes job language and a status URL, but v1 runs inline. The
queue adapter stays a documented promotion path, not initial complexity.

## Refined architecture

```text
Browser
  -> Hono route adapter
  -> pure processImageJob(command, deps)
  -> BackgroundRemovalProvider port
  -> ImageTransform port
  -> JobRepository/ImageObjectStore port
  -> R2 + Cloudflare Images adapters
```

### DRY

- One `ImageJob` model.
- One key derivation function for original, processed, and metadata objects.
- One `processImageJob()` orchestration path.
- One response envelope for route errors.
- One deployment target: `edge-matte.ozby.dev`.

### SOLID

- **Single responsibility:** routes parse HTTP, pipeline orchestrates, adapters talk to Cloudflare/provider APIs.
- **Open/closed:** add remove.bg or queue execution by adding adapters, not changing route code.
- **Liskov:** mock provider/transform/store implement the same ports as production.
- **Interface segregation:** three small ports: background removal, image transform, persistence.
- **Dependency inversion:** core pipeline depends on ports, not Hono, R2, Cloudflare Images, or Photoroom directly.

### KISS

- No D1, Durable Object, KV, auth, or queue in the first live version.
- R2 stores blobs and `jobs/{id}.json` metadata.
- Inline processing returns `201` when ready.
- `GET /api/jobs/:id` exists for a stable public contract and post-result inspection.
- Queue mode lands only if provider latency or reliability makes inline processing fail in practice.

## Official-doc facts that changed the plan

- Cloudflare recommends production Workers use a route or custom domain instead of relying on `workers.dev`; custom domains can be configured in Wrangler with `custom_domain = true`. Therefore the production route is **`edge-matte.ozby.dev`**.
- Workers Static Assets deploy Worker code and static assets as one unit, which is exactly the simplest product shape for this app.
- Workers have no hard wall-clock limit for HTTP requests while the client remains connected, and waiting on network calls does not count as CPU time. That supports inline processing with explicit provider deadlines.
- `ctx.waitUntil()` is capped at 30 seconds and is not a reliable background-job system. If completion must be guaranteed after the response, use Cloudflare Queues.
- Queues are for reliable out-of-band work with retries and buffering. They are a promotion path, not a v1 requirement.
- R2 Worker bindings directly support object `put`, `get`, and `delete`; R2 docs recommend using `httpEtag` when returning ETags and provide metadata helpers for HTTP responses.
- Cloudflare Images binding can transform bytes without making source images public and can upload transformed output to R2, but every call counts as a transformation. The binding is the elegant flip path if the account supports it.
- Hono has first-class Cloudflare binding typing, body limit middleware, multipart upload parsing, and app-level testing with `app.request()`.
- Cloudflare provides an official `cloudflare/wrangler-action@v3` GitHub Action; GitHub environments make deployment history visible and gateable.

## OSS reference patterns

### `yusukebe/r2-image-worker`

Useful lessons:

- Keep the image worker small and legible.
- Upload and image delivery can be one Worker backed by R2.
- Custom domains matter for image delivery and transformations.
- README should provide a straight curl-style reviewer path.

What EdgeMatte should not copy:

- Basic auth for delete/control. A one-time capability delete token fits this product better.
- Width/height transform parameters. EdgeMatte has one required transform: horizontal flip after background removal.

### `cloudflare/templates`

Useful lessons:

- Use Worker + static assets as the default full-stack shape.
- Keep templates deployable with standard Wrangler commands.
- Validate templates with automated tests and live-mode smoke tests when deployed.

### `honojs/examples`

Useful lessons:

- Keep Hono apps route-focused.
- Export route/app types only where they help clients/tests.
- Avoid hiding simple endpoints behind heavy framework ceremony.

## Refined CI/CD contract

### Production target

`https://edge-matte.ozby.dev`

Wrangler owns the Worker deployment, static assets, route, bindings, and secrets:

```toml
name = "edge-matte"
main = "src/index.ts"
compatibility_date = "2026-05-27"

[assets]
directory = "./dist/client"
binding = "ASSETS"
not_found_handling = "single-page-application"

[vars]
BACKGROUND_PROVIDER = "photoroom"

[env.production]
name = "edge-matte"
workers_dev = false
routes = [{ pattern = "edge-matte.ozby.dev", custom_domain = true }]

[env.production.vars]
PUBLIC_BASE_URL = "https://edge-matte.ozby.dev"
BACKGROUND_PROVIDER = "photoroom"

[[env.production.r2_buckets]]
binding = "IMAGES"
bucket_name = "edge-matte-production-images"

[env.production.secrets]
required = ["PHOTOROOM_API_KEY"]
```

Pulumi owns only durable infrastructure:

- `edge-matte-production-images` R2 bucket,
- lifecycle cleanup for stale failed/intermediate objects,
- optional CORS if direct browser-to-R2 upload is ever added.

### GitHub Actions shape

PR/push CI:

```text
checkout -> setup pnpm -> install -> lint -> typecheck -> test -> build -> wrangler deploy --dry-run
```

Production deploy on `main`:

```text
CI gates -> cloudflare/wrangler-action@v3 deploy --env production
          -> GitHub environment: production
          -> environment URL: https://edge-matte.ozby.dev
          -> post-deploy smoke: GET /health + GET /
```

Secrets:

- GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Cloudflare Worker secret: `PHOTOROOM_API_KEY`, set with `wrangler secret put PHOTOROOM_API_KEY --env production`.
- Do not store provider secrets in GitHub unless the CI job must rotate them.

### Why this is elegant

- The deploy path has one production command: `wrangler deploy --env production`.
- The domain is source-controlled in `wrangler.toml`.
- Infra changes are separate from app deploys.
- PRs prove deployability without mutating production.
- Production deploys are serialized with GitHub Actions concurrency.
- The smoke test verifies the actual public hostname, not only a successful CLI exit.

## Architecture changes to apply

1. Make inline processing the v1 path.
2. Keep queue mode in docs as a promotion path only.
3. Reword `JobStore` to `JobRepository` and `ImageStore` to `ImageObjectStore` to make ports clearer.
4. Put domain/CI deployment into the blueprint as a first-class acceptance criterion.
5. Add a deployment diagram for GitHub Actions -> Wrangler -> `edge-matte.ozby.dev`.

## Governance recommendation

Best-practice answer: **yes, this should become shared agent-kit functionality**.

The elegant long-term shape is:

```text
architecture docs as source of truth
+ blueprint links to architecture docs
+ required Architecture before / Architecture after for architecture-changing blueprints
+ CI audit that fails on drift
```

For EdgeMatte now, a local contract plus CI check is enough. For IngestLens and
other sibling repos, the right shared surface is an agent-kit audit such as
`wp audit architecture-drift --root .`, backed by a repo-local
`docs/architecture.contract.json`.

That keeps the enforcement DRY, portable, and consistent with the existing
agent-kit audit model (`docs-frontmatter`, `blueprint-lifecycle`, `catalog-drift`).

## Handoff

Implementation should start from these modules:

```text
src/core/
  image-job.ts
  object-keys.ts
  process-image-job.ts
  errors.ts

src/ports/
  background-removal-provider.ts
  image-transformer.ts
  job-repository.ts
  image-object-store.ts

src/adapters/
  hono/
  cloudflare/
  photoroom/
```

This is the smallest structure that preserves DRY/SOLID/KISS while keeping the
public repo credible.

## Sources

- [Cloudflare Workers routes and domains](https://developers.cloudflare.com/workers/configuration/routing/) — official, production domain recommendation.
- [Cloudflare Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains) — official Wrangler `custom_domain = true` setup.
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) — official Worker + assets deployment model.
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) — official memory, CPU, duration, request-size constraints.
- [Cloudflare Workers Context API](https://developers.cloudflare.com/workers/runtime-apis/context/) — official `waitUntil()` limit and queue recommendation.
- [Cloudflare Queues](https://developers.cloudflare.com/queues/) — official reliable async work model.
- [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/transformations/bindings/) — official transform-to-R2 path.
- [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) — official object operations and metadata guidance.
- [Hono Cloudflare Workers docs](https://hono.dev/docs/getting-started/cloudflare-workers) — official Hono Worker binding/testing pattern.
- [Hono body limit middleware](https://hono.dev/docs/middleware/builtin/body-limit) — official upload guard.
- [Cloudflare Wrangler GitHub Action](https://github.com/cloudflare/wrangler-action) — official deploy action.
- [GitHub Actions deployments](https://docs.github.com/actions/tutorials/deploying-with-github-actions) — official deployment environment/history behavior.
- [yusukebe/r2-image-worker](https://github.com/yusukebe/r2-image-worker) — credible OSS R2 image Worker reference.
- [cloudflare/templates](https://github.com/cloudflare/templates) — official Workers template patterns.
- [honojs/examples](https://github.com/honojs/examples) — official Hono examples.
