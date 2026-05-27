export type ErrorCode =
  | 'file_too_large'
  | 'unsupported_media_type'
  | 'invalid_delete_token'
  | 'image_not_found'
  | 'background_provider_failed'
  | 'image_transform_failed'
  | 'storage_failed'
  | 'invalid_request'

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code)
  }
}

export const fileTooLargeError = () => new AppError(413, 'file_too_large')
export const unsupportedMediaTypeError = () => new AppError(415, 'unsupported_media_type')
export const invalidDeleteTokenError = () => new AppError(401, 'invalid_delete_token')
export const imageNotFoundError = () => new AppError(404, 'image_not_found')
export const invalidRequestError = () => new AppError(400, 'invalid_request')

export const errorResponse = (error: unknown): { status: number; body: { error: { code: ErrorCode } } } => {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: { code: error.code } } }
  }
  return { status: 500, body: { error: { code: 'storage_failed' } } }
}
