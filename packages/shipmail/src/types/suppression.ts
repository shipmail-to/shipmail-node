import type { PaginationParams } from "./common.js";

// An address-health suppression. `unsubscribe` is only on a newsletter opt-out entry from the list.
export type SuppressionReason = "hard_bounce" | "complaint" | "manual" | "soft_bounce";
export type SuppressionListReason = SuppressionReason | "unsubscribe";

// `all` blocks every send. The others come from a complaint and block one kind of email:
// `marketing` newsletters, `transactional` application senders, `mailbox` mail from a mailbox.
export type SuppressionScope = "all" | "marketing" | "transactional" | "mailbox";
// The scopes an entry you add can have.
export type CreateSuppressionScope = "all" | "marketing";

// A bounce, complaint or manual block on the address.
export type Suppression = {
  readonly object: "suppression";
  readonly source: "suppression";
  readonly email_address: string;
  readonly reason: SuppressionReason;
  readonly scope: SuppressionScope;
  // Null when the entry is permanent.
  readonly expires_at: string | null;
  readonly created_at: string;
};

// The reader unsubscribed from newsletters. Only resubscribing the subscriber lifts it.
export type NewsletterOptOutSuppression = {
  readonly object: "suppression";
  readonly source: "newsletter_optout";
  readonly email_address: string;
  readonly reason: "unsubscribe";
  readonly scope: "marketing";
  readonly expires_at: null;
  readonly created_at: string;
  // The issue the reader unsubscribed from, when known.
  readonly newsletter_id: string | null;
  // True when the opt-out came from a test send.
  readonly test_send: boolean;
};

// One entry of GET /suppressions: newest first across both sources.
export type SuppressionEntry = Suppression | NewsletterOptOutSuppression;

export type ListSuppressionsParams = PaginationParams & {
  readonly scope?: SuppressionScope | undefined;
  readonly reason?: SuppressionListReason | undefined;
};

export type CreateSuppressionParams = {
  readonly email: string;
  // Defaults to `all`.
  readonly scope?: CreateSuppressionScope;
};

// Returned by DELETE /suppressions/{email} when the suppression was removed but a newsletter
// opt-out still blocks newsletters to the address.
export type SuppressionRemoval = {
  readonly object: "suppression_removal";
  readonly email_address: string;
  readonly removed: true;
  readonly newsletter_optout_remains: true;
  readonly message: string;
};

export type ResubscribeNewsletterOptOutParams = {
  // Where and how the reader opted in again.
  readonly consent_source: string;
};

// Returned by POST /newsletter-opt-outs/{email}/resubscribe.
export type NewsletterOptOutLift = {
  readonly object: "newsletter_opt_out_lift";
  readonly email_address: string;
  readonly consent_source: string;
  readonly consent_attested_at: string;
  // When the lifted opt-out was recorded.
  readonly opted_out_at: string;
  // The newsletter the reader had unsubscribed from, when known.
  readonly newsletter_id: string | null;
};
