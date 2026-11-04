export type SuppressionReason = "hard_bounce" | "complaint" | "manual" | "soft_bounce";

// `all` blocks every send. The others come from a complaint and block one kind of email:
// `marketing` newsletters, `transactional` application senders, `mailbox` mail from a mailbox.
export type SuppressionScope = "all" | "marketing" | "transactional" | "mailbox";
// The scopes an entry you add can have.
export type CreateSuppressionScope = "all" | "marketing";

export type Suppression = {
  readonly object: "suppression";
  readonly email_address: string;
  readonly reason: SuppressionReason;
  readonly scope: SuppressionScope;
  // Null when the entry is permanent.
  readonly expires_at: string | null;
  readonly created_at: string;
};

export type ListSuppressionsParams = {
  readonly cursor?: string;
  readonly limit?: number;
  readonly scope?: SuppressionScope;
};

export type CreateSuppressionParams = {
  readonly email: string;
  // Defaults to `all`.
  readonly scope?: CreateSuppressionScope;
};
