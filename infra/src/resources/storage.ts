import * as cloudflare from "@pulumi/cloudflare";
import { R2_BUCKET_NAME, cloudflareAccountId } from "../config.js";

export const imagesBucket = new cloudflare.R2Bucket("edge-matte-images", {
  accountId: cloudflareAccountId,
  name: R2_BUCKET_NAME,
});

export const imagesBucketName = imagesBucket.name;
