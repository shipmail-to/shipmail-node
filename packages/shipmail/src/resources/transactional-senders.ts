import { ApiResource } from "../resource.js";
import type { MethodOptions } from "../types/common.js";
import type {
  CreateTransactionalSenderParams,
  ListTransactionalSendersParams,
  TransactionalSender,
  TransactionalSenderList,
  UpdateTransactionalSenderParams,
} from "../types/transactional.js";

export class TransactionalSenders extends ApiResource {
  list(
    params?: ListTransactionalSendersParams,
    options?: MethodOptions,
  ): Promise<TransactionalSenderList> {
    return this.client.request<TransactionalSenderList>({
      method: "GET",
      path: "/transactional-senders",
      query: { domain_id: params?.domain_id },
      methodOptions: options,
    });
  }

  create(
    params: CreateTransactionalSenderParams,
    options?: MethodOptions,
  ): Promise<TransactionalSender> {
    return this.client.request<TransactionalSender>({
      method: "POST",
      path: "/transactional-senders",
      body: params,
      methodOptions: options,
    });
  }

  get(id: string, options?: MethodOptions): Promise<TransactionalSender> {
    return this.client.request<TransactionalSender>({
      method: "GET",
      path: `/transactional-senders/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  // Turn a sender off with `state: "disabled"`. There is no delete.
  update(
    id: string,
    params: UpdateTransactionalSenderParams,
    options?: MethodOptions,
  ): Promise<TransactionalSender> {
    return this.client.request<TransactionalSender>({
      method: "PATCH",
      path: `/transactional-senders/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }
}
