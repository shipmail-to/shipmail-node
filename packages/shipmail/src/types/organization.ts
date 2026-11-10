export type OrganizationAccess = {
  readonly object: "organization_access";
  readonly organization: {
    readonly id: string;
    readonly name: string;
    /** IANA zone used when a request and the credential's user name none. */
    readonly default_timezone: string | null;
  };
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

export type OrganizationSettings = {
  readonly object: "organization";
  readonly id: string;
  readonly name: string;
  /**
   * IANA zone used by availability and timed event creation when neither the request nor the
   * calendar time zone of the person behind the credential names one. Null falls back to Etc/UTC.
   */
  readonly default_timezone: string | null;
};

export type UpdateOrganizationParams = {
  /** An IANA zone such as `Europe/Paris`, or null to clear it. */
  readonly default_timezone: string | null;
};

export type OrganizationAiSettings = {
  readonly object: "organization_ai_settings";
  /** The organization's own switch for AI features. */
  readonly models_enabled: boolean;
  /** Read-only: whether automations may send AI-drafted replies without review. */
  readonly automatic_send_enabled: boolean;
  /** Whether each switch is in effect. Shipmail can hold either off for every organization. */
  readonly effective: {
    readonly models_enabled: boolean;
    readonly automatic_send_enabled: boolean;
  };
};

/** `automatic_send_enabled` is read-only and cannot be changed over the API. */
export type UpdateOrganizationAiSettingsParams = {
  readonly models_enabled: boolean;
};
