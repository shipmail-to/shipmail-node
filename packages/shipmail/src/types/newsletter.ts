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

export type NewsletterArchiveVisibility = "private" | "public";
/**
 * Where an issue goes. `email_and_website` (the default) sends it and lets `archive_visibility`
 * decide whether it also appears on the web. `email` never appears on the web. `website` is
 * published on the audience's newsletter website and feed without any email.
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
  readonly created_at: string;
  readonly updated_at: string;
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
  readonly archive_visibility: NewsletterArchiveVisibility;
  readonly publish_target: NewsletterPublishTarget;
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
  readonly archive_visibility?: NewsletterArchiveVisibility | undefined;
  readonly publish_target?: NewsletterPublishTarget | undefined;
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
  readonly archive_visibility?: NewsletterArchiveVisibility | undefined;
  readonly publish_target?: NewsletterPublishTarget | undefined;
  readonly feed_entry_url?: string | null | undefined;
  readonly styling_mode?: NewsletterStylingMode | undefined;
};

export type ListNewsletterDomainsParams = PaginationParams;
export type ListNewsletterSenderIdentitiesParams = PaginationParams;
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

export type NewsletterBlock =
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
  | { readonly type: "custom_html"; readonly html: string };
