import type { PaginationParams } from "./common.js";

export type NewsletterStatus =
  | "draft"
  | "imported"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "in_review"
  | "sending"
  | "paused"
  | "sent"
  | "published"
  | "cancelled"
  | "failed";

/** `public` lists an `email_and_website` issue on the audience's newsletter website and feed. */
export type NewsletterArchiveVisibility = "private" | "public";
/**
 * Where an issue goes. `email_and_website` (the default) sends it, and lists it on the audience's
 * newsletter website and feed when `archive_visibility` is `public`. `email` is never listed on the
 * website or feed. `website` is published on the website and feed without any email; the audience
 * needs its website or its feed on.
 */
export type NewsletterPublishTarget = "email_and_website" | "email" | "website";
export type NewsletterStylingMode = "styled" | "plain";
export type NewsletterDomainStatus = "pending" | "verifying" | "verified" | "failed" | "disabled";
export type NewsletterDomainRecordStatus = "pending" | "verified" | "failed";
export type NewsletterPreflightStatus = "not_run" | "passed" | "warning" | "failed";
export type NewsletterPreflightItemStatus = "pass" | "warn" | "fail";
export type NewsletterTestSendStatus = "pending" | "sent" | "failed";
export type NewsletterAssetKind = "image" | "video";
export type NewsletterAssetContentType =
  | "image/gif"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "video/mp4"
  | "video/quicktime"
  | "video/webm";
export type NewsletterUrlSource = "href" | "image_src" | "video_href" | "text";
export type NewsletterChangelogTone = "concise" | "friendly" | "technical";
export type NewsletterCalloutVariant = "accent" | "info" | "warning" | "success";
export type NewsletterColumnRatio = "50-50" | "33-67" | "67-33";
export type NewsletterColumnImageFit = "natural" | "contain" | "cover";
export type NewsletterButtonAlign = "left" | "center" | "right";

export type NewsletterDomain = {
  readonly object: "newsletter_domain";
  readonly id: string;
  readonly root_domain_name: string;
  readonly domain_name: string;
  readonly from_local_part: string;
  readonly from_address: string;
  readonly mail_from_domain: string;
  readonly reply_to_address: string | null;
  readonly status: NewsletterDomainStatus;
  readonly dkim_status: NewsletterDomainRecordStatus;
  readonly mail_from_status: NewsletterDomainRecordStatus;
  readonly spf_status: NewsletterDomainRecordStatus;
  readonly dmarc_status: NewsletterDomainRecordStatus;
  readonly verified_at: string | null;
  // The records to publish at the DNS host before calling verify.
  readonly dns_records: readonly NewsletterDomainDnsRecord[];
  readonly created_at: string;
  readonly updated_at: string;
};

export type NewsletterDomainDnsRecord = {
  readonly key: "dkim" | "mail_from_mx" | "mail_from_spf" | "dmarc";
  readonly type: "CNAME" | "MX" | "TXT";
  readonly host: string;
  readonly value: string;
  readonly priority: number | null;
  readonly ttl: number | null;
  readonly description: string;
};

export type CreateNewsletterDomainParams = {
  // The domain you own, e.g. "example.com".
  readonly root_domain: string;
  // A label under root_domain ("news", the default) or the full name ("news.example.com").
  readonly subdomain?: string | undefined;
  // The part before @ in the From address. Defaults to "updates".
  readonly from_local_part?: string | undefined;
  readonly reply_to_address: string;
  readonly reply_to_name?: string | undefined;
};

