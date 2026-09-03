export type ApiErrorCode =
  | "AUTHENTICATION_FAILED"
  | "AUTHENTICATION_REQUIRED"
  | "CSRF_REJECTED"
  | "EMAIL_VERIFICATION_INVALID"
  | "ORIGIN_REJECTED"
  | "PASSWORD_RESET_INVALID"
  | "RATE_LIMITED"
  | "ROLE_NOT_ALLOWED"
  | "SESSION_LIMIT_REACHED"
  | "SESSION_REVOKED"
  | "SERVICE_UNAVAILABLE"
  | "UPSTREAM_UNAVAILABLE"
  | "VALIDATION_FAILED";

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
