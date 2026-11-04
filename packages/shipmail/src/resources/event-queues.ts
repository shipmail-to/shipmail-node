import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  AckEventQueueEventsResponse,
  CreateEventQueueParams,
  EventQueue,
  EventQueueEvents,
  ListEventQueueEventsParams,
  ListEventQueuesParams,
} from "../types/event-queue.js";

export class EventQueues extends ApiResource {
  create(params: CreateEventQueueParams, options?: MethodOptions): Promise<EventQueue> {
    return this.client.request<EventQueue>({
      method: "POST",
      path: "/event-queues",
      body: params,
      methodOptions: options,
    });
  }

  list(
    params?: ListEventQueuesParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<EventQueue>> {
    return this.client.request<PaginatedResponse<EventQueue>>({
      method: "GET",
      path: "/event-queues",
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListEventQueuesParams, "cursor">): Page<EventQueue> {
    return new Page<EventQueue>(this.client, "/event-queues", {
      limit: params?.limit,
    });
  }

  get(id: string, options?: MethodOptions): Promise<EventQueue> {
    return this.client.request<EventQueue>({
      method: "GET",
      path: `/event-queues/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  delete(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/event-queues/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  /** Read the oldest unacknowledged events. Reading changes nothing; acknowledge them with `ack`. */
  listEvents(
    id: string,
    params?: ListEventQueueEventsParams,
    options?: MethodOptions,
  ): Promise<EventQueueEvents> {
    return this.client.request<EventQueueEvents>({
      method: "GET",
      path: `/event-queues/${encodeURIComponent(id)}/events`,
      query: {
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  /** Delete handled events by their envelope `event_id`. Idempotent. */
  ack(
    id: string,
    eventIds: readonly string[],
    options?: MethodOptions,
  ): Promise<AckEventQueueEventsResponse> {
    return this.client.request<AckEventQueueEventsResponse>({
      method: "POST",
      path: `/event-queues/${encodeURIComponent(id)}/events/ack`,
      body: { event_ids: eventIds },
      methodOptions: options,
    });
  }
}
