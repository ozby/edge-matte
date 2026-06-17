import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

/** Must match `test/infra/helpers.mjs` and `apps/workers/wrangler.toml` `bucket_name`. */
export const R2_BUCKET_NAME = "edge-matte-images";

const accountFromConfig = config.get("cloudflareAccountId");
const accountFromEnv = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!accountFromConfig && !accountFromEnv) {
  throw new Error(
    "Set edge-matte:cloudflareAccountId (pulumi config) or CLOUDFLARE_ACCOUNT_ID before preview/up",
  );
}

export const cloudflareAccountId = accountFromConfig ?? accountFromEnv!;

const maxAgeDays = Number.parseInt(config.get("artifactMaxAgeDays") ?? "30", 10);
if (!Number.isFinite(maxAgeDays) || maxAgeDays < 1) {
  throw new Error("edge-matte:artifactMaxAgeDays must be a positive integer");
}

/** R2 lifecycle `maxAge` is expressed in seconds. */
export const artifactMaxAgeSeconds = maxAgeDays * 24 * 60 * 60;
