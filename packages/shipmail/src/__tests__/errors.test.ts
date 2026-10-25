import { describe, expect, test } from "bun:test";

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ConnectionError,
  InternalServerError,
  mapErrorFromResponse,
  NotFoundError,
  QuotaExceededError,
  RateLimitError,
  ReconciliationRequiredError,
  ShipmailError,
  ValidationError,
  WebhookVerificationError,
} from "../errors.js";
import type { ApiErrorBody } from "../types/common.js";

describe("mapErrorFromResponse", () => {
  test("maps authentication_error to AuthenticationError", () => {
    const body: ApiErrorBody = {
      error: { type: "authentication_error", message: "Invalid API key", request_id: "req_1" },
    };
    const err = mapErrorFromResponse(401, body);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe("Invalid API key");
    expect(err.status).toBe(401);
    expect(err.type).toBe("authentication_error");
    expect(err.requestId).toBe("req_1");
    expect(err.retryable).toBe(false);
  });

  test("maps authorization_error to AuthorizationError", () => {
    const body: ApiErrorBody = {
      error: { type: "authorization_error", message: "Forbidden", request_id: "req_2" },
    };
    const err = mapErrorFromResponse(403, body);
    expect(err).toBeInstanceOf(AuthorizationError);
    expect(err.message).toBe("Forbidden");
    expect(err.status).toBe(403);
    expect(err.type).toBe("authorization_error");
    expect(err.retryable).toBe(false);
  });

  test("maps validation_error to ValidationError with details", () => {
    const body: ApiErrorBody = {
      error: {
        type: "validation_error",
        message: "Validation failed",
        request_id: "req_3",
        details: [
          { field: "name", message: "Name is required" },
          { field: "address", message: "Invalid email address" },
          {
            field: "preflight.content_policy",
            code: "content_policy",
            message: "Message contains too many links (21 found, 20 max).",
          },
        ],
      },
    };
    const err = mapErrorFromResponse(422, body);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe("Validation failed");
    expect(err.status).toBe(422);
    expect(err.type).toBe("validation_error");
    expect(err.retryable).toBe(false);
    const valErr = err as ValidationError;
    expect(valErr.details).toHaveLength(3);
    expect(valErr.details?.[0]?.field).toBe("name");
    expect(valErr.details?.[0]?.message).toBe("Name is required");
    expect(valErr.details?.[1]?.field).toBe("address");
    expect(valErr.details?.[1]?.message).toBe("Invalid email address");
    expect(valErr.details?.[2]?.field).toBe("preflight.content_policy");
    expect(valErr.details?.[2]?.code).toBe("content_policy");
  });

  test("maps validation_error without details", () => {
    const body: ApiErrorBody = {
      error: { type: "validation_error", message: "Invalid input" },
    };
    const err = mapErrorFromResponse(422, body);
    expect(err).toBeInstanceOf(ValidationError);
    const valErr = err as ValidationError;
    expect(valErr.details).toBeUndefined();
  });

  test("maps not_found to NotFoundError", () => {
    const body: ApiErrorBody = {
      error: { type: "not_found", message: "Domain not found", request_id: "req_4" },
    };
    const err = mapErrorFromResponse(404, body);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.message).toBe("Domain not found");
    expect(err.status).toBe(404);
    expect(err.retryable).toBe(false);
  });

  test("maps rate_limit_error to RateLimitError with retryAfter", () => {
    const body: ApiErrorBody = {
      error: {
        type: "rate_limit_error",
        message: "Too many requests",
        request_id: "req_5",
        retry_after: 30,
      },
    };
    const err = mapErrorFromResponse(429, body);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.message).toBe("Too many requests");
    expect(err.status).toBe(429);
    expect(err.type).toBe("rate_limit_error");
    expect(err.retryable).toBe(true);
    const rateErr = err as RateLimitError;
    expect(rateErr.retryAfter).toBe(30);
  });

  test("maps rate_limit_error without retryAfter", () => {
    const body: ApiErrorBody = {
      error: { type: "rate_limit_error", message: "Slow down" },
    };
    const err = mapErrorFromResponse(429, body);
    expect(err).toBeInstanceOf(RateLimitError);
    const rateErr = err as RateLimitError;
    expect(rateErr.retryAfter).toBeUndefined();
  });

  test("maps conflict to ConflictError", () => {
    const body: ApiErrorBody = {
      error: { type: "conflict", message: "Domain already exists", request_id: "req_6" },
    };
    const err = mapErrorFromResponse(409, body);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toBe("Domain already exists");
    expect(err.status).toBe(409);
    expect(err.retryable).toBe(false);
  });

  test("maps internal_error to InternalServerError", () => {
    const body: ApiErrorBody = {
      error: { type: "internal_error", message: "Something went wrong", request_id: "req_7" },
    };
    const err = mapErrorFromResponse(500, body);
    expect(err).toBeInstanceOf(InternalServerError);
    expect(err.message).toBe("Something went wrong");
    expect(err.status).toBe(500);
    expect(err.retryable).toBe(true);
  });

  // A retry of an interrupted send can deliver the message twice, so this must
  // never be retryable. It used to arrive as a 500, which both SDKs retry.
  test("an interrupted send is a conflict that is never retried", () => {
    const body: ApiErrorBody = {
      error: {
        type: "reconciliation_required",
        message: "The previous send attempt requires reconciliation.",
        request_id: "req_8",
        message_id: "msg_interrupted",
      },
    };
    const err = mapErrorFromResponse(409, body);
    expect(err).toBeInstanceOf(ReconciliationRequiredError);
    if (!(err instanceof ReconciliationRequiredError)) {
      throw new Error("Expected ReconciliationRequiredError.");
    }
    expect(err.status).toBe(409);
    expect(err.retryable).toBe(false);
    expect(err.messageId).toBe("msg_interrupted");
  });

  test("an ordinary 500 carries no reconciliation message id", () => {
    const body: ApiErrorBody = {
      error: { type: "internal_error", message: "Something went wrong", request_id: "req_9" },
    };
    const err = mapErrorFromResponse(500, body);
    expect(err).toBeInstanceOf(InternalServerError);
    expect(err.retryable).toBe(true);
    expect("messageId" in err).toBe(false);
  });

  test("uses requestId parameter over body request_id", () => {
    const body: ApiErrorBody = {
      error: { type: "not_found", message: "Not found", request_id: "req_body" },
    };
    const err = mapErrorFromResponse(404, body, "req_param");
    expect(err.requestId).toBe("req_param");
  });

  test("falls back to body request_id when parameter is undefined", () => {
    const body: ApiErrorBody = {
      error: { type: "not_found", message: "Not found", request_id: "req_body" },
    };
    const err = mapErrorFromResponse(404, body);
    expect(err.requestId).toBe("req_body");
  });

  test("returns generic ShipmailError for unknown error type", () => {
    const body = {
      error: { type: "unknown_type" as const, message: "Unknown error" },
    };
    const err = mapErrorFromResponse(418, body as ApiErrorBody);
    expect(err).toBeInstanceOf(ShipmailError);
    expect(err).not.toBeInstanceOf(AuthenticationError);
    expect(err).not.toBeInstanceOf(NotFoundError);
    expect(err.message).toBe("Unknown error");
    expect(err.status).toBe(418);
    expect(err.retryable).toBe(false);
  });

  test("generic ShipmailError is retryable for 5xx status", () => {
    const body = {
      error: { type: "unknown_type" as const, message: "Unknown server error" },
    };
    const err = mapErrorFromResponse(503, body as ApiErrorBody);
    expect(err.retryable).toBe(true);
  });
});

