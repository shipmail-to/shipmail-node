import type { EmailRecipientInput, PaginationParams, SandboxOutcome } from "./common.js";
import type { Message } from "./message.js";

export type Thread = {
  readonly object: "thread";
  readonly id: string;
  /** Stable Shipmail conversation identifier. Store this instead of `id`. */
  readonly conversation_id: string;
  readonly mailbox_id: string;
  readonly subject: string | null;
  readonly message_count: number;
  readonly latest_message: Message;
  readonly created_at: string;
  readonly updated_at: string;
};

export type ListThreadsParams = PaginationParams & {
  readonly mailbox_id: string;
};

export type GetThreadParams = PaginationParams & {
  readonly mailbox_id: string;
};

export type ReplyToThreadParams = {
  readonly mailbox_id: string;
  readonly to: readonly EmailRecipientInput[];
  readonly html?: string | undefined;
  readonly text?: string | undefined;
  readonly cc?: readonly EmailRecipientInput[] | undefined;
  readonly bcc?: readonly EmailRecipientInput[] | undefined;
  readonly scheduled_at?: string | undefined;
  readonly track_reply?: boolean | undefined;
  readonly sandbox_outcome?: SandboxOutcome | undefined;
};
