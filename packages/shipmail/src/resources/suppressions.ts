import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  CreateSuppressionParams,
  ListSuppressionsParams,
  Suppression,
} from "../types/suppression.js";

export class Suppressions extends ApiResource {
  // Adds a manual suppression. An existing active entry is returned, widened to `all` if asked.
  create(params: CreateSuppressionParams, options?: MethodOptions): Promise<Suppression> {
    return this.client.request<Suppression>({
      method: "POST",
      path: "/suppressions",
      body: params,
      methodOptions: options,
    });
  }

  list(
    params?: ListSuppressionsParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<Suppression>> {
    return this.client.request<PaginatedResponse<Suppression>>({
      method: "GET",
      path: "/suppressions",
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
        scope: params?.scope,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListSuppressionsParams, "cursor">): Page<Suppression> {
    return new Page<Suppression>(this.client, "/suppressions", {
      limit: params?.limit,
      scope: params?.scope,
    });
  }

  remove(email: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/suppressions/${encodeURIComponent(email)}`,
      methodOptions: options,
    });
  }
}
