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

/** Why the organization may not send newsletters to the address, most decisive first. */
export type NotMailableReason =
  | {
      readonly reason: "unsubscribed";
      readonly source: "newsletter_optout";
      readonly created_at: string;
      /** The issue the reader unsubscribed from, when known. */
      readonly newsletter_id: string | null;
      /** True when the opt-out came from a test send. */
      readonly test_send: boolean;
    }
  | {
      readonly reason: "hard_bounce" | "soft_bounce" | "complaint" | "manual";
      readonly source: "suppression";
      readonly created_at: string;
      /** Null when the suppression is permanent. */
      readonly expires_at: string | null;
    };

/**
 * Why an add was `skipped_not_mailable`. `not_resubscribable_status`: the subscriber is
 * unsubscribed, bounced or complained in this audience, and only resubscribe changes that.
 */
export type SubscriberSkipReason =
  | "unsubscribed"
  | "complaint"
  | "hard_bounce"
  | "soft_bounce"
  | "manual"
  | "not_resubscribable_status";

export type SubscriberOutcome =
  | "created"
  | "updated"
  | "skipped_not_mailable"
  | "skipped_invalid"
  | "skipped_cap"
  | "skipped_quota";

/** One language's wording: a one-line subject (at most 120 characters) and a plain-text message (at most 600). */
export type EmailCopyEntry = {
  readonly subject: string;
  readonly message: string;
};

/**
 * An audience's own wording for one of its emails, per language. Only the subject and the opening
 * message change; the button, links, expiry, unsubscribe link and sender details stay fixed. A
 * language left out, and a reader whose email is in another language, get the built-in email.
 * Text may hold no links or domain names, email addresses, phone numbers or invisible characters.
 */
export type EmailCopy = {
  readonly en?: EmailCopyEntry | undefined;
  readonly fr?: EmailCopyEntry | undefined;
  readonly es?: EmailCopyEntry | undefined;
};

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
  /** Whether new issues for this audience start with a View in browser link. */
  readonly view_in_browser_default: boolean;
  /** List cleanup: cold subscribers get one last-chance email instead of a newsletter. */
  readonly cleanup_enabled: boolean;
  /** Tracked newsletters ignored in a row before a subscriber counts as cold, from 2 to 100. */
  readonly cleanup_ignored_issues: number;
  /** Days without a sign of life before a subscriber counts as cold, from 30 to 3650. */
  readonly cleanup_inactive_days: number;
  /** The double opt-in confirmation email's wording, or null for the built-in wording. */
  readonly confirmation_email_copy: EmailCopy | null;
  /** The list-cleanup last-chance email's wording, or null for the built-in wording. */
  readonly last_chance_email_copy: EmailCopy | null;
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
  /** Per audience. `mailable` reports the organization-wide block. */
  readonly status: SubscriberStatus;
  /** Whether the organization may send newsletters to the address now. */
  readonly mailable: boolean;
  readonly not_mailable_reasons: readonly NotMailableReason[];
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
  /** Whether new issues for this audience start with a View in browser link. */
  readonly view_in_browser_default?: boolean | undefined;
  readonly cleanup_enabled?: boolean | undefined;
  readonly cleanup_ignored_issues?: number | undefined;
  readonly cleanup_inactive_days?: number | undefined;
  /**
   * Replaces the confirmation email's wording; `null` or `{}` clears it. Adding or changing text
   * needs a paid plan and newsletter sending in good standing (403 otherwise).
   */
  readonly confirmation_email_copy?: EmailCopy | null | undefined;
  /** Replaces the last-chance email's wording, with the same rules. */
  readonly last_chance_email_copy?: EmailCopy | null | undefined;
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

export type ResendSubscriberConfirmationParams = {
  readonly subscriber_ids?: readonly string[] | undefined;
};

export type ConfirmationResendSkipped = {
  readonly not_found: number;
  readonly not_pending: number;
  readonly too_old: number;
  readonly resend_limit: number;
  readonly recently_sent: number;
};

export type ConfirmationResend = {
  readonly object: "confirmation_resend";
  readonly audience_id: string;
  readonly sent: number;
  readonly failed: number;
  readonly skipped: ConfirmationResendSkipped;
  readonly remaining: number;
};

export type SubscriberResult =
  | {
      readonly email_address: string;
      readonly outcome: Exclude<SubscriberOutcome, "skipped_not_mailable">;
    }
  | {
      readonly email_address: string;
      readonly outcome: "skipped_not_mailable";
      readonly reason: SubscriberSkipReason;
    };

export type AddSubscribersBatchResult = {
  readonly results: readonly SubscriberResult[];
};

export type ListSubscribersParams = PaginationParams & {
  readonly status?: SubscriberStatus | undefined;
  readonly email?: string | undefined;
};
