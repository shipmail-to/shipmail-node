import type {
  DataMode,
  PaginationParams,
  WebhookDeliveryEventType,
  WebhookDeliveryStatus,
  WebhookEventType,
} from "./common.js";

export type Webhook = {
  readonly object: "webhook";
  readonly id: string;
  readonly url: string;
  readonly events: readonly string[];
  readonly active: boolean;
  readonly description: string | null;
  readonly mailbox_ids: readonly string[] | null;
  readonly domain_ids: readonly string[] | null;
  readonly has_authorization: boolean;
  readonly has_standard_webhooks_secret: boolean;
  readonly include_reply_text: boolean;
  readonly authenticated_senders_only: boolean;
  readonly allowed_senders: readonly string[] | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type WebhookWithSecret = Webhook & {
  readonly secret: string;
};

export type CreateWebhookParams = {
  readonly url: string;
  readonly events: readonly WebhookEventType[];
  readonly description?: string | undefined;
  readonly mailbox_ids?: readonly string[] | null | undefined;
  readonly domain_ids?: readonly string[] | null | undefined;
  /** Sent verbatim as the `Authorization` header of every delivery. Write-only. */
  readonly authorization?: string | null | undefined;
  /** A `whsec_` secret from the receiving service. Deliveries then carry Standard Webhooks signatures. Write-only. */
  readonly standard_webhooks_secret?: string | null | undefined;
  /** Add `reply_text` to `message.received` deliveries. The API key also needs `messages:read`. */
  readonly include_reply_text?: boolean | undefined;
  /** Skip `message.received` deliveries whose `sender_authenticated` is `false`. */
  readonly authenticated_senders_only?: boolean | undefined;
  /** Deliver `message.received` only from these addresses or exact domains. At most 100. */
  readonly allowed_senders?: readonly string[] | null | undefined;
};

export type UpdateWebhookParams = {
  readonly url?: string | undefined;
  readonly events?: readonly WebhookEventType[] | undefined;
  readonly description?: string | null | undefined;
  readonly active?: boolean | undefined;
  readonly mailbox_ids?: readonly string[] | null | undefined;
  readonly domain_ids?: readonly string[] | null | undefined;
  /** A string replaces the delivery `Authorization` header, `null` removes it. */
  readonly authorization?: string | null | undefined;
  /** A string replaces the Standard Webhooks signing secret, `null` removes it. */
  readonly standard_webhooks_secret?: string | null | undefined;
  /** Add `reply_text` to `message.received` deliveries. The API key also needs `messages:read`. */
  readonly include_reply_text?: boolean | undefined;
  /** Skip `message.received` deliveries whose `sender_authenticated` is `false`. */
  readonly authenticated_senders_only?: boolean | undefined;
  /** Replaces the sender list. `null` or `[]` delivers every sender again. */
  readonly allowed_senders?: readonly string[] | null | undefined;
};

export type ListWebhooksParams = PaginationParams;

export type RotateSecretResponse = {
  readonly secret: string;
  readonly previous_secret_expires_at: string;
};

export type TestWebhookResponse = {
  readonly event_id: string;
};

export type WebhookDelivery = {
  readonly object: "webhook_delivery";
  readonly id: string;
  readonly event_id: string;
  readonly event_type: WebhookDeliveryEventType;
  readonly mode: DataMode;
  readonly status: WebhookDeliveryStatus;
  readonly attempts: number;
  readonly last_status_code: number | null;
  readonly last_error: string | null;
  readonly created_at: string;
  readonly delivered_at: string | null;
};

export type WebhookDeliveryDetail = WebhookDelivery & {
  readonly payload: unknown;
  readonly next_attempt_at: string | null;
  readonly replayed_from_delivery_id: string | null;
};

export type ListDeliveriesParams = PaginationParams & {
  readonly status?: string | undefined;
  readonly event_type?: string | undefined;
};

export type WebhookEvent<T = unknown> = {
  readonly version: "2026-07-20";
  readonly event_id: string;
  readonly event_type: WebhookEventType;
  readonly created_at: string;
  readonly test: boolean;
  readonly data: T;
};
