import type {
  DataMode,
  EmailRecipientInput,
  MessageSource,
  MessageStatus,
  PaginationParams,
  SandboxOutcome,
} from "./common.js";

export type MessageRuleDisposition = {
  readonly matched_rule_ids: readonly string[];
  readonly stop_rule_id: string | null;
};

export type Message = {
  readonly object: "message";
  readonly id: string;
  readonly mailbox_id: string;
  /** @deprecated The mail server's thread ID. Still supported and unchanged; store `conversation_id`. */
  readonly thread_id: string | null;
  /** Stable Shipmail conversation identifier. Store this instead of `thread_id`. */
  readonly conversation_id: string | null;
  readonly source_rfc_message_id: string | null;
  readonly delivered_rfc_message_id: string | null;
  readonly client_reference: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
  readonly headers: readonly OutboundHeader[];
  readonly subject: string | null;
  readonly from_address: string | null;
  readonly to_addresses:
    | readonly { readonly address: string; readonly name?: string | null }[]
    | null;
  readonly cc_addresses:
    | readonly { readonly address: string; readonly name?: string | null }[]
    | null;
  readonly bcc_addresses:
    | readonly { readonly address: string; readonly name?: string | null }[]
    | null;
  readonly attachments:
    | readonly { readonly filename: string; readonly size: number; readonly content_type: string }[]
    | null;
  readonly source: MessageSource;
  readonly mode: DataMode;
  readonly status: MessageStatus;
  readonly rule_disposition: MessageRuleDisposition | null;
  readonly scheduled_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type Attachment = {
  readonly filename: string;
  readonly content: string;
  readonly content_type?: string | undefined;
};

export type StagedAttachment = {
  readonly object: "staged_attachment";
  readonly id: string;
  readonly mailbox_id: string;
  readonly filename: string;
  readonly content_type: string;
  readonly size: number;
  readonly sha256: string;
  readonly expires_at: string;
};

export type StageAttachmentParams = {
  readonly filename: string;
  readonly data: ArrayBuffer | Uint8Array;
  readonly content_type?: string | undefined;
};

export type PrepareStagedAttachmentUploadParams = {
  readonly filename: string;
  readonly content_type: string;
  readonly size: number;
  readonly sha256: string;
};

export type StagedAttachmentUpload = {
  readonly object: "staged_attachment_upload";
  readonly mailbox_id: string;
  readonly filename: string;
  readonly content_type: string;
  readonly size: number;
  readonly sha256: string;
  readonly upload_url: string;
  readonly expires_at: string;
};

export type OutboundHeader = {
  readonly name: string;
  readonly value: string;
};

export type MessageMetadata = Readonly<Record<string, string | number | boolean | null>>;

export type SendMessageParams = {
  readonly mailbox_id?: string | undefined;
  /**
   * Sending mailbox: `hello@example.com` or `Acme Support <hello@example.com>`.
   * For a transactional sender, pass the bare sender address. Shipmail adds its name and Reply-To.
   */
  readonly from?: string | undefined;
  readonly to: readonly EmailRecipientInput[];
  readonly cc?: readonly EmailRecipientInput[] | undefined;
  readonly bcc?: readonly EmailRecipientInput[] | undefined;
  readonly reply_to?: EmailRecipientInput | undefined;
  readonly subject: string;
  readonly html?: string | undefined;
  readonly text?: string | undefined;
  readonly in_reply_to?: string | undefined;
  readonly references?: readonly string[] | undefined;
  readonly attachments?: readonly Attachment[] | undefined;
  readonly staged_attachment_ids?: readonly string[] | undefined;
  readonly client_reference?: string | undefined;
  readonly metadata?: MessageMetadata | undefined;
  readonly source_rfc_message_id?: string | undefined;
  readonly headers?: readonly OutboundHeader[] | undefined;
  readonly scheduled_at?: string | undefined;
  readonly track_reply?: boolean | undefined;
  readonly sandbox_outcome?: SandboxOutcome | undefined;
};

export type ScheduledMessageRecipient = {
  readonly address: string;
  readonly name?: string | null;
};

export type ScheduledMessageAttachment = {
  readonly filename: string;
  readonly size: number;
  readonly content_type: string;
};

export type ScheduledMessageUploadedAttachment = {
  readonly blob_id: string;
  readonly filename: string;
  readonly content_type: string;
  readonly size: number;
};

export type ScheduledMessage = {
  readonly object: "scheduled_message";
  readonly id: string;
  readonly scheduled_message_id: string;
  // `settling`: a send attempt may already have gone out and is being checked; the message cannot
  // be updated or cancelled until that resolves. Absent from servers older than this field.
  readonly status?: "scheduled" | "settling" | undefined;
  readonly kind: "scheduled" | "undo";
  readonly mailbox_id: string;
  readonly mailbox_address: string;
  readonly from_address: string;
  readonly identity_id: string;
  readonly mode: DataMode;
  readonly subject: string;
  readonly to: readonly ScheduledMessageRecipient[];
  readonly cc: readonly ScheduledMessageRecipient[];
  readonly bcc: readonly ScheduledMessageRecipient[];
  readonly attachments: readonly ScheduledMessageAttachment[];
  readonly scheduled_at: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly last_error: string | null;
  readonly draft_email_id?: string | undefined;
  readonly from_name?: string | undefined;
  readonly text?: string | undefined;
  readonly html?: string | undefined;
  readonly in_reply_to?: string | null | undefined;
  readonly references?: readonly string[] | undefined;
  readonly uploaded_attachments?: readonly ScheduledMessageUploadedAttachment[] | undefined;
};

export type ScheduledMessageList = {
  readonly object: "scheduled_message_list";
  readonly data: readonly ScheduledMessage[];
  readonly total: number;
};

export type ListScheduledMessagesParams = {
  readonly include_held?: boolean | undefined;
  readonly search?: string | undefined;
  readonly limit?: number | undefined;
};

export type UpdateScheduledMessageParams = {
  readonly to: readonly EmailRecipientInput[];
  readonly cc?: readonly EmailRecipientInput[] | undefined;
  readonly bcc?: readonly EmailRecipientInput[] | undefined;
  readonly subject: string;
  readonly html?: string | undefined;
  readonly text?: string | undefined;
  readonly in_reply_to?: string | undefined;
  readonly references?: readonly string[] | undefined;
  readonly staged_attachment_ids?: readonly string[] | undefined;
  readonly scheduled_at: string;
};

export type ListMessagesParams = PaginationParams &
  (
    | { readonly mailbox_id: string; readonly client_reference?: string | undefined }
    | { readonly mailbox_id?: string | undefined; readonly client_reference: string }
  );

export type MessageAnalytics = {
  readonly object: "message_analytics";
  readonly id: string;
  readonly mailbox_id: string;
  /** @deprecated The mail server's thread ID. Still supported and unchanged; store `conversation_id`. */
  readonly thread_id: string | null;
  /** Stable Shipmail conversation identifier. Store this instead of `thread_id`. */
  readonly conversation_id: string | null;
  readonly client_reference: string | null;
  readonly direction: "inbound" | "outbound";
  readonly contact_addresses: readonly string[];
  readonly recipient_count: number;
  readonly attachment_count: number;
  readonly source: MessageSource;
  readonly mode: DataMode;
  readonly status: MessageStatus;
  readonly scheduled_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type ListMessageAnalyticsParams = PaginationParams & {
  readonly updated_after?: string | undefined;
  readonly updated_before?: string | undefined;
};

export type MessageAnalyticsPage = {
  readonly data: readonly MessageAnalytics[];
  readonly pagination: {
    readonly next_cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
    readonly snapshot_at: string;
  };
};

export type ReplyToMessageParams = {
  readonly html?: string | undefined;
  readonly text?: string | undefined;
  readonly to: readonly EmailRecipientInput[];
  readonly cc?: readonly EmailRecipientInput[] | undefined;
  readonly client_reference?: string | undefined;
  readonly metadata?: MessageMetadata | undefined;
  readonly source_rfc_message_id?: string | undefined;
  readonly headers?: readonly OutboundHeader[] | undefined;
  readonly scheduled_at?: string | undefined;
  readonly track_reply?: boolean | undefined;
  readonly sandbox_outcome?: SandboxOutcome | undefined;
};

export type InjectSandboxInboundParams = {
  readonly from: EmailRecipientInput;
  readonly to?: readonly EmailRecipientInput[] | undefined;
  readonly cc?: readonly EmailRecipientInput[] | undefined;
  readonly subject: string;
  readonly text?: string | undefined;
  readonly html?: string | undefined;
  readonly message_id?: string | undefined;
  readonly in_reply_to?: string | undefined;
  readonly references?: readonly string[] | undefined;
  readonly received_at?: string | undefined;
  readonly headers?: readonly OutboundHeader[] | undefined;
};
