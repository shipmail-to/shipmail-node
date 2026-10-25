import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  ListMessageAnalyticsParams,
  ListMessagesParams,
  Message,
  MessageAnalyticsPage,
  ReplyToMessageParams,
  SendMessageParams,
} from "../types/message.js";

export class Messages extends ApiResource {
  send(params: SendMessageParams, options?: MethodOptions): Promise<Message> {
    return this.client.request<Message>({
      method: "POST",
      path: "/messages",
      body: params,
      methodOptions: options,
    });
  }

  list(params: ListMessagesParams, options?: MethodOptions): Promise<PaginatedResponse<Message>> {
    return this.client.request<PaginatedResponse<Message>>({
      method: "GET",
      path: "/messages",
      query: {
        mailbox_id: params.mailbox_id,
        client_reference: params.client_reference,
        cursor: params.cursor,
        limit: params.limit,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params: Omit<ListMessagesParams, "cursor">): Page<Message> {
    return new Page<Message>(this.client, "/messages", {
      mailbox_id: params.mailbox_id,
      client_reference: params.client_reference,
      limit: params.limit,
    });
  }

  listAnalytics(
    params: ListMessageAnalyticsParams = {},
    options?: MethodOptions,
  ): Promise<MessageAnalyticsPage> {
    return this.client.request<MessageAnalyticsPage>({
      method: "GET",
      path: "/messages/analytics",
      query: {
        updated_after: params.updated_after,
        updated_before: params.updated_before,
        cursor: params.cursor,
        limit: params.limit,
      },
      methodOptions: options,
    });
  }

  get(id: string, options?: MethodOptions): Promise<Message> {
    return this.client.request<Message>({
      method: "GET",
      path: `/messages/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  reply(id: string, params: ReplyToMessageParams, options?: MethodOptions): Promise<Message> {
    return this.client.request<Message>({
      method: "POST",
      path: `/messages/${encodeURIComponent(id)}/reply`,
      body: params,
      methodOptions: options,
    });
  }
}
