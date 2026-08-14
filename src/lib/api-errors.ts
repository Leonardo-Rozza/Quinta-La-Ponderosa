export type Result<T, E = ApiError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BOT_DETECTED'
  | 'RATE_LIMITED'
  | 'DATE_UNAVAILABLE'
  | 'RESERVATION_NOT_FOUND'
  | 'RESERVATION_CONFLICT'
  | 'PAYMENT_MISMATCH'
  | 'DUPLICATE_EVENT'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  status: number;
  retryable: boolean;
  field?: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
    field?: string;
  };
}
export function createApiError(
  code: ApiErrorCode,
  message: string,
  options: { status?: number; retryable?: boolean; field?: string } = {}
): ApiError {
  return {
    code,
    message,
    status: options.status ?? 500,
    retryable: options.retryable ?? false,
    ...(options.field ? { field: options.field } : {}),
  };
}

export function toApiErrorBody(error: ApiError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.field ? { field: error.field } : {}),
    },
  };
}
