import { ApiResource } from "../resource.js";
import type { MethodOptions } from "../types/common.js";
import type {
  ListScheduledMessagesParams,
  ScheduledMessage,
  ScheduledMessageList,
  UpdateScheduledMessageParams,
} from "../types/message.js";

export class ScheduledMessages extends ApiResource {
  list(
    params?: ListScheduledMessagesParams,
    options?: MethodOptions,
  ): Promise<ScheduledMessageList> {
    return this.client.request<ScheduledMessageList>({
      method: "GET",
      path: "/scheduled-messages",
      query: {
        include_held: params?.include_held,
        search: params?.search,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  get(id: string, options?: MethodOptions): Promise<ScheduledMessage> {
    return this.client.request<ScheduledMessage>({
      method: "GET",
      path: `/scheduled-messages/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  update(
    id: string,
    params: UpdateScheduledMessageParams,
    options?: MethodOptions,
  ): Promise<ScheduledMessage> {
    return this.client.request<ScheduledMessage>({
      method: "PATCH",
      path: `/scheduled-messages/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  cancel(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/scheduled-messages/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }
}
