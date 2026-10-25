export type OrganizationAccess = {
  readonly object: "organization_access";
  readonly organization: { readonly id: string; readonly name: string };
  readonly plan: "free" | "solo" | "pro" | "team" | "scale";
  /** Mailboxes can be created now, by the same rule mailbox creation applies. */
  readonly has_access: boolean;
  readonly trial: {
    readonly active: boolean;
    readonly ends_at: string | null;
    /** No subscription yet and the owner never had a trial. Checkout still confirms it. */
    readonly eligible: boolean;
  };
  readonly mailboxes: { readonly limit: number; readonly used: number };
  /** Newsletter sending is available. It is not during a trial. */
  readonly newsletters_allowed: boolean;
};
