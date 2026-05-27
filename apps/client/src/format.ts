export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const MAX_UPLOAD_LABEL = "8 MiB";
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const validateSelectedFile = (file: File): string | null => {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    return "Choose a PNG, JPEG, or WebP image.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Image must be ${MAX_UPLOAD_LABEL} or smaller.`;
  }
  return null;
};

export const errorCodeToMessage = (code: string | null): string => {
  switch (code) {
    case "file_too_large":
      return `That file is too large. Use an image up to ${MAX_UPLOAD_LABEL}.`;
    case "unsupported_media_type":
      return "Unsupported image type. Use PNG, JPEG, or WebP.";
    case "invalid_delete_token":
      return "Delete was rejected. Start a new upload.";
    case "image_not_found":
      return "This job no longer exists.";
    case "background_provider_failed":
      return "Background removal failed. Try again in a moment.";
    case "image_transform_failed":
      return "Image transform failed. Try again in a moment.";
    case "storage_failed":
      return "Storage failed. Try again in a moment.";
    case "invalid_request":
      return "Invalid request. Check the file and try again.";
    default:
      return "Something went wrong. Try again.";
  }
};

export const statusLabel = (status: string): string => {
  switch (status) {
    case "validating":
      return "Validating…";
    case "uploading":
      return "Uploading…";
    case "removing_background":
      return "Removing background…";
    case "flipping":
      return "Flipping image…";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return "Processing…";
  }
};

export const isTerminalStatus = (status: string): boolean =>
  status === "ready" || status === "failed";
