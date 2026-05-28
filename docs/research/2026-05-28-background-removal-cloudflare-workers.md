---
type: research
title: "Background removal for Cloudflare Workers — provider evaluation"
subject: "background removal APIs and models for a Cloudflare Workers image pipeline"
date: 2026-05-28
last_updated: 2026-05-28
confidence: high
verdict: adopt
---

# Background removal for Cloudflare Workers

> Cloudflare's own Images binding supports `segment: "foreground"` (BiRefNet, SOTA) — zero external dependencies, zero secrets, same billing stack the Worker already uses.

## TL;DR

- **Adopt: Cloudflare Images `segment: "foreground"`** — native, no API key, BiRefNet quality, uses the existing `IMAGES` binding already in `wrangler.toml`.
- Photoroom replaced: external key, 60 req/min limit, Oct 2024 outage, 10-image sandbox cap.
- BiRefNet is the 2026 SOTA model for dichotomous image segmentation (DIS-VD S=0.927, MIT license).
- All alternatives (remove.bg, Replicate, fal.ai, ClipDrop) introduce external API keys or cold-start latency; none offer better quality than the native Cloudflare path.
- Output format must be `image/png` or `image/webp` (transparency requires alpha; JPEG silently drops it).

## What This Is

A Cloudflare Workers service that removes an image background and flips it horizontally before hosting in R2. The background removal step was previously delegated to Photoroom's external API. This research evaluates whether Cloudflare's own platform — or a higher-quality third-party — is a better fit.

## State of the Art (2026)

**BiRefNet** (ZhengPeng7) is the leading open-source background removal model as of 2026:

