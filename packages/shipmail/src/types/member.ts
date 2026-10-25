import type { PaginationParams } from "./common.js";

export type MemberRole = "owner" | "admin" | "member";

export type MemberMailboxAccessScope = "all" | "selected";

export type MemberMailboxAccess = {
  readonly scope: MemberMailboxAccessScope;
  /**
   * Empty when `scope` is `all`. For `selected`, API-key responses may include only the mailbox
   * IDs that the key can reach.
   */
  readonly mailbox_ids: readonly string[];
};

export type Member = {
  readonly object: "member";
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: MemberRole;
  readonly mailbox_access: MemberMailboxAccess;
  readonly created_at: string;
};

export type ListMembersParams = PaginationParams;
