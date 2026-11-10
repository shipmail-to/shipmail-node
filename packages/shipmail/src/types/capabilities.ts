export type CapabilityResourceConstraints = {
  readonly mailbox_ids: readonly string[] | null;
  readonly domain_ids: readonly string[] | null;
  readonly audience_ids: readonly string[] | null;
  readonly resource_semantics: "legacy-intersection" | "union-v2";
};

export type CapabilityOrganization = {
  /** IANA zone used when a request and the credential's user name none, or null. */
  readonly default_timezone: string | null;
  /** Whether AI models and automatic sending are in effect for the organization now. */
  readonly ai: {
    readonly models_enabled: boolean;
    readonly automatic_send_enabled: boolean;
  };
};

export type CapabilitiesResponse = {
  readonly capability_version: string;
  readonly scopes: readonly string[];
  readonly constraints: CapabilityResourceConstraints;
  readonly allowed_mcp_tools: readonly string[];
  readonly organization: CapabilityOrganization;
};
