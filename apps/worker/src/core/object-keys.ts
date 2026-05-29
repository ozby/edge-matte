/** R2 prefix for transient cf.image sub-request blobs. Deleted in finally. */
export const SEGMENT_TMP_PREFIX = "segment-tmp/";

export interface ObjectKeys {
  metadata: string;
  original: string;
  processed: string;
}

export const deriveObjectKeys = (id: string): ObjectKeys => ({
  metadata: `jobs/${id}.json`,
  original: `images/${id}/original`,
  processed: `images/${id}/processed`,
});
