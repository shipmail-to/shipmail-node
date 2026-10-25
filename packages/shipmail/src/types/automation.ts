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
  readonly created_at: string;
  readonly updated_at: string;
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
