import type { EmailRecipientInput, PaginationParams } from "./common.js";
import type { Message } from "./message.js";

export type AutoReply = {
  readonly enabled: boolean;
  readonly subject: string | null;
  readonly body: string | null;
  readonly from_date: string | null;
  readonly to_date: string | null;
};

export type MailboxSuspensionReason = "billing" | "manual" | "security" | "abuse";

export type Mailbox = {
  readonly object: "mailbox";
  readonly id: string;
  readonly domain_id: string;
  readonly address: string;
  readonly display_name: string | null;
  readonly suspended_at: string | null;
  readonly suspension_reasons: readonly MailboxSuspensionReason[];
  readonly auto_reply: AutoReply;
  /** Hold suspicious or unscannable message content from non-review API credentials. */
  readonly agent_security_hold: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export type MailboxExportStatus = "pending" | "processing" | "completed" | "failed" | "expired";

export type MailboxExportErrorCode = "source_unavailable" | "snapshot_changed" | "export_failed";

export type MailboxExport = {
  readonly object: "mailbox_export";
  readonly id: string;
  readonly mailbox_id: string;
  readonly status: MailboxExportStatus;
  readonly format: "zip";
  readonly format_version: number;
  readonly file_size: number | null;
  readonly message_count: number | null;
  readonly folder_count: number | null;
  readonly error_code: MailboxExportErrorCode | null;
  readonly download_url: string | null;
  readonly download_url_expires_at: string | null;
  readonly expires_at: string | null;
  readonly created_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
};

export type MailboxAppPasswordState =
  | "pending_create"
  | "active"
  | "pending_revoke"
  | "revoked"
  | "failed";

export type MailboxAppPasswordPurpose = "operator_client";

export type MailboxAppPassword = {
  readonly object: "mailbox_app_password";
  readonly id: string;
  readonly mailbox_id: string;
  readonly name: string;
  readonly state: MailboxAppPasswordState;
  readonly purpose: MailboxAppPasswordPurpose;
  readonly expires_at: string | null;
  readonly allowed_cidrs: readonly string[];
  readonly last_used_at: string | null;
  readonly created_at: string;
  readonly revoked_at: string | null;
};

export type CreatedMailboxAppPassword = MailboxAppPassword & {
  readonly secret: string;
};

export type MailboxAppPasswordList = {
  readonly object: "list";
  readonly data: readonly MailboxAppPassword[];
};

export type CreateMailboxAppPasswordParams = {
  readonly name: string;
  readonly expires_at?: string | undefined;
  readonly allowed_cidrs?: readonly string[] | undefined;
};

export type MailboxFolder = {
  readonly object: "mailbox_folder";
  readonly id: string;
  readonly name: string;
  readonly parent_id: string | null;
  readonly role: string | null;
  readonly kind: "custom" | "system";
  readonly total_emails: number;
  readonly unread_emails: number;
  readonly unread_threads: number;
  readonly sort_order: number;
};

export type MailboxFolders = {
  readonly object: "mailbox_folders";
  readonly mailbox_id: string;
  readonly address: string;
  readonly data: readonly MailboxFolder[];
};

export type MailboxIdentity = {
  readonly object: "mailbox_identity";
  readonly id: string;
  readonly name: string;
  readonly email: string;
};

export type MailboxIdentities = {
  readonly object: "mailbox_identities";
  readonly mailbox_id: string;
  readonly address: string;
  readonly data: readonly MailboxIdentity[];
};

export type InboxEmailHeader = {
  readonly name: string | null;
  readonly email: string | null;
};

export type InboxKeyword = "$flagged" | "$seen" | "$draft" | "$answered" | "$forwarded";

export type InboxAttachment = {
  readonly part_id: string;
  readonly blob_id: string;
  readonly name: string | null;
  readonly content_type: string;
  readonly size: number;
  readonly download_path: string;
};

export type InboxMessageSecurityRiskCode =
  | "instruction_override"
  | "prompt_or_secret_disclosure"
  | "role_override"
  | "covert_instruction"
  | "hidden_html_instruction"
  | "context_exfiltration"
  | "oversized_untrusted_content"
  | "unauthorized_action";

export type InboxMessageSecurity = {
  readonly status: "flagged" | "not_flagged" | "not_scanned";
  readonly risk_codes: readonly InboxMessageSecurityRiskCode[];
  readonly scanner: "pattern_v1";
  /** Exact hash to pass back when releasing the currently fetched message snapshot. */
  readonly content_sha256: string;
  readonly review: {
    readonly decision: "released";
    readonly released_at: string;
    readonly released_by: "user" | "api_key";
  } | null;
};

export type InboxBodyPart = {
  readonly part_id: string;
  readonly type: string;
};

export type InboxBodyValue = {
  readonly value: string;
  readonly is_encoding_problem: boolean;
};

export type EmailAuthVerdict =
  | "pass"
  | "fail"
  | "softfail"
  | "neutral"
  | "none"
  | "temperror"
  | "permerror"
  | "policy"
  | "unknown";

export type EmailAuthenticationResults = {
  readonly spf: EmailAuthVerdict;
  readonly dkim: EmailAuthVerdict;
  readonly dmarc: EmailAuthVerdict;
  readonly spam: {
    readonly isSpam: boolean | null;
    readonly scoreMilli: number | null;
  };
  readonly raw: {
    readonly authenticationResults: string | null;
    readonly receivedSpf: string | null;
    readonly spamStatus: string | null;
  };
};

export type InboxMessage = {
  readonly object: "inbox_message";
  readonly id: string;
  /** @deprecated The mail server's thread ID. Still supported and unchanged; store `conversation_id`. */
  readonly thread_id: string;
  /** Stable Shipmail conversation identifier. Store this instead of `thread_id`. */
  readonly conversation_id: string | null;
  readonly mailbox_id: string;
  readonly address: string;
  readonly folder_ids: readonly string[];
  readonly keywords: Readonly<Record<string, boolean>>;
  readonly from: readonly InboxEmailHeader[] | null;
  readonly to: readonly InboxEmailHeader[] | null;
  readonly subject: string | null;
  readonly received_at: string;
  readonly preview: string;
  readonly has_attachment: boolean;
  readonly size: number;
  readonly authentication_results: EmailAuthenticationResults | null;
  readonly security: InboxMessageSecurity;
};

export type InboxMessageSecurityReview = {
  readonly object: "inbox_message_security_review";
  readonly mailbox_id: string;
  readonly message_id: string;
  readonly security: InboxMessageSecurity;
};

export type InboxFullMessage = Omit<InboxMessage, "object"> & {
  readonly object: "inbox_message_full";
  readonly cc: readonly InboxEmailHeader[] | null;
  readonly reply_to: readonly InboxEmailHeader[] | null;
  readonly message_id: readonly string[] | null;
  readonly in_reply_to: readonly string[] | null;
  readonly references: readonly string[] | null;
  readonly body_values: Readonly<Record<string, InboxBodyValue>>;
  readonly text_body: readonly InboxBodyPart[];
  readonly html_body: readonly InboxBodyPart[];
  readonly attachments: readonly InboxAttachment[];
  /** What the sender newly wrote, without quoted history or signature. `null` when nothing is left. */
  readonly reply_text: string | null;
};

export type InboxMessages = {
  readonly object: "inbox_messages";
  readonly mailbox_id: string;
  readonly address: string;
  readonly data: readonly InboxFullMessage[];
  /** Messages in Junk that match the other filters, when a folder filter leaves Junk out. Null otherwise. */
  readonly junk_total: number | null;
  readonly pagination: {
    readonly limit: number;
    readonly total: number;
    readonly has_more: boolean;
    readonly next_cursor: string | null;
  };
};

export type InboxThreadAttentionState =
  | "needs_reply"
  | "waiting_on_them"
  | "done"
  | "follow_up_due"
  | "delivery_failed"
  | "no_action";

export type InboxThreadSummary = {
  readonly object: "inbox_thread_summary";
  readonly id: string;
  /** @deprecated The mail server's thread ID. Still supported and unchanged; store `conversation_id`. */
  readonly thread_id: string;
  /** Stable Shipmail conversation identifier. Store this instead of `thread_id`. */
  readonly conversation_id: string;
  readonly attention_state: InboxThreadAttentionState;
  readonly version: number;
  readonly attention_since: string | null;
  readonly done_at: string | null;
  readonly follow_up_at: string | null;
  readonly assigned_member_id: string | null;
  readonly subject: string | null;
  readonly latest_from_address: string | null;
  readonly message_count: number;
  readonly first_message_at: string;
  readonly last_message_at: string;
  readonly latest_message_id: string | null;
  readonly latest_email_id: string | null;
  readonly latest_inbound_message_id: string | null;
  readonly latest_inbound_email_id: string | null;
  readonly latest_inbound_at: string | null;
  readonly latest_outbound_message_id: string | null;
  readonly latest_outbound_email_id: string | null;
  readonly latest_outbound_at: string | null;
};

export type InboxThreads = {
  readonly object: "inbox_threads";
  readonly mailbox_id: string;
  readonly data: readonly InboxThreadSummary[];
  readonly summary: Readonly<Record<InboxThreadAttentionState, number>>;
  readonly pagination: {
    readonly limit: number;
    readonly has_more: boolean;
    readonly next_cursor: string | null;
    readonly snapshot_at: string;
  };
};

export type InboxThreadAttentionResult = {
  readonly object: "inbox_thread_attention";
  readonly id: string;
  /** @deprecated The mail server's thread ID. Still supported and unchanged; store `conversation_id`. */
  readonly thread_id: string;
  /** Stable Shipmail conversation identifier. Store this instead of `thread_id`. */
  readonly conversation_id: string;
  readonly attention_state: InboxThreadAttentionState;
  readonly version: number;
  readonly attention_since: string | null;
  readonly done_at: string | null;
  readonly follow_up_at: string | null;
};

export type InboxReplyDraft = {
  readonly object: "inbox_reply_draft";
  readonly id: string;
  readonly mailbox_id: string;
  /** @deprecated The mail server's thread ID. Still supported and unchanged; store `conversation_id`. */
  readonly thread_id: string;
  /** Stable Shipmail conversation identifier. Store this instead of `thread_id`. */
  readonly conversation_id: string;
  readonly based_on_message_id: string | null;
  readonly expected_version: number;
  readonly reply_mode: "reply" | "reply_all";
  readonly status: "draft" | "sending" | "sent" | "invalidated" | "failed";
  /** Empty, like `cc`, once the stored draft no longer exists (after a send or cleanup). */
  readonly to: readonly { readonly address: string; readonly name: string | null }[];
  readonly cc: readonly { readonly address: string; readonly name: string | null }[];
  /** Stored content after sanitisation. Null once the stored draft no longer exists. */
  readonly subject: string | null;
  readonly html: string | null;
  readonly text: string | null;
  /** Hash of the complete canonical subject/text/HTML snapshot. Null when content is unavailable. */
  readonly content_sha256: string | null;
  readonly sent_message_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly sent_at: string | null;
};

/** Returned by create and update. Lists formatting the HTML sanitiser dropped, such as `table`. */
export type InboxReplyDraftWrite = InboxReplyDraft & {
  readonly removed_formatting: readonly string[];
};

export type InboxReplyDraftList = {
  readonly object: "list";
  readonly data: readonly InboxReplyDraft[];
};

export type InboxDraftRecipient = { readonly address: string; readonly name: string | null };

export type InboxDraft = {
  readonly object: "inbox_draft";
  /** Inbox message ID of the saved draft. Read it with `getInboxMessage`. */
  readonly id: string;
  readonly mailbox_id: string;
  readonly from: InboxDraftRecipient;
  readonly to: readonly InboxDraftRecipient[];
  readonly cc: readonly InboxDraftRecipient[];
  readonly bcc: readonly InboxDraftRecipient[];
  readonly subject: string;
  /** Formatting the HTML sanitiser dropped, such as `table` or `h4`. */
  readonly removed_formatting: readonly string[];
  readonly created_at: string;
};

export type InboxReplyDraftSend = {
  readonly object: "inbox_reply_draft_send";
  readonly draft_id: string;
  readonly status: InboxReplyDraft["status"];
  readonly message: Message;
};

export type InboxThread = {
  readonly object: "inbox_thread";
  readonly mailbox_id: string;
  readonly address: string;
  /** @deprecated The mail server's thread ID. Still supported and unchanged; store `conversation_id`. */
  readonly thread_id: string;
  /** Stable Shipmail conversation identifier. Store this instead of `thread_id`. */
  readonly conversation_id: string | null;
  /** Current conversation version. Pass it as `expected_version` to `createInboxReplyDraft`. */
  readonly version: number | null;
  readonly data: readonly InboxFullMessage[];
};

export type InboxMessageAction = {
  readonly object: "inbox_message_action";
  readonly mailbox_id: string;
  readonly address: string;
  readonly message_id: string;
  readonly ok: true;
  /** Folders and keywords read back after the change. Null when the message could not be read. */
  readonly folder_ids: readonly string[] | null;
  readonly keywords: Readonly<Record<string, boolean>> | null;
};

export type MailboxRuleMatchMode = "all" | "any";

export type MailboxRuleCondition =
  | {
      readonly type:
        | "from_is"
        | "from_contains"
        | "recipient_is"
        | "recipient_contains"
        | "plus_tag_is"
        | "subject_contains";
      readonly value: string;
    }
  | { readonly type: "has_attachment" | "list_unsubscribe_exists" }
  | {
      readonly type: "group";
      readonly match_mode: MailboxRuleMatchMode;
      readonly conditions: readonly MailboxRuleCondition[];
    };

export type MailboxRuleMoveTarget =
  | { readonly kind: "system"; readonly role: "inbox" | "archive" | "junk" | "trash" }
  | { readonly kind: "custom"; readonly folder_id: string };

export type MailboxRuleAction =
  | { readonly type: "move"; readonly target: MailboxRuleMoveTarget }
  | { readonly type: "mark_read" }
  | { readonly type: "star" }
  | { readonly type: "send_webhook" };

export type MailboxRule = {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly position: number;
  readonly match_mode: MailboxRuleMatchMode;
  readonly stop: boolean;
  readonly conditions: readonly MailboxRuleCondition[];
  readonly actions: readonly MailboxRuleAction[];
};

export type MailboxRuleFolder = {
  readonly id: string;
  readonly name: string;
  readonly parent_id: string | null;
  readonly role: string | null;
  readonly kind: "custom" | "system";
};

export type MailboxRules = {
  readonly object: "mailbox_rules";
  readonly mailbox_id: string;
  readonly address: string;
  readonly rules: readonly MailboxRule[];
  readonly folders: readonly MailboxRuleFolder[];
};

export type MailboxForwarding = {
  readonly object: "mailbox_forwarding";
  readonly id: string;
  readonly mailbox_id: string;
  readonly destination: string;
  readonly sender: string | null;
  readonly recipient: string | null;
  readonly status: "pending" | "active";
  readonly verification_sent_at: string | null;
  readonly verified_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type MailboxForwardingList = {
  readonly object: "mailbox_forwarding_list";
  readonly mailbox_id: string;
  readonly data: readonly MailboxForwarding[];
};

export type CreateMailboxForwardingParams = {
  readonly destination: string;
  readonly sender?: string | null | undefined;
  readonly recipient?: string | null | undefined;
};

type CreateMailboxBaseParams = {
  readonly domain_id: string;
  readonly address: string;
  readonly display_name?: string | undefined;
};

export type CreateMailboxParams = CreateMailboxBaseParams &
  (
    | { readonly password: string; readonly generate_password?: never }
    | { readonly password?: never; readonly generate_password: true }
  );

export type UpdateMailboxParams = {
  readonly display_name?: string | null | undefined;
  readonly agent_security_hold?: boolean | undefined;
};

export type CreateMailboxFolderParams = {
  readonly name: string;
  readonly parent_id: string | null;
};

export type UpdateMailboxFolderParams = {
  readonly name: string;
};

export type ResetMailboxPasswordParams = {
  readonly password: string;
};

export type ListMailboxesParams = PaginationParams & {
  readonly domain_id?: string | undefined;
};

export type ListInboxMessagesParams = {
  readonly folder_id?: string | undefined;
  readonly folder_role?:
    | "inbox"
    | "starred"
    | "sent"
    | "drafts"
    | "archive"
    | "junk"
    | "trash"
    | undefined;
  readonly search_text?: string | undefined;
  /** Matches the From name or address. */
  readonly from?: string | undefined;
  /** Matches the To recipients by name or address. Cc and Bcc are not searched. */
  readonly to?: string | undefined;
  readonly subject?: string | undefined;
  /** `true` for messages with an attachment, `false` for messages without one. */
  readonly has_attachment?: boolean | undefined;
  readonly cursor?: string | undefined;
  readonly after?: string | undefined;
  readonly before?: string | undefined;
  readonly limit?: number | undefined;
  readonly has_keyword?: InboxKeyword | undefined;
  readonly not_keyword?: InboxKeyword | undefined;
};

export type ListInboxThreadsParams = {
  readonly attention_state?: InboxThreadAttentionState | undefined;
  readonly sort_by?: "attention_since" | "last_message_at" | undefined;
  readonly order?: "asc" | "desc" | undefined;
  readonly after?: string | undefined;
  readonly before?: string | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
};

export type CreateInboxDraftParams = {
  readonly to: readonly EmailRecipientInput[];
  readonly cc?: readonly EmailRecipientInput[] | undefined;
  readonly bcc?: readonly EmailRecipientInput[] | undefined;
  readonly subject?: string | undefined;
  readonly text?: string | undefined;
  readonly html?: string | undefined;
};

export type CreateInboxReplyDraftParams = {
  readonly text?: string | undefined;
  readonly html?: string | undefined;
  readonly reply_mode?: "reply" | "reply_all" | undefined;
  readonly expected_version: number;
};

/** The new body replaces the old one. HTML alone derives the text part; text alone makes a plain-text draft. */
export type UpdateInboxReplyDraftParams = {
  readonly text?: string | undefined;
  readonly html?: string | undefined;
};

export type UpdateInboxThreadAttentionParams = {
  readonly done?: boolean | undefined;
  readonly follow_up_at?: string | null | undefined;
  readonly expected_version: number;
};

export type DownloadInboxAttachmentParams = {
  readonly blob_id: string;
  /** Required when API-agent security hold is enabled. */
  readonly message_id?: string | undefined;
  readonly name?: string | undefined;
};

export type ReleaseInboxMessageSecurityParams = {
  readonly decision: "release";
  readonly reason: string;
  readonly expected_content_sha256: string;
};

export type UpdateInboxMessageParams = {
  readonly read?: boolean | undefined;
  readonly starred?: boolean | undefined;
};

export type MoveInboxMessageParams = {
  readonly from_folder_id?: string | undefined;
  readonly target_role?: "inbox" | "archive" | "junk" | "trash" | undefined;
  readonly target_folder_id?: string | undefined;
};

export type UpdateAutoReplyParams = {
  readonly enabled: boolean;
  readonly subject?: string | null | undefined;
  readonly body?: string | null | undefined;
  readonly from_date?: string | null | undefined;
  readonly to_date?: string | null | undefined;
};

export type MailboxDeliveryDestination = {
  readonly id: string;
  readonly address: string;
  readonly display_name: string | null;
  readonly status: "available" | "out_of_office" | "suspended" | "archived" | "unavailable";
  readonly out_of_office_end_at: string | null;
  readonly responsible_member_count: number;
  readonly push_ready_member_count: number;
};

export type MailboxDeliveryRouting = {
  readonly object: "mailbox_delivery_routing";
  readonly mailbox_id: string;
  readonly source_address: string;
  readonly destinations: readonly MailboxDeliveryDestination[];
} & (
  | { readonly mode: "keep" }
  | {
      readonly mode: "fixed";
      readonly destination_mailbox_id: string;
      readonly fallback_mailbox_id: string;
      readonly activation_state: "pending" | "active" | "failed";
      readonly activation_error: string | null;
    }
  | {
      readonly mode: "round_robin";
      readonly destination_mailbox_ids: readonly string[];
      readonly fallback_mailbox_id: string;
      readonly activation_state: "pending" | "active" | "failed";
      readonly activation_error: string | null;
    }
);

export type UpdateMailboxDeliveryRoutingParams =
  | { readonly mode: "keep" }
  | {
      readonly mode: "fixed";
      readonly destination_mailbox_id: string;
      readonly fallback_mailbox_id: string;
    }
  | {
      readonly mode: "round_robin";
      readonly destination_mailbox_ids: readonly string[];
      readonly fallback_mailbox_id: string;
    };

export type UpdateMailboxRulesParams = {
  readonly rules: readonly MailboxRule[];
};