describe("error classes", () => {
  test("ShipmailError defaults retryable to false", () => {
    const err = new ShipmailError("test");
    expect(err.retryable).toBe(false);
    expect(err.name).toBe("ShipmailError");
    expect(err.status).toBeUndefined();
    expect(err.type).toBeUndefined();
    expect(err.requestId).toBeUndefined();
  });

  test("ConnectionError is retryable", () => {
    const err = new ConnectionError("Connection refused");
    expect(err.retryable).toBe(true);
    expect(err.name).toBe("ConnectionError");
    expect(err.status).toBeUndefined();
  });

  test("WebhookVerificationError is not retryable", () => {
    const err = new WebhookVerificationError("Invalid signature");
    expect(err.retryable).toBe(false);
    expect(err.name).toBe("WebhookVerificationError");
  });

  test("all error classes extend ShipmailError", () => {
    expect(new AuthenticationError("test")).toBeInstanceOf(ShipmailError);
    expect(new AuthorizationError("test")).toBeInstanceOf(ShipmailError);
    expect(new ValidationError("test")).toBeInstanceOf(ShipmailError);
    expect(new NotFoundError("test")).toBeInstanceOf(ShipmailError);
    expect(new RateLimitError("test")).toBeInstanceOf(ShipmailError);
    expect(new ConflictError("test")).toBeInstanceOf(ShipmailError);
    expect(new InternalServerError("test")).toBeInstanceOf(ShipmailError);
    expect(new ConnectionError("test")).toBeInstanceOf(ShipmailError);
    expect(new WebhookVerificationError("test")).toBeInstanceOf(ShipmailError);
  });

  test("all error classes extend Error", () => {
    expect(new ShipmailError("test")).toBeInstanceOf(Error);
    expect(new AuthenticationError("test")).toBeInstanceOf(Error);
    expect(new ConnectionError("test")).toBeInstanceOf(Error);
  });
});