export type NewsletterSenderIdentity = {
  readonly object: "newsletter_sender_identity";
  readonly id: string;
  readonly newsletter_domain_id: string;
  readonly from_name: string;
  readonly from_address: string;
  readonly business_name: string;
  readonly postal_address: string | null;
  readonly footer_text: string | null;
  readonly domain_status: NewsletterDomainStatus;
  readonly is_default: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export type NewsletterSubjectVariant = "a" | "b";

export type Newsletter = {
  readonly object: "newsletter";
  readonly id: string;
  readonly audience_id: string | null;
  readonly sender_identity_id: string | null;
  readonly newsletter_domain_id: string | null;
  readonly name: string;
  readonly subject: string | null;
  readonly preview_text: string | null;
  readonly from_name: string | null;
  readonly from_address: string;
  readonly reply_to_address: string | null;
  readonly blocks: readonly NewsletterBlock[] | null;
  readonly body_html: string | null;
  readonly body_text: string | null;
  readonly status: NewsletterStatus;
  /** `public` lists an `email_and_website` issue on the audience's newsletter website and feed. */
  readonly archive_visibility: NewsletterArchiveVisibility;
  readonly publish_target: NewsletterPublishTarget;
  /** Whether the email carries a View in browser link to the issue's own page. */
  readonly view_in_browser: boolean;
  readonly feed_entry_url: string | null;
  readonly styling_mode: NewsletterStylingMode;
  readonly track_engagement: boolean;
  readonly add_utm_tags: boolean;
  readonly opened_count: number | null;
  readonly clicked_count: number | null;
  /** The limit the newsletter was scheduled with. Null sends to everyone. */
  readonly send_limit: number | null;
  /** Subscribers held past `send_limit`. Send them the newsletter with `sendToMore`. */
  readonly held_count: number;
  /** A second subject tested against `subject`. */
  readonly subject_b: string | null;
  readonly subject_test_percent: number | null;
  readonly subject_test_hours: number | null;
  /** "a" is `subject`, "b" is `subject_b`. Null until the test decides; a tie keeps "a". */
  readonly subject_test_winner: NewsletterSubjectVariant | null;
  readonly subject_test_decided_at: string | null;
  readonly preflight_status: NewsletterPreflightStatus;
  readonly preflight_results: Record<string, unknown>;
  readonly send_window_hours: number;
  readonly send_rate_per_hour: number;
  readonly recipient_count: number;
  readonly sent_count: number;
  readonly delivered_count: number;
  readonly bounced_count: number;
  readonly complained_count: number;
  readonly failed_count: number;
  readonly skipped_count: number;
  readonly last_test_sent_at: string | null;
  readonly last_test_recipient: string | null;
  readonly content_changed_since_test_send: boolean;
  readonly scheduled_at: string | null;
  readonly approved_at: string | null;
  readonly started_at: string | null;
  readonly published_at: string | null;
  readonly archive_url: string | null;
  readonly completed_at: string | null;
  readonly cancelled_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type NewsletterPreflightItem = {
  readonly key: string;
  readonly label: string;
  readonly status: NewsletterPreflightItemStatus;
  readonly message: string;
};

export type NewsletterPreflight = {
  readonly object: "newsletter_preflight";
  readonly newsletter_id: string;
  readonly status: NewsletterPreflightStatus;
  readonly items: readonly NewsletterPreflightItem[];
  readonly url_breakdown: NewsletterUrlBreakdown;
};

export type NewsletterCountedUrl = {
  readonly url: string;
  readonly source: NewsletterUrlSource;
};

export type NewsletterUrlBreakdown = {
  readonly href_count: number;
  readonly image_src_count: number;
  readonly video_href_count: number;
  readonly text_url_count: number;
  readonly unique_url_count: number;
  readonly max_unique_urls: number;
  readonly urls: readonly NewsletterCountedUrl[];
  readonly offending_urls: readonly string[];
};

export type NewsletterPreview = {
  readonly object: "newsletter_preview";
  readonly newsletter_id: string;
  /** The subject with merge tags rendered for the reader. */
  readonly subject: string;
  /** Header name to value, such as `List-Unsubscribe`, `List-Unsubscribe-Post` and `Reply-To`. */
  readonly headers: Readonly<Record<string, string>>;
  /** The full email as delivered, footer and unsubscribe link included. Links are not tracked. */
  readonly html: string;
  readonly archive_html: string;
  readonly text: string;
  readonly warnings: readonly {
    readonly kind: string;
    readonly severity: "fail" | "warn";
    readonly message: string;
  }[];
  readonly url_breakdown: NewsletterUrlBreakdown;
};

/** `sample` renders for a sample reader. `subscriber` renders for one reader a send would reach. */
export type NewsletterPreviewAs =
  | { readonly type: "sample" }
  | { readonly type: "subscriber"; readonly subscriber_id: string };

export type PreviewNewsletterParams = {
  /** Defaults to `{ type: "sample" }`. A subscriber preview also needs the `audiences:read` scope. */
  readonly preview_as?: NewsletterPreviewAs | undefined;
};

export const NEWSLETTER_RECIPIENT_STATUSES = [
  "pending",
  "retrying",
  "sending",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "failed",
  "skipped",
  "unsubscribed",
] as const;
export type NewsletterRecipientStatus = (typeof NEWSLETTER_RECIPIENT_STATUSES)[number];

export const NEWSLETTER_RECIPIENT_REASONS = [
  "opted_out",
  "suppressed",
  "never_email",
  "undeliverable_domain",
  "dormant",
  "last_chance_waiting",
  "no_longer_eligible",
  "cancelled",
  "content_in_review",
  "email_removed",
  "skipped_other",
  "bounced",
  "complained",
  "unsubscribed",
  "send_failed",
] as const;
export type NewsletterRecipientReason = (typeof NEWSLETTER_RECIPIENT_REASONS)[number];

/** One reader's result for an issue: sent, skipped and why, or what happened after. */
export type NewsletterRecipient = {
  readonly object: "newsletter_recipient";
  readonly id: string;
  readonly newsletter_id: string;
  readonly email_address: string;
  readonly status: NewsletterRecipientStatus;
  readonly reason: NewsletterRecipientReason | null;
  readonly subscriber_id: string | null;
  readonly sent_at: string | null;
  readonly delivered_at: string | null;
  readonly bounced_at: string | null;
  readonly complained_at: string | null;
  readonly unsubscribed_at: string | null;
  readonly created_at: string;
};

export type ListNewsletterRecipientsParams = PaginationParams & {
  readonly status?: NewsletterRecipientStatus | undefined;
  readonly reason?: NewsletterRecipientReason | undefined;
};

export type NewsletterTestSend = {
  readonly object: "newsletter_test_send";
  readonly id: string;
  readonly newsletter_id: string;
  readonly message_id: string | null;
  readonly recipient_email: string;
  readonly status: NewsletterTestSendStatus;
  readonly last_error: string | null;
  readonly sent_at: string | null;
  readonly created_at: string;
};

export type CreateNewsletterParams = {
  readonly audience_id: string;
  readonly sender_identity_id: string;
  readonly name: string;
  readonly subject: string;
  readonly preview_text?: string | null | undefined;
  readonly body_html?: string | null | undefined;
  readonly body_text?: string | null | undefined;
  readonly blocks?: readonly NewsletterBlock[] | undefined;
  /** The body as Markdown, converted to blocks on the server. Use instead of blocks or body_html. */
  readonly content_markdown?: string | undefined;
  readonly send_window_hours?: number | undefined;
  /** `public` lists an `email_and_website` issue on the audience's newsletter website and feed. */
  readonly archive_visibility?: NewsletterArchiveVisibility | undefined;
  readonly publish_target?: NewsletterPublishTarget | undefined;
  /**
   * Whether the email carries a View in browser link to the issue's own page. Omitted on create,
   * it is true for a public `email_and_website` issue and false otherwise.
   */
  readonly view_in_browser?: boolean | undefined;
  readonly feed_entry_url?: string | null | undefined;
  readonly styling_mode?: NewsletterStylingMode | undefined;
  readonly track_engagement?: boolean | undefined;
  readonly add_utm_tags?: boolean | undefined;
  /**
   * A second subject to test against `subject`. Each goes to `subject_test_percent` of the
   * subscribers first; after `subject_test_hours` the one with more human clicks goes to the
   * rest. Requires `track_engagement`. Null removes the test.
   */
  readonly subject_b?: string | null | undefined;
  /** From 1 to 25. Defaults to 10. */
  readonly subject_test_percent?: number | null | undefined;
  /** From 1 to 72. Defaults to 4. */
  readonly subject_test_hours?: number | null | undefined;
};

export type UpdateNewsletterParams = Partial<CreateNewsletterParams>;
export type NewsletterChangelogMedia =
  | {
      readonly kind: "image";
      readonly url: string;
      readonly alt: string;
      readonly caption?: string | null | undefined;
      readonly link_url?: string | null | undefined;
    }
  | {
      readonly kind: "video";
      readonly video_url: string;
      readonly thumbnail_url: string;
      readonly label: string;
    };

export type NewsletterChangelogEntry = {
  readonly title: string;
  readonly body?: string | null | undefined;
  readonly url?: string | null | undefined;
  readonly media?: readonly NewsletterChangelogMedia[] | undefined;
  readonly cta_label?: string | null | undefined;
  readonly cta_url?: string | null | undefined;
};

export type CreateNewsletterFromChangelogParams = {
  readonly audience_id: string;
  readonly sender_identity_id: string;
  readonly name: string;
  readonly subject: string;
  readonly preview_text?: string | null | undefined;
  readonly tone?: NewsletterChangelogTone | undefined;
  readonly entries: readonly NewsletterChangelogEntry[];
  readonly final_cta?:
    | {
        readonly label: string;
        readonly url: string;
        readonly body?: string | null | undefined;
      }
    | undefined;
  readonly send_window_hours?: number | undefined;
  /** `public` lists an `email_and_website` issue on the audience's newsletter website and feed. */
  readonly archive_visibility?: NewsletterArchiveVisibility | undefined;
  readonly publish_target?: NewsletterPublishTarget | undefined;
  /**
   * Whether the email carries a View in browser link to the issue's own page. Omitted on create,
   * it is true for a public `email_and_website` issue and false otherwise.
   */
  readonly view_in_browser?: boolean | undefined;
  readonly feed_entry_url?: string | null | undefined;
  readonly styling_mode?: NewsletterStylingMode | undefined;
};

export type ListNewsletterDomainsParams = PaginationParams;
export type ListNewsletterSenderIdentitiesParams = PaginationParams;

export type CreateNewsletterSenderIdentityParams = {
  readonly newsletter_domain_id: string;
  readonly from_name: string;
  readonly business_name: string;
  readonly postal_address?: string | null | undefined;
  readonly footer_text?: string | null | undefined;
  /**
   * Omitted: the organization's first identity becomes the default, otherwise the default is
   * unchanged. `true` makes this identity the default. `false` does not, and an identity that was
   * the default stops being it.
   */
  readonly make_default?: boolean | undefined;
};

export type UpdateNewsletterSenderIdentityParams = {
  readonly newsletter_domain_id?: string | undefined;
  readonly from_name?: string | undefined;
  readonly business_name?: string | undefined;
  readonly postal_address?: string | null | undefined;
  readonly footer_text?: string | null | undefined;
  /**
   * Omitted: the organization's first identity becomes the default, otherwise the default is
   * unchanged. `true` makes this identity the default. `false` does not, and an identity that was
   * the default stops being it.
   */
  readonly make_default?: boolean | undefined;
};
export type ListNewslettersParams = PaginationParams;
export type ListNewsletterAssetsParams = PaginationParams & {
  readonly kind?: NewsletterAssetKind | undefined;
  readonly q?: string | undefined;
};

export type NewsletterAsset = {
  readonly object: "newsletter_asset";
  readonly id: string;
  readonly kind: NewsletterAssetKind;
  readonly filename: string;
  readonly content_type: string;
  readonly byte_size: number;
  readonly checksum_sha256: string;
  readonly url: string;
  readonly image_url: string | null;
  readonly video_url: string | null;
  readonly thumbnail_url: string | null;
  readonly thumbnail_content_type: string | null;
  readonly thumbnail_byte_size: number | null;
  readonly duration_seconds: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly created_at: string;
};

export type NewsletterAssetStorageUsage = {
  readonly used_bytes: number;
  /** Null means storage is unlimited for this organization. */
  readonly limit_bytes: number | null;
  /** Null means storage is unlimited for this organization. */
  readonly remaining_bytes: number | null;
  readonly over_limit: boolean;
  readonly plan: string;
  readonly is_in_trial: boolean;
  readonly next_upgrade: {
    readonly plan: string;
    readonly storage_bytes: number;
  } | null;
};

export type NewsletterAssetListResponse = {
  readonly data: readonly NewsletterAsset[];
  readonly pagination: {
    readonly next_cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
  };
  readonly storage: NewsletterAssetStorageUsage;
};

export type UploadNewsletterAssetParams = {
  readonly filename: string;
  readonly data: ArrayBuffer | Uint8Array;
  readonly content_type?: string | undefined;
};

export type PrepareNewsletterAssetUploadParams = {
  readonly filename: string;
  readonly content_type: NewsletterAssetContentType;
  readonly size: number;
  readonly sha256: string;
};

type NewsletterAssetUploadBase = {
  readonly object: "newsletter_asset_upload";
  readonly filename: string;
  readonly content_type: NewsletterAssetContentType;
  readonly size: number;
  readonly sha256: string;
  readonly upload_url: string;
  readonly upload_method: "PUT";
  readonly upload_headers: {
    readonly "Content-Type": NewsletterAssetContentType;
    readonly "If-None-Match": "*";
  };
  readonly complete_url: string;
  readonly complete_method: "POST";
  readonly expires_at: string;
};

export type NewsletterAssetUpload =
  | (NewsletterAssetUploadBase & {
      readonly kind: "image";
    })
  | (NewsletterAssetUploadBase & {
      readonly kind: "video";
      readonly thumbnail_upload_url: string;
      readonly thumbnail_upload_method: "PUT";
      readonly thumbnail_upload_headers: {
        readonly "Content-Type": "image/jpeg";
        readonly "If-None-Match": "*";
      };
    });

export type RegisterNewsletterAssetFromUrlParams = {
  readonly url: string;
  readonly filename?: string | undefined;
  readonly thumbnail_url?: string | null | undefined;
};

export type SendNewsletterTestParams = {
  readonly recipient_email: string;
};

export type ScheduleNewsletterParams = {
  readonly scheduled_at: string;
  /**
   * Send only to this many of the most engaged subscribers. The rest wait for `sendToMore`.
   * Subscribers you have never emailed still go in a first-send slice.
   */
  readonly limit?: number | null | undefined;
};

export type SendNewsletterToMoreParams = {
  /** The next this many most engaged held subscribers. Omit it to send to all of them. */
  readonly count?: number | null | undefined;
};

/** Include at least one heading, body, image, or complete CTA pair. */
export type NewsletterColumnContent = {
  readonly title?: string | null | undefined;
  readonly body?: string | undefined;
  readonly image_url?: string | null | undefined;
  readonly image_alt?: string | null | undefined;
  readonly image_fit?: NewsletterColumnImageFit | undefined;
  readonly cta_label?: string | null | undefined;
  readonly cta_url?: string | null | undefined;
};

export type NewsletterBlockChannel = "all" | "email" | "web";
export type NewsletterBlockSegmentRule = "in" | "not_in";

/**
 * Where a block shows and to which readers. The website, archive and feed show a block as a reader
 * in no segment sees it. Segment membership is fixed when the send is scheduled. Welcome emails
 * accept `channel` only.
 */
export type NewsletterBlockVisibility = {
  readonly channel?: NewsletterBlockChannel | undefined;
  /** A segment of the issue's audience; null shows the block to every reader. */
  readonly segment_id?: string | null | undefined;
  readonly segment_rule?: NewsletterBlockSegmentRule | undefined;
};

export type NewsletterBlock = NewsletterBlockContent & {
  readonly visibility?: NewsletterBlockVisibility | undefined;
};

type NewsletterBlockContent =
  | { readonly type: "heading"; readonly text: string; readonly level?: 1 | 2 | 3 | undefined }
  | { readonly type: "paragraph"; readonly body: string }
  | {
      readonly type: "list";
      readonly ordered?: boolean | undefined;
      readonly items: readonly string[];
    }
  | {
      readonly type: "callout";
      readonly title?: string | null | undefined;
      readonly body: string;
      readonly variant?: NewsletterCalloutVariant | undefined;
    }
  | {
      readonly type: "button";
      readonly label: string;
      readonly url: string;
      readonly align?: NewsletterButtonAlign | undefined;
    }
  | {
      readonly type: "image";
      readonly url: string;
      readonly alt: string;
      readonly align?: NewsletterButtonAlign | undefined;
      readonly link_url?: string | null | undefined;
      readonly caption?: string | null | undefined;
      readonly caption_url?: string | null | undefined;
    }
  | {
      readonly type: "video";
      readonly video_url: string;
      readonly thumbnail_url: string;
      readonly label: string;
    }
  | {
      readonly type: "columns";
      readonly ratio?: NewsletterColumnRatio | undefined;
      readonly left: NewsletterColumnContent;
      readonly right: NewsletterColumnContent;
    }
  | {
      readonly type: "link_list";
      readonly title?: string | null | undefined;
      readonly items: readonly {
        readonly label: string;
        readonly url: string;
        readonly description?: string | null | undefined;
      }[];
    }
  | { readonly type: "quote"; readonly body: string; readonly cite?: string | null | undefined }
  | { readonly type: "divider" }
  | { readonly type: "spacer"; readonly height?: number | undefined }
  | { readonly type: "code"; readonly code: string }
  | { readonly type: "event"; readonly event_id: string }
  | { readonly type: "custom_html"; readonly html: string };
