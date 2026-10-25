import type { MethodOptions } from "./common.js";

export type ReplyScanStatus = "completed";

export type ReplyScan = {
  readonly object: "reply_scan";
  readonly id: string;
  readonly mailbox_ids: readonly string[];
  readonly after: string;
  readonly before: string;
  readonly snapshot_at: string;
  readonly status: ReplyScanStatus;
  readonly candidate_count: number;
  readonly completed_at: string;
  readonly created_at: string;
};

export type ReplyScanCandidate = {
  readonly object: "reply_scan_candidate";
  readonly id: string;
  readonly mailbox_id: string;
  /** @deprecated The mail server's thread ID. Still supported and unchanged; store `conversation_id`. */
  readonly thread_id: string;
  /** Stable Shipmail conversation identifier. Store this instead of `thread_id`. */
  readonly conversation_id: string;
  /** Same value as `conversation_id`, kept for compatibility. */
  readonly tracked_thread_id: string;
  readonly latest_message_id: string | null;
  readonly latest_email_id: string | null;
  readonly latest_inbound_message_id: string | null;
  readonly latest_inbound_email_id: string | null;
  readonly version: number;
  readonly attention_since: string;
  readonly subject: string | null;
};

export type ReplyScanResults = {
  readonly object: "reply_scan_results";
  readonly scan_id: string;
  readonly data: readonly ReplyScanCandidate[];
  readonly pagination: {
    readonly limit: number;
    readonly has_more: boolean;
    readonly next_cursor: string | null;
  };
};

export type CreateReplyScanParams = {
  readonly mailbox_ids: readonly string[];
  readonly after: string;
  readonly before?: string | undefined;
};

export type ListReplyScanResultsParams = {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
};

export type ReplyScanMethodOptions = MethodOptions;