- DIS-VD benchmark: S=0.927, wF=0.894 (HR 2048px model); S=0.911, wF=0.875 (standard 1024px)
- Outperforms IS-Net (its predecessor), U2-Net, SAM, and RMBG-1.4 on all shared benchmarks
- MIT license — suitable for commercial use
- Available as PyTorch, ONNX, GGUF, and HF Transformers
- Source: [BiRefNet GitHub](https://github.com/ZhengPeng7/BiRefNet)

Cloudflare evaluated BiRefNet, U2-Net, IS-Net, and SAM before selecting BiRefNet for its Images background removal feature. Source: [Cloudflare blog — Evaluating image segmentation models for background removal](https://blog.cloudflare.com/background-removal/)

## Positive Signals

### Cloudflare-native path

- **Zero external dependencies.** The `IMAGES` binding is already declared in `wrangler.toml` and used for the horizontal flip. Background removal reuses the same binding — no new Wrangler config, no new secrets.
- **BiRefNet quality.** Cloudflare selected BiRefNet after benchmarking all major segmentation models. Latency: 351ms (larger GPU) to 821ms (smaller GPU) per Cloudflare's own data.
- **GA as of mid-2026.** The `segment: "foreground"` transform parameter is documented without a beta flag at [Cloudflare Images features](https://developers.cloudflare.com/images/optimization/features/#segment).
- **Same billing.** No per-call charge published separately from the Images plan. Workers AI inference for the segmentation is internal to Cloudflare.
- **API ergonomics.** Fits the existing `.input().transform().output().response()` chain pattern already used by `CloudflareImagesTransformer` — same interface, same error envelope.

### BiRefNet (general)

- MIT license: no commercial use restrictions.
- Community-validated: used by fal.ai, Replicate, and Cloudflare as the production inference target.
- Fine-grained edge quality: handles hair, fur, spokes, and translucent objects better than IS-Net and U2-Net.

## Negative Signals

### Cloudflare-native path

- **Binding dependency.** If `env.IMAGES` is null (e.g. local `wrangler dev` without the binding configured), the provider throws `AppError(502, "background_provider_failed")`. Mitigated by the existing `E2E_MOCK_PIPELINE=1` mode.
- **No signal pass-through.** The Images binding does not accept `AbortSignal`. Worker request lifecycle cancellation is handled by the Workers runtime, not the binding API.
- **Open beta pricing.** No explicit per-call price published during beta — costs are covered by the Cloudflare Images plan but may change at GA. Source: [Cloudflare Developers on X — open beta announcement](https://x.com/CloudflareDev/status/1961054980606947832)

### Photoroom (why it was replaced)

- Rate limit cut from 500 to 60 images/min; no self-serve increase path. Source: [Photoroom forum](https://photoroom.discourse.group/t/is-there-a-rate-limiting/11)
- October 2024 outage (~45 min) caused by internal monitoring latency. Source: [Photoroom post-mortem](https://www.photoroom.com/inside-photoroom/post-mortem-photoroom-api-incident-october-11-2024)
- 10-image sandbox cap; API access requires Pro plan. Source: [Photoroom pricing analysis](https://wizcommerce.com/blog/photoroom-pricing/)
- `PHOTOROOM_API_KEY` must be set as a Cloudflare Worker secret out-of-band — not managed by Wrangler config or Pulumi.

## Community Sentiment

BiRefNet holds top spots on PapersWithCode leaderboards for DIS, HRSOD, COD, UHRSD, DUTS-TE, and DUT-OMRON benchmarks as of the most recent evaluation. Multiple ML practitioners cite it as the de facto SOTA for background removal inference. Cloudflare's own engineering blog corroborates the model selection rationale. Sentiment is strongly positive.

## Alternatives Considered

| Option                       | Quality             | Free tier               | Latency                     | Rejection reason                                            |
| ---------------------------- | ------------------- | ----------------------- | --------------------------- | ----------------------------------------------------------- |
| **Cloudflare Images native** | BiRefNet (SOTA)     | included in Images plan | 351–821ms                   | **Selected**                                                |
| Photoroom                    | proprietary         | 10 images/trial         | ~450ms                      | External key, rate limits, outage history                   |
| remove.bg                    | proprietary         | 50/month                | unknown                     | External key, not SOTA                                      |
| Replicate + BiRefNet (MIT)   | BiRefNet (SOTA)     | none                    | 93–165ms warm, minutes cold | Cold starts; min_instances adds idle cost; external billing |
| fal.ai (rembg)               | rembg (older model) | none public             | unknown                     | Not SOTA, per-image pricing opaque                          |
| ClipDrop / Jasper            | below Photoroom     | 100 credits             | ~2s                         | Slower, weaker edge quality                                 |
| WASM/ONNX in Worker          | ISNet-quant8        | free                    | unknown                     | 128MB bundle limit risk; beta tooling (`workers-wonnx`)     |

## Project Alignment

### Vision Fit

EdgeMatte's vision: "From upload to clean hosted result at the edge — with honest lifecycle boundaries." Moving from an external Photoroom dependency to the native `IMAGES` binding directly advances the "at the edge" principle and eliminates the out-of-band secret lifecycle boundary.

### Tech Stack Fit

The `IMAGES` binding is already present in `wrangler.toml` and typed via `@cloudflare/workers-types`. The new `CloudflareImagesBackgroundRemovalProvider` mirrors the existing `CloudflareImagesTransformer` implementation pattern exactly — same `ImagesBinding` interface shape, same `AppError` error mapping, same `as never` cast in `index.ts`. Integration cost: one new adapter file.

### Trade-offs for Current Stage

The Worker is a reference app being evaluated by a YC company. Using Cloudflare's own platform for both transforms (background removal and flip) demonstrates architectural depth and avoids the "external API key not set" production failure mode that caused the submission blocker. The latency (351–821ms) is acceptable for a non-batch upload workflow.

## Recommendation

**Adopt `segment: "foreground"` via the Cloudflare Images Workers binding.** Confidence: high.

Conditions under which this recommendation would change:

- If Cloudflare changes pricing for the segmentation feature to exceed the Photoroom API cost per call at production volume.
- If image quality for specific edge cases (translucent objects, complex backgrounds) is measurably inferior to Photoroom on the actual use case — test with representative images before dismissing.

## Sources

1. [Cloudflare blog — Evaluating image segmentation models for background removal](https://blog.cloudflare.com/background-removal/) — official engineering deep-dive, high credibility, positive
2. [Cloudflare Images features — segment parameter](https://developers.cloudflare.com/images/optimization/features/#segment) — official docs, high credibility
3. [Cloudflare Images transform via Workers binding](https://developers.cloudflare.com/images/transform-images/bindings/) — official docs, high credibility
4. [CloudflareDev on X — open beta announcement](https://x.com/CloudflareDev/status/1961054980606947832) — official announcement, medium-high credibility, positive
5. [BiRefNet GitHub — ZhengPeng7](https://github.com/ZhengPeng7/BiRefNet) — primary source, MIT license, benchmark scores, high credibility
6. [BRIA RMBG-2.0 HuggingFace](https://huggingface.co/briaai/RMBG-2.0) — vendor model card, non-commercial weights, medium credibility
7. [Replicate pricing](https://replicate.com/pricing) — official pricing, high credibility
8. [fal.ai rembg API](https://fal.ai/models/fal-ai/imageutils/rembg/api) — official docs, medium credibility
9. [Photoroom forum — rate limiting](https://photoroom.discourse.group/t/is-there-a-rate-limiting/11) — community report, medium credibility, negative
10. [Photoroom post-mortem Oct 2024](https://www.photoroom.com/inside-photoroom/post-mortem-photoroom-api-incident-october-11-2024) — official post-mortem, high credibility, neutral/negative
11. [Photoroom pricing analysis](https://wizcommerce.com/blog/photoroom-pricing/) — third-party analysis, medium credibility, negative
12. [ClipDrop remove background API docs](https://clipdrop.co/apis/docs/remove-background) — official docs, medium-high credibility, neutral
13. [Eden AI — best background removal APIs 2026](https://www.edenai.co/post/best-background-removal-apis) — comparison article, medium credibility, neutral
