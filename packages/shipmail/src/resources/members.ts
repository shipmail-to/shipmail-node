import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  Invitation,
  InvitationList,
  InviteMemberParams,
  ListMembersParams,
  Member,
} from "../types/member.js";

export class Members extends ApiResource {
  list(params?: ListMembersParams, options?: MethodOptions): Promise<PaginatedResponse<Member>> {
    return this.client.request<PaginatedResponse<Member>>({
      method: "GET",
      path: "/members",
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListMembersParams, "cursor">): Page<Member> {
    return new Page<Member>(this.client, "/members", { limit: params?.limit });
  }

  get(id: string, options?: MethodOptions): Promise<Member> {
    return this.client.request<Member>({
      method: "GET",
      path: `/members/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  listInvitations(options?: MethodOptions): Promise<InvitationList> {
    return this.client.request<InvitationList>({
      method: "GET",
      path: "/members/invitations",
      methodOptions: options,
    });
  }

  invite(params: InviteMemberParams, options?: MethodOptions): Promise<Invitation> {
    return this.client.request<Invitation>({
      method: "POST",
      path: "/members/invitations",
      body: params,
      methodOptions: options,
    });
  }

  cancelInvitation(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/members/invitations/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  grantMailboxAccess(
    memberId: string,
    mailboxId: string,
    options?: MethodOptions,
  ): Promise<Member> {
    return this.client.request<Member>({
      method: "PUT",
      path: `/members/${encodeURIComponent(memberId)}/mailboxes/${encodeURIComponent(mailboxId)}`,
      methodOptions: options,
    });
  }

  revokeMailboxAccess(
    memberId: string,
    mailboxId: string,
    options?: MethodOptions,
  ): Promise<Member> {
    return this.client.request<Member>({
      method: "DELETE",
      path: `/members/${encodeURIComponent(memberId)}/mailboxes/${encodeURIComponent(mailboxId)}`,
      methodOptions: options,
    });
  }
}
