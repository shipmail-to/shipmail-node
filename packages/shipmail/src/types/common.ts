export type ShipmailConfig = {
  readonly apiKey: string;
  readonly baseUrl?: string | undefined;
  readonly maxRetries?: number | undefined;
  readonly timeout?: number | undefined;
  readonly fetch?: typeof fetch | undefined;
  readonly defaultHeaders?: Record<string, string> | undefined;
};

export type PaginationParams = {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
};

export type PaginatedResponse<T> = {
  readonly data: readonly T[];
  readonly pagination: {
    readonly next_cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
  };
};

export type DataMode = "live" | "test";
export type SandboxOutcome = "delivered" | "bounced" | "complained";

export type ErrorType =
  | "validation_error"
  | "authentication_error"
  | "authorization_error"
  | "quota_exceeded"
  | "not_found"
  | "rate_limit_error"
  | "conflict"
  | "reconciliation_required"
  | "internal_error";

export type ApiErrorBody = {
  readonly error: {
    readonly type: ErrorType;
    readonly message: string;
    readonly request_id?: string | undefined;
    readonly details?:
      | readonly {
          readonly field: string;
          readonly message: string;
          readonly code?: string | undefined;
        }[]
      | undefined;
    readonly retry_after?: number | undefined;
    /**
     * Present only on a `reconciliation_required` error: the tracking message
     * the interrupted send attempt left behind.
     */
    readonly message_id?: string | undefined;
    /**
     * Present only on a refusal an organization owner can lift in Shipmail. One of
     * `owner_confirmation_required`, `subscription_required`, `trial_capacity` or
     * `purchased_capacity`; later servers may add values.
     */
    readonly reason?: string | undefined;
    /** Present with `reason`: the Shipmail page where the owner reviews and confirms. */
    readonly action_url?: string | undefined;
    /** Present on a `quota_exceeded` error caused by a plan, trial or fixed limit. */
    readonly limit?: ErrorLimit | undefined;
  };
};

/** The plan, trial or fixed limit that refused a request. Storage values are bytes. */
export type ErrorLimit = {
  /** What is limited, such as `mailboxes`, `sends` or `audience_subscribers`. */
  readonly resource: string;
  readonly used: number;
  readonly limit: number;
  /**
   * `trial` until the trial ends, `plan` until the plan or its add-ons grow, `fixed` for the same
   * cap on every plan. Later servers may add values.
   */
  readonly scope: string;
};

export type EmailRecipient = {
  readonly address: string;
  readonly name?: string | null | undefined;
};

export type EmailRecipientInput = EmailRecipient | string;

export const WEBHOOK_EVENT_TYPES = [
  "message.received",
  "message.sent",
  "message.delayed",
  "message.delivered",
  "message.bounced",
  "message.complained",
  "mailbox.rule_matched",
  "mailbox.export.completed",
  "mailbox.export.failed",
  "domain.verified",
  "domain.verification_failed",
  "domain.degraded",
  "org.reputation_warning",
  "org.sending_throttled",
  "org.sending_suspended",
  "org.reputation_recovered",
  "reply.overdue",
  "conversation.needs_action",
  "calendar.event_starting",
  "booking.created",
  "subscriber.added",
  "newsletter.sent",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
export const WEBHOOK_DELIVERY_EVENT_TYPES = ["webhook.test", ...WEBHOOK_EVENT_TYPES] as const;
export type WebhookDeliveryEventType = (typeof WEBHOOK_DELIVERY_EVENT_TYPES)[number];

export type StatusResponse = {
  readonly status: string;
  readonly version: string;
  readonly time: string;
  readonly request_id: string;
};

export const DOMAIN_STATUSES = ["pending", "verifying", "verified", "degraded", "failed"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const MESSAGE_STATUSES = [
  "scheduled",
  "queued",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "failed",
  "suppressed",
  "cancelled",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_SOURCES = [
  "api",
  "newsletter",
  "dashboard",
  "inbound",
  "smtp",
  "assistant",
] as const;
export type MessageSource = (typeof MESSAGE_SOURCES)[number];

export const WEBHOOK_DELIVERY_STATUSES = ["pending", "delivered", "failed"] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export type MethodOptions = {
  readonly timeout?: number | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly headers?: Record<string, string> | undefined;
  readonly idempotencyKey?: string | undefined;
};

export type OneTimeSecretMethodOptions = Omit<MethodOptions, "idempotencyKey">;
