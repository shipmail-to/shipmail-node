import type { PaginationParams } from "./common.js";

export type MergeFields = Record<string, string | number | boolean | null>;

export type SubscriberStatus =
  | "subscribed"
  | "pending"
  | "unsubscribed"
  | "bounced"
  | "complained"
  | "suppressed"
  | "transactional_only"
  /** Stopped reading and did not answer the last-chance email. Newsletters skip them. */
  | "dormant";

export type SubscriberOutcome =
  | "created"
  | "updated"
  | "skipped_not_mailable"
  | "skipped_invalid"
  | "skipped_cap"
  | "skipped_quota";

export type Audience = {
  readonly object: "audience";
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly member_count: number;
  readonly subscribed_count: number;
  readonly consent_source: string | null;
  readonly feed_enabled: boolean;
  /** Atom feed URL, or null when the feed is disabled. Anyone with this URL can read the feed. */
  readonly feed_url: string | null;
  /** List cleanup: cold subscribers get one last-chance email instead of a newsletter. */
  readonly cleanup_enabled: boolean;
  /** Tracked newsletters ignored in a row before a subscriber counts as cold, from 2 to 100. */
  readonly cleanup_ignored_issues: number;
  /** Days without a sign of life before a subscriber counts as cold, from 30 to 3650. */
  readonly cleanup_inactive_days: number;
  readonly created_at: string;
  readonly updated_at: string;
};

export type AudienceFeed = {
  readonly object: "audience_feed";
  readonly audience_id: string;
  readonly enabled: boolean;
  readonly title: string | null;
  readonly subtitle: string | null;
  readonly site_url: string | null;
  readonly canonical_url: string | null;
  readonly author_name: string | null;
  readonly icon_url: string | null;
  readonly entry_limit: number | null;
  /** Atom feed URL, or null when the feed is disabled. Anyone with this URL can read the feed. */
  readonly url: string | null;
  readonly updated_at: string;
};

export type Subscriber = {
  readonly object: "subscriber";
  readonly id: string;
  readonly audience_id: string;
  readonly email_address: string;
  readonly display_name: string | null;
  readonly status: SubscriberStatus;
  readonly merge_fields: MergeFields;
  readonly consent_source: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type CreateAudienceParams = {
  readonly name: string;
  readonly description?: string | null | undefined;
  readonly consent_source: string;
};

export type UpdateAudienceParams = {
  readonly name?: string | undefined;
  readonly description?: string | null | undefined;
  readonly cleanup_enabled?: boolean | undefined;
  readonly cleanup_ignored_issues?: number | undefined;
  readonly cleanup_inactive_days?: number | undefined;
};

export type UpdateAudienceFeedParams = {
  readonly enabled?: boolean | undefined;
  readonly title?: string | null | undefined;
  readonly subtitle?: string | null | undefined;
  readonly site_url?: string | null | undefined;
  readonly canonical_url?: string | null | undefined;
  readonly author_name?: string | null | undefined;
  readonly icon_url?: string | null | undefined;
  readonly entry_limit?: number | null | undefined;
};

export type ListAudiencesParams = PaginationParams;

export type AddSubscriberParams = {
  readonly email_address: string;
  readonly display_name?: string | null | undefined;
  readonly merge_fields?: MergeFields | undefined;
  readonly consent_source?: string | null | undefined;
  readonly consent_ip?: string | null | undefined;
};

export type AddSubscribersBatchParams = {
  readonly subscribers: readonly AddSubscriberParams[];
};

export type UpdateSubscriberParams = {
  readonly display_name?: string | null | undefined;
  readonly merge_fields?: MergeFields | undefined;
};

export type ResubscribeSubscriberParams = {
  readonly consent_source: string;
};

export type SubscriberResult = {
  readonly email_address: string;
  readonly outcome: SubscriberOutcome;
};

export type AddSubscribersBatchResult = {
  readonly results: readonly SubscriberResult[];
};

export type ListSubscribersParams = PaginationParams & {
  readonly status?: SubscriberStatus | undefined;
  readonly email?: string | undefined;
};
