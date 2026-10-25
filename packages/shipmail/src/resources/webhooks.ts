import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  CreateWebhookParams,
  ListDeliveriesParams,
  ListWebhooksParams,
  RotateSecretResponse,
  TestWebhookResponse,
  UpdateWebhookParams,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryDetail,
  WebhookWithSecret,
} from "../types/webhook.js";

export class Webhooks extends ApiResource {
  create(params: CreateWebhookParams, options?: MethodOptions): Promise<WebhookWithSecret> {
    return this.client.request<WebhookWithSecret>({
      method: "POST",
      path: "/webhooks",
      body: params,
      methodOptions: options,
    });
  }

  list(params?: ListWebhooksParams, options?: MethodOptions): Promise<PaginatedResponse<Webhook>> {
    return this.client.request<PaginatedResponse<Webhook>>({
      method: "GET",
      path: "/webhooks",
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListWebhooksParams, "cursor">): Page<Webhook> {
    return new Page<Webhook>(this.client, "/webhooks", {
      limit: params?.limit,
    });
  }

  get(id: string, options?: MethodOptions): Promise<Webhook> {
    return this.client.request<Webhook>({
      method: "GET",
      path: `/webhooks/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  update(id: string, params: UpdateWebhookParams, options?: MethodOptions): Promise<Webhook> {
    return this.client.request<Webhook>({
      method: "PATCH",
      path: `/webhooks/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  delete(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/webhooks/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  rotateSecret(id: string, options?: MethodOptions): Promise<RotateSecretResponse> {
    return this.client.request<RotateSecretResponse>({
      method: "POST",
      path: `/webhooks/${encodeURIComponent(id)}/rotate-secret`,
      methodOptions: options,
    });
  }

  test(id: string, options?: MethodOptions): Promise<TestWebhookResponse> {
    return this.client.request<TestWebhookResponse>({
      method: "POST",
      path: `/webhooks/${encodeURIComponent(id)}/test`,
      methodOptions: options,
    });
  }

  listDeliveries(
    id: string,
    params?: ListDeliveriesParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<WebhookDelivery>> {
    return this.client.request<PaginatedResponse<WebhookDelivery>>({
      method: "GET",
      path: `/webhooks/${encodeURIComponent(id)}/deliveries`,
      query: {
        status: params?.status,
        event_type: params?.event_type,
        cursor: params?.cursor,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  listDeliveriesAutoPaginating(
    id: string,
    params?: Omit<ListDeliveriesParams, "cursor">,
  ): Page<WebhookDelivery> {
    return new Page<WebhookDelivery>(
      this.client,
      `/webhooks/${encodeURIComponent(id)}/deliveries`,
      {
        status: params?.status,
        event_type: params?.event_type,
        limit: params?.limit,
      },
    );
  }

  getDelivery(
    id: string,
    deliveryId: string,
    options?: MethodOptions,
  ): Promise<WebhookDeliveryDetail> {
    return this.client.request<WebhookDeliveryDetail>({
      method: "GET",
      path: `/webhooks/${encodeURIComponent(id)}/deliveries/${encodeURIComponent(deliveryId)}`,
      methodOptions: options,
    });
  }

  replayDelivery(
    id: string,
    deliveryId: string,
    options?: MethodOptions,
  ): Promise<WebhookDeliveryDetail> {
    return this.client.request<WebhookDeliveryDetail>({
      method: "POST",
      path: `/webhooks/${encodeURIComponent(id)}/deliveries/${encodeURIComponent(deliveryId)}/replay`,
      methodOptions: options,
    });
  }
}
