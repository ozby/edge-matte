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
