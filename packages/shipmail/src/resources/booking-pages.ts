import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type {
  BookingPage,
  CreateBookingPageParams,
  ListBookingPagesParams,
  UpdateBookingPageParams,
} from "../types/booking-page.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";

export class BookingPages extends ApiResource {
  create(params: CreateBookingPageParams, options?: MethodOptions): Promise<BookingPage> {
    return this.client.request<BookingPage>({
      method: "POST",
      path: "/booking-pages",
      body: params,
      methodOptions: options,
    });
  }

  list(
    params?: ListBookingPagesParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<BookingPage>> {
    return this.client.request<PaginatedResponse<BookingPage>>({
      method: "GET",
      path: "/booking-pages",
      query: { cursor: params?.cursor, limit: params?.limit },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListBookingPagesParams, "cursor">): Page<BookingPage> {
    return new Page<BookingPage>(this.client, "/booking-pages", { limit: params?.limit });
  }

  get(id: string, options?: MethodOptions): Promise<BookingPage> {
    return this.client.request<BookingPage>({
      method: "GET",
      path: `/booking-pages/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  update(
    id: string,
    params: UpdateBookingPageParams,
    options?: MethodOptions,
  ): Promise<BookingPage> {
    return this.client.request<BookingPage>({
      method: "PATCH",
      path: `/booking-pages/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  delete(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/booking-pages/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }
}
