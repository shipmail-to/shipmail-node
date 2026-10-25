import type { ApiErrorBody, ErrorLimit, ErrorType } from "./types/common.js";

/** The `reason` values this SDK knows. A newer server may send others; they pass through. */
export const ERROR_RECOVERY_REASONS = [
  "owner_confirmation_required",
  "subscription_required",
  "trial_capacity",
  "purchased_capacity",
] as const;

/** What an organization owner can do in Shipmail to lift a refusal. */
export type ErrorRecovery = {
  readonly reason?: string | undefined;
  readonly actionUrl?: string | undefined;
};

export class ShipmailError extends Error {
  readonly status: number | undefined;
  readonly type: ErrorType | undefined;
  readonly requestId: string | undefined;
  readonly retryable: boolean;
  /**
   * Why an organization owner must act, when they can lift this refusal in Shipmail. The error's
   * type and status stay what they were. See ERROR_RECOVERY_REASONS.
   */
  readonly reason: string | undefined;
  /** The Shipmail page to send the owner to. Retry with a new idempotency key afterwards. */
  readonly actionUrl: string | undefined;
  /** The plan, trial or fixed limit that refused the request, when one did. */
  readonly limit: ErrorLimit | undefined;

  constructor(
    message: string,
    options?: {
      readonly status?: number | undefined;
      readonly type?: ErrorType | undefined;
      readonly requestId?: string | undefined;
      readonly retryable?: boolean | undefined;
      readonly reason?: string | undefined;
      readonly actionUrl?: string | undefined;
      readonly limit?: ErrorLimit | undefined;
    },
  ) {
    super(message);
    this.name = "ShipmailError";
    this.status = options?.status;
    this.type = options?.type;
    this.requestId = options?.requestId;
    this.retryable = options?.retryable ?? false;
    this.reason = options?.reason;
    this.actionUrl = options?.actionUrl;
    this.limit = options?.limit;
  }
}

export class AuthenticationError extends ShipmailError {
  constructor(message: string, requestId?: string) {
    super(message, { status: 401, type: "authentication_error", requestId, retryable: false });
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends ShipmailError {
  constructor(message: string, requestId?: string, recovery?: ErrorRecovery) {
    super(message, {
      status: 403,
      type: "authorization_error",
      requestId,
      retryable: false,
      ...recovery,
    });
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends ShipmailError {
  readonly details:
    | readonly {
        readonly field: string;
        readonly message: string;
        readonly code?: string | undefined;
      }[]
    | undefined;

  constructor(
    message: string,
    options?: {
      readonly requestId?: string | undefined;
      readonly details?:
        | readonly {
            readonly field: string;
            readonly message: string;
            readonly code?: string | undefined;
          }[]
        | undefined;
      readonly reason?: string | undefined;
      readonly actionUrl?: string | undefined;
    },
  ) {
    super(message, {
      status: 422,
      type: "validation_error",
      requestId: options?.requestId,
      retryable: false,
      reason: options?.reason,
      actionUrl: options?.actionUrl,
    });
    this.name = "ValidationError";
    this.details = options?.details;
  }
}

export class QuotaExceededError extends ShipmailError {
  constructor(message: string, requestId?: string, recovery?: ErrorRecovery, limit?: ErrorLimit) {
    super(message, {
      status: 403,
      type: "quota_exceeded",
      requestId,
      retryable: false,
      ...recovery,
      limit,
    });
    this.name = "QuotaExceededError";
  }
}

export class NotFoundError extends ShipmailError {
  constructor(message: string, requestId?: string) {
    super(message, { status: 404, type: "not_found", requestId, retryable: false });
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends ShipmailError {
  readonly retryAfter: number | undefined;

  constructor(
    message: string,
    options?: { readonly requestId?: string | undefined; readonly retryAfter?: number | undefined },
  ) {
    super(message, {
      status: 429,
      type: "rate_limit_error",
      requestId: options?.requestId,
      retryable: true,
    });
    this.name = "RateLimitError";
    this.retryAfter = options?.retryAfter;
  }
}

export class ConflictError extends ShipmailError {
  constructor(message: string, requestId?: string) {
    super(message, { status: 409, type: "conflict", requestId, retryable: false });
    this.name = "ConflictError";
  }
}

export class InternalServerError extends ShipmailError {
  constructor(message: string, requestId?: string) {
    super(message, { status: 500, type: "internal_error", requestId, retryable: true });
    this.name = "InternalServerError";
  }
}

/**
 * A send was interrupted and its outcome is not known.
 *
 * Never retried: the message this names may already have gone out, so a retry
 * can deliver it twice. `messageId` is the tracking message the attempt left
 * behind; read it, or quote it in support, before deciding what to send.
 */
export class ReconciliationRequiredError extends ShipmailError {
  readonly messageId: string | undefined;

  constructor(message: string, requestId?: string, messageId?: string) {
    super(message, {
      status: 409,
      type: "reconciliation_required",
      requestId,
      retryable: false,
    });
    this.name = "ReconciliationRequiredError";
    this.messageId = messageId;
  }
}

export class ConnectionError extends ShipmailError {
  constructor(message: string) {
    super(message, { retryable: true });
    this.name = "ConnectionError";
  }
}

export class WebhookVerificationError extends ShipmailError {
  constructor(message: string) {
    super(message, { retryable: false });
    this.name = "WebhookVerificationError";
  }
}

function readErrorLimit(value: ErrorLimit | undefined): ErrorLimit | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof value.resource !== "string" ||
    typeof value.used !== "number" ||
    typeof value.limit !== "number" ||
    typeof value.scope !== "string"
  ) {
    return undefined;
  }
  return { resource: value.resource, used: value.used, limit: value.limit, scope: value.scope };
}

export function mapErrorFromResponse(
  status: number,
  body: ApiErrorBody,
  requestId?: string,
): ShipmailError {
  const error = body.error;
  const rid = requestId ?? error.request_id;
  // Only well-formed strings are kept, so an older or unexpected body cannot set them.
  const recovery: ErrorRecovery = {
    reason: typeof error.reason === "string" ? error.reason : undefined,
    actionUrl: typeof error.action_url === "string" ? error.action_url : undefined,
  };
  const limit = readErrorLimit(error.limit);

  switch (error.type) {
    case "authentication_error":
      return new AuthenticationError(error.message, rid);
    case "authorization_error":
      return new AuthorizationError(error.message, rid, recovery);
    case "quota_exceeded":
      return new QuotaExceededError(error.message, rid, recovery, limit);
    case "validation_error":
      return new ValidationError(error.message, {
        requestId: rid,
        details: error.details,
        ...recovery,
      });
    case "not_found":
      return new NotFoundError(error.message, rid);
    case "rate_limit_error":
      return new RateLimitError(error.message, { requestId: rid, retryAfter: error.retry_after });
    case "conflict":
      return new ConflictError(error.message, rid);
    case "reconciliation_required":
      return new ReconciliationRequiredError(error.message, rid, error.message_id);
    case "internal_error":
      return new InternalServerError(error.message, rid);
    default:
      return new ShipmailError(error.message, {
        status,
        type: error.type,
        requestId: rid,
        retryable: status >= 500,
        ...recovery,
        limit,
      });
  }
}
