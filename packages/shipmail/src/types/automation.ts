export type AutomationTrigger =
  | { readonly type: "email_received"; readonly mailbox_ids: readonly string[] }
  | { readonly type: "scheduled"; readonly cron: string; readonly time_zone: string }
  | { readonly type: "manual"; readonly mailbox_ids: readonly string[] }
  | {
      readonly type: "thread_state";
      readonly mailbox_ids: readonly string[];
      readonly state: "no_reply_after";
      readonly duration_minutes: number;
    };

export type AutomationCondition =
  | { readonly type: "sender_address"; readonly addresses: readonly string[] }
  | { readonly type: "sender_domain"; readonly domains: readonly string[] }
  | { readonly type: "subject_contains"; readonly values: readonly string[] }
  | { readonly type: "has_attachment"; readonly value: boolean }
  | {
      readonly type: "semantic_positive_match";
      readonly instruction: string;
      readonly minimum_confidence: number;
    };

export type AutomationAction =
  | { readonly type: "create_reply_draft"; readonly instruction: string }
  | { readonly type: "reply_to_trigger_sender"; readonly instruction: string }
  | { readonly type: "archive_trigger_message" }
  | {
      readonly type: "move_trigger_message";
      readonly mailbox_id: string;
      readonly destination_folder_id: string;
    }
  | { readonly type: "set_trigger_read_state"; readonly is_read: boolean }
  | { readonly type: "set_trigger_star_state"; readonly is_starred: boolean }
  | {
      readonly type: "generate_mail_report";
      readonly metric: "received" | "sent" | "unread";
      readonly lookback_minutes: number;
    };

export type AutomationDefinition = {
  readonly trigger: AutomationTrigger;
  readonly conditions: readonly AutomationCondition[];
  readonly actions: readonly AutomationAction[];
  readonly mode: "draft" | "send";
  readonly scope: {
    readonly mailbox_ids: readonly string[];
    readonly calendar_addresses: readonly string[];
  };
};

export type AutomationStatus = "active" | "paused" | "disabled";
export type AutomationRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "degraded"
  | "cancelled"
  | "skipped";

export type AutomationRunSummary = {
  readonly object: "automation_run";
  readonly id: string;
  readonly status: AutomationRunStatus;
  readonly error_code: string | null;
  readonly created_at: string;
};

export type AutomationRun = {
  readonly object: "automation_run";
  readonly id: string;
  readonly automation_id: string;
  readonly status: "queued";
};

/**
 * Why an automation would not run, in the order they are checked:
 * - `automation_not_active`: its status is not active.
 * - `no_active_version`: it has no active version.
 * - `invalid_definition`: the stored version no longer validates.
 * - `policy_version_outdated`: the active version was saved under an older Assistant policy; save it again.
 * - `trigger_mailbox_outside_scope`: the trigger watches a mailbox the scope leaves out; a run on mail from it fails.
 * - `owner_unavailable`: the person who owns it lost access.
 * - `message_not_live`, `mailbox_not_in_trigger`, `message_in_junk`: only in a test result, about the message.
 * - `models_disabled`: AI models are off for the organization or the platform, and it uses a semantic condition or writes replies.
 * - `model_budget_exhausted`: the AI budget is used up.
 */
export type AutomationBlockedReason =
  | "automation_not_active"
  | "no_active_version"
  | "invalid_definition"
  | "policy_version_outdated"
  | "trigger_mailbox_outside_scope"
  | "owner_unavailable"
  | "message_not_live"
  | "mailbox_not_in_trigger"
  | "message_in_junk"
  | "models_disabled"
  | "model_budget_exhausted";

/**
 * Why a Send-mode automation runs, but writes drafts instead of sending:
 * - `automatic_send_disabled`: automatic sending is off for the organization.
 * - `writing_style_required`: the writing style it drafts with (pinned when it was saved) has not passed its check.
 */
export type AutomationSendDegradedReason = "automatic_send_disabled" | "writing_style_required";

export type Automation = {
  readonly object: "automation";
  readonly id: string;
  readonly name: string;
  readonly status: AutomationStatus;
  readonly version_id: string;
  readonly version: number;
  readonly definition: AutomationDefinition;
  readonly last_run: AutomationRunSummary | null;
  readonly next_run_at: string | null;
  /** True when `blocked_reasons` is empty: it would run now. */
  readonly runnable: boolean;
  readonly blocked_reasons: readonly AutomationBlockedReason[];
  /** Runs, but writes drafts instead of sending. Empty unless a Send-mode automation would only draft. */
  readonly send_degraded_reasons: readonly AutomationSendDegradedReason[];
  readonly created_at: string;
  readonly updated_at: string;
};

export type TestAutomationParams = {
  readonly mailbox_id: string;
  /** An inbox message id in that mailbox. */
  readonly message_id: string;
};

export type AutomationTestCondition = {
  readonly index: number;
  readonly type: AutomationCondition["type"];
  /** Null when the condition was not evaluated. */
  readonly matched: boolean | null;
  /** The classifier's confidence for a semantic condition, else null. */
  readonly confidence: number | null;
  readonly not_evaluated_reason:
    | "earlier_condition_failed"
    | "models_disabled"
    | "model_budget_exhausted"
    | "classifier_failed"
    | null;
};

/** A dry run of an automation on one stored message. Nothing is changed, queued or sent. */
export type AutomationTest = {
  readonly object: "automation_test";
  readonly automation_id: string;
  readonly mailbox_id: string;
  readonly message_id: string;
  readonly runnable: boolean;
  readonly blocked_reasons: readonly AutomationBlockedReason[];
  /** Runs, but writes drafts instead of sending. */
  readonly send_degraded_reasons: readonly AutomationSendDegradedReason[];
  readonly conditions: readonly AutomationTestCondition[];
  /** Null when a condition could not be evaluated. */
  readonly conditions_matched: boolean | null;
  readonly would_run: boolean;
  readonly mode: "draft" | "send";
  readonly actions: readonly { readonly index: number; readonly type: AutomationAction["type"] }[];
  /** Classifier calls this test made. They count against the AI budget. */
  readonly model_calls: number;
};

export type CreateAutomationParams = {
  readonly name: string;
  readonly definition: AutomationDefinition;
};

export type UpdateAutomationParams = {
  readonly name?: string | undefined;
  readonly definition?: AutomationDefinition | undefined;
  readonly status?: AutomationStatus | undefined;
};

export type ListAutomationsResponse = { readonly data: readonly Automation[] };
