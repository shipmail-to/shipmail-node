import type { NewsletterBlock, NewsletterStylingMode } from "./newsletter.js";

export type WelcomeStep = {
  readonly object: "welcome_step";
  readonly id: string;
  readonly audience_id: string | null;
  /** Order in the sequence. Positions only grow; gaps are normal. */
  readonly position: number;
  /** Minutes after the previous email, or after the subscribe for the first one. */
  readonly wait_minutes: number;
  readonly sender_identity_id: string | null;
  readonly subject: string | null;
  readonly preview_text: string | null;
  readonly blocks: readonly NewsletterBlock[];
  readonly track_engagement: boolean;
  readonly add_utm_tags: boolean;
  readonly styling_mode: NewsletterStylingMode;
  readonly sent_count: number;
  readonly delivered_count: number;
  readonly bounced_count: number;
  readonly complained_count: number;
  readonly created_at: string;
  readonly updated_at: string;
};

export type WelcomeSequence = {
  readonly object: "welcome_sequence";
  readonly audience_id: string;
  readonly enabled: boolean;
  /** True after bounces or complaints passed the pause limits; enable it again to resume. */
  readonly paused: boolean;
  readonly pause_reason: string | null;
  readonly active_readers: number;
  readonly completed_readers: number;
  readonly steps: readonly WelcomeStep[];
};

export type UpdateWelcomeSequenceParams = {
  readonly enabled: boolean;
};

export type CreateWelcomeStepParams = {
  readonly subject: string;
  readonly preview_text?: string | null | undefined;
  readonly blocks?: readonly NewsletterBlock[] | undefined;
  /** The body as Markdown, converted to blocks on the server. Use instead of blocks. */
  readonly content_markdown?: string | undefined;
  readonly wait_minutes?: number | undefined;
  readonly sender_identity_id?: string | undefined;
  readonly track_engagement?: boolean | undefined;
  readonly add_utm_tags?: boolean | undefined;
  readonly styling_mode?: NewsletterStylingMode | undefined;
};

export type UpdateWelcomeStepParams = Omit<CreateWelcomeStepParams, "subject"> & {
  readonly subject?: string | undefined;
};

export type DeletedWelcomeStep = {
  readonly object: "welcome_step";
  readonly id: string;
  readonly deleted: true;
};
