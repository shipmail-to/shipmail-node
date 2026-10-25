export const API_KEY_SCOPES = [
  "*",
  "audiences:read",
  "audiences:write",
  "automations:read",
  "automations:write",
  "booking_pages:read",
  "booking_pages:write",
  "calendar:read",
  "calendar:write",
  "domains:read",
  "domains:write",
  "mailboxes:read",
  "mailboxes:export",
  "mailboxes:write",
  "mailbox_credentials:read",
  "mailbox_credentials:write",
  "mailbox_forwarding:read",
  "mailbox_forwarding:write",
  "mailbox_rules:read",
  "mailbox_rules:write",
  "members:read",
  "messages:read",
  "messages:review",
  "messages:write",
  "drafts:write",
  "drafts:compose",
  "messages:send",
  "newsletters:read",
  "newsletters:write",
  "threads:read",
  "webhooks:read",
  "webhooks:write",
  "suppressions:read",
  "suppressions:write",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const API_KEY_SCOPE_DESCRIPTIONS: Readonly<Record<ApiKeyScope, string>> = {
  "*": "All API endpoints in this organization.",
  "audiences:read": "List and retrieve newsletter audiences and their subscribers.",
  "audiences:write": "Create audiences and add, update, or remove their subscribers.",
  "automations:read": "List and retrieve assistant automations.",
  "automations:write": "Create, update, and manually run assistant automations.",
  "booking_pages:read": "List and retrieve booking pages.",
  "booking_pages:write": "Create, update, and delete booking pages.",
  "calendar:read": "List and retrieve calendar events and open availability.",
  "calendar:write": "Create, update, and delete calendar events.",
  "domains:read": "List, retrieve, and verify domains.",
  "domains:write": "Create, update, and delete domains.",
  "mailboxes:read": "List and retrieve mailboxes.",
  "mailboxes:export": "Create and download mailbox content exports.",
  "mailboxes:write":
    "Create, update, suspend, resume, and delete mailboxes. Does not include setting mailbox passwords.",
  "mailbox_credentials:read": "List revocable app passwords for allowed mailboxes.",
  "mailbox_credentials:write":
    "Set primary mailbox passwords and create and revoke app passwords for allowed mailboxes.",
  "mailbox_forwarding:read": "List forwarding destinations for allowed mailboxes.",
  "mailbox_forwarding:write": "Create and remove forwarding destinations for allowed mailboxes.",
  "mailbox_rules:read": "List deterministic server-side rules for allowed mailboxes.",
  "mailbox_rules:write": "Create, replace, and remove deterministic rules for allowed mailboxes.",
  "members:read": "List and retrieve organization members.",
  "messages:read": "List and retrieve messages.",
  "messages:review": "Inspect and release messages held by API-agent security review.",
  "messages:write": "Update, move, delete, and inject sandbox messages.",
  "drafts:write": "Create agent-safe reply drafts with server-derived recipients.",
  "drafts:compose": "Save new-message drafts to a mailbox's Drafts folder for review. Cannot send.",
  "messages:send": "Send messages, replies, and approved reply drafts.",
  "newsletters:read": "List and retrieve newsletter drafts and campaigns.",
  "newsletters:write": "Create, update, test, schedule, cancel, and resume newsletters.",
  "threads:read": "List threads and retrieve thread messages.",
  "webhooks:read": "List webhooks, retrieve webhooks, and list deliveries.",
  "webhooks:write": "Create, update, delete, test, and rotate webhooks.",
  "suppressions:read": "List suppressed recipient addresses.",
  "suppressions:write": "Remove addresses from the suppression list.",
};

export function isApiKeyScope(value: string): value is ApiKeyScope {
  return API_KEY_SCOPES.some((scope) => scope === value);
}

export function apiKeyScopesGrant(
  grantedScopes: readonly string[],
  requiredScope: ApiKeyScope | "public",
): boolean {
  if (requiredScope === "public") return true;
  return grantedScopes.includes("*") || grantedScopes.includes(requiredScope);
}
