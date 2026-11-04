export type SegmentEngagementTier = "engaged" | "cooling" | "cold" | "dormant" | "not_enough_data";

/** A merge field compared case-insensitively. `is_set` and `is_not_set` take no value. */
export type SegmentMergeFieldRule =
  | {
      readonly kind: "merge_field";
      /** Lowercase letters, digits and underscores, up to 80 characters. */
      readonly field: string;
      readonly operator: "equals" | "not_equals" | "contains" | "not_contains";
      readonly value: string;
    }
  | {
      readonly kind: "merge_field";
      readonly field: string;
      readonly operator: "is_set" | "is_not_set";
      readonly value?: "" | undefined;
    };

/** The day the subscriber joined, compared in UTC. `value` is a YYYY-MM-DD date. */
export type SegmentJoinDateRule = {
  readonly kind: "join_date";
  readonly operator: "before" | "after" | "on_or_before" | "on_or_after";
  readonly value: string;
};

export type SegmentEngagementTierRule = {
  readonly kind: "engagement_tier";
  readonly operator: "is" | "is_not";
  readonly value: SegmentEngagementTier;
};

/** An open or click in the last `value` days (1 to 3650), or none in them. */
export type SegmentLastSignOfLifeRule = {
  readonly kind: "last_sign_of_life";
  readonly operator: "within_days" | "not_within_days";
  readonly value: number;
};

/** How many newsletters the subscriber has received, from 0 to 100000. */
export type SegmentIssuesReceivedRule = {
  readonly kind: "issues_received";
  readonly operator: "at_least" | "at_most";
  readonly value: number;
};

export type SegmentRule =
  | SegmentMergeFieldRule
  | SegmentJoinDateRule
  | SegmentEngagementTierRule
  | SegmentLastSignOfLifeRule
  | SegmentIssuesReceivedRule;

export type SegmentDefinition = {
  /** `all` requires every rule to match, `any` at least one. */
  readonly match: "all" | "any";
  /** From 1 to 10 rules. */
  readonly rules: readonly SegmentRule[];
};

/** A saved group of an audience's subscribers. Use its id as `segment_id` in a block's `visibility`. */
export type Segment = {
  readonly object: "segment";
  readonly id: string;
  readonly audience_id: string;
  readonly name: string;
  readonly definition: SegmentDefinition;
  /** Subscribed members the definition matches now. */
  readonly matching_count: number;
  readonly created_at: string;
  readonly updated_at: string;
};

export type ListSegmentsResponse = { readonly data: readonly Segment[] };

export type CreateSegmentParams = {
  /** Unique within the audience, up to 120 characters. */
  readonly name: string;
  readonly definition: SegmentDefinition;
};

/** Pass name, definition, or both. */
export type UpdateSegmentParams = {
  readonly name?: string | undefined;
  readonly definition?: SegmentDefinition | undefined;
};
