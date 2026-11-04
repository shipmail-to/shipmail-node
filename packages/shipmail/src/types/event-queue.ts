import type { PaginationParams, WebhookEventType } from "./common.js";
import type { WebhookEvent } from "./webhook.js";

export type EventQueue = {
  readonly object: "event_queue";
  readonly id: string;
  readonly events: readonly string[];
  readonly description: string | null;
  readonly mailbox_ids: readonly string[] | null;
  readonly domain_ids: readonly string[] | null;
  readonly include_reply_text: boolean;
  readonly authenticated_senders_only: boolean;
  readonly allowed_senders: readonly string[] | null;
  readonly created_at: string;
};

export type CreateEventQueueParams = {
  readonly events: readonly WebhookEventType[];
  readonly description?: string | undefined;
  readonly mailbox_ids?: readonly string[] | null | undefined;
  readonly domain_ids?: readonly string[] | null | undefined;
  /** Add `reply_text` to `message.received` events. The API key also needs `messages:read`. */
  readonly include_reply_text?: boolean | undefined;
  /** Skip `message.received` events whose `sender_authenticated` is `false`. */
  readonly authenticated_senders_only?: boolean | undefined;
  /** Queue `message.received` only from these addresses or exact domains. At most 100. */
  readonly allowed_senders?: readonly string[] | null | undefined;
};

export type ListEventQueuesParams = PaginationParams;

export type ListEventQueueEventsParams = {
  /** 1 to 100, default 50. */
  readonly limit?: number | undefined;
};

/** The oldest unacknowledged events, each exactly the envelope a webhook delivery carries. */
export type EventQueueEvents = {
  readonly data: readonly WebhookEvent[];
  readonly has_more: boolean;
};

export type AckEventQueueEventsResponse = {
  /** How many events were deleted. Unknown or already acknowledged ids are not counted. */
  readonly acknowledged: number;
};
