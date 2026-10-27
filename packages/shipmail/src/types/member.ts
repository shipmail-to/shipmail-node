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

export type InvitationRole = "admin" | "member";

export type Invitation = {
  readonly object: "invitation";
  readonly id: string;
  readonly email: string;
  readonly role: InvitationRole;
  readonly mailbox_access: MemberMailboxAccess;
  /** Only a `member` can carry `editor`. */
  readonly newsletter_role: "editor" | null;
  readonly created_at: string;
  readonly expires_at: string | null;
};

export type InviteMemberParams = {
  readonly email: string;
  readonly role: InvitationRole;
  /** Defaults to `selected`. */
  readonly mailbox_access?: MemberMailboxAccessScope | undefined;
  /** Mailboxes to share for `selected` access. Ignored when `mailbox_access` is `all`. */
  readonly mailbox_ids?: readonly string[] | undefined;
  /** Only for the `member` role. */
  readonly newsletter_role?: "editor" | null | undefined;
};

export type InvitationList = { readonly data: readonly Invitation[] };
