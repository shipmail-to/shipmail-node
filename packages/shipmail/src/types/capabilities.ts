export type CapabilityResourceConstraints = {
  readonly mailbox_ids: readonly string[] | null;
  readonly domain_ids: readonly string[] | null;
  readonly audience_ids: readonly string[] | null;
  readonly resource_semantics: "legacy-intersection" | "union-v2";
};

export type CapabilitiesResponse = {
  readonly capability_version: string;
  readonly scopes: readonly string[];
  readonly constraints: CapabilityResourceConstraints;
  readonly allowed_mcp_tools: readonly string[];
};
