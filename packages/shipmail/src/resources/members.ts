import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type { ListMembersParams, Member } from "../types/member.js";

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
}
