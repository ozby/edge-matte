export type ImageJobStatus =
  | "validating"
  | "uploading"
  | "removing_background"
  | "flipping"
  | "ready"
  | "failed";

export interface PublicImageJob {
  id: string;
  status: ImageJobStatus;
  imageUrl: string;
  originalImageUrl: string;
  resultUrl: string;
  pollUrl: string;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobResponse extends PublicImageJob {
  deleteToken: string;
}

export type ErrorCode =
  | "file_too_large"
  | "unsupported_media_type"
  | "invalid_delete_token"
  | "image_not_found"
  | "background_provider_failed"
  | "image_transform_failed"
  | "storage_failed"
  | "invalid_request";
