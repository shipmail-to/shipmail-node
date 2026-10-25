import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type {
  BookingLink,
  CreateBookingLinkParams,
  ListBookingLinksParams,
  UpdateBookingLinkParams,
} from "../types/booking-link.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";

export class BookingLinks extends ApiResource {
  create(params: CreateBookingLinkParams, options?: MethodOptions): Promise<BookingLink> {
    return this.client.request<BookingLink>({
      method: "POST",
      path: "/booking-links",
      body: params,
      methodOptions: options,
    });
  }

  list(
    params?: ListBookingLinksParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<BookingLink>> {
    return this.client.request<PaginatedResponse<BookingLink>>({
      method: "GET",
      path: "/booking-links",
      query: { cursor: params?.cursor, limit: params?.limit, status: params?.status },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListBookingLinksParams, "cursor">): Page<BookingLink> {
    return new Page<BookingLink>(this.client, "/booking-links", {
      limit: params?.limit,
      status: params?.status,
    });
  }

  get(id: string, options?: MethodOptions): Promise<BookingLink> {
    return this.client.request<BookingLink>({
      method: "GET",
      path: `/booking-links/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  update(
    id: string,
    params: UpdateBookingLinkParams,
    options?: MethodOptions,
  ): Promise<BookingLink> {
    return this.client.request<BookingLink>({
      method: "PATCH",
      path: `/booking-links/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  // Revoking keeps the link so its history stays readable. It cannot be undone.
  revoke(id: string, options?: MethodOptions): Promise<BookingLink> {
    return this.client.request<BookingLink>({
      method: "POST",
      path: `/booking-links/${encodeURIComponent(id)}/revoke`,
      methodOptions: options,
    });
  }
}
