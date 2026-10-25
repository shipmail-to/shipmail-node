import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type { Message } from "../types/message.js";
import type {
  GetThreadParams,
  ListThreadsParams,
  ReplyToThreadParams,
  Thread,
} from "../types/thread.js";

export class Threads extends ApiResource {
  list(params: ListThreadsParams, options?: MethodOptions): Promise<PaginatedResponse<Thread>> {
    return this.client.request<PaginatedResponse<Thread>>({
      method: "GET",
      path: "/threads",
      query: {
        mailbox_id: params.mailbox_id,
        cursor: params.cursor,
        limit: params.limit,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params: Omit<ListThreadsParams, "cursor">): Page<Thread> {
    return new Page<Thread>(this.client, "/threads", {
      mailbox_id: params.mailbox_id,
      limit: params.limit,
    });
  }

  get(
    id: string,
    params: GetThreadParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<Message>> {
    return this.client.request<PaginatedResponse<Message>>({
      method: "GET",
      path: `/threads/${encodeURIComponent(id)}`,
      query: {
        mailbox_id: params.mailbox_id,
        cursor: params.cursor,
        limit: params.limit,
      },
      methodOptions: options,
    });
  }

  reply(id: string, params: ReplyToThreadParams, options?: MethodOptions): Promise<Message> {
    return this.client.request<Message>({
      method: "POST",
      path: `/threads/${encodeURIComponent(id)}/reply`,
      body: params,
      methodOptions: options,
    });
  }
}