describe("owner recovery fields", () => {
  test("a new server's reason and action_url reach the existing error classes", () => {
    const quota = mapErrorFromResponse(403, {
      error: {
        type: "quota_exceeded",
        message: "Mailbox limit reached (3/3).",
        request_id: "req_r1",
        reason: "trial_capacity",
        action_url: "https://shipmail.to/billing?org=org_1",
      },
    });
    expect(quota).toBeInstanceOf(QuotaExceededError);
    expect(quota.status).toBe(403);
    expect(quota.reason).toBe("trial_capacity");
    expect(quota.actionUrl).toBe("https://shipmail.to/billing?org=org_1");

    const purchase = mapErrorFromResponse(403, {
      error: {
        type: "authorization_error",
        message: "An organization owner must confirm this domain purchase.",
        reason: "owner_confirmation_required",
        action_url: "https://shipmail.to/domains/review?org=org_1&domain=a.test&years=1",
      },
    });
    expect(purchase).toBeInstanceOf(AuthorizationError);
    expect(purchase.reason).toBe("owner_confirmation_required");

    const subscription = mapErrorFromResponse(422, {
      error: {
        type: "validation_error",
        message: "A subscription is required to create mailboxes.",
        reason: "subscription_required",
        action_url: "https://shipmail.to/billing?org=org_1",
      },
    });
    expect(subscription).toBeInstanceOf(ValidationError);
    expect(subscription.status).toBe(422);
    expect(subscription.reason).toBe("subscription_required");
  });

  test("an older server's body leaves both fields undefined", () => {
    const err = mapErrorFromResponse(403, {
      error: { type: "quota_exceeded", message: "Mailbox limit reached.", request_id: "req_r2" },
    });
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err.reason).toBeUndefined();
    expect(err.actionUrl).toBeUndefined();
    expect(err.limit).toBeUndefined();
  });

  test("a limit refusal exposes the limit that refused it", () => {
    const err = mapErrorFromResponse(403, {
      error: {
        type: "quota_exceeded",
        message: "Active subscriber limit reached (100).",
        reason: "trial_capacity",
        action_url: "https://shipmail.to/billing?org=org_1",
        limit: { resource: "audience_subscribers", used: 100, limit: 100, scope: "trial" },
      },
    });
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err.limit).toEqual({
      resource: "audience_subscribers",
      used: 100,
      limit: 100,
      scope: "trial",
    });
  });

  test("a reason this SDK does not know still passes through", () => {
    const err = mapErrorFromResponse(403, {
      error: { type: "quota_exceeded", message: "Limit.", reason: "future_reason" },
    });
    expect(err.reason).toBe("future_reason");
  });
});
