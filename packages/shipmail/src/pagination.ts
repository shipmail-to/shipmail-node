import type { ShipmailClient } from "./client.js";
import type { PaginatedResponse } from "./types/common.js";

export class Page<T> implements AsyncIterable<T> {
  private readonly client: ShipmailClient;
  private readonly path: string;
  private readonly query: Record<string, string | number | boolean | undefined>;

  constructor(
    client: ShipmailClient,
    path: string,
    query: Record<string, string | number | boolean | undefined>,
  ) {
    this.client = client;
    this.path = path;
    this.query = query;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let cursor: string | undefined;

    do {
      const response = await this.client.request<PaginatedResponse<T>>({
        method: "GET",
        path: this.path,
        query: { ...this.query, cursor },
      });

      for (const item of response.data) {
        yield item;
      }

      cursor = response.pagination.next_cursor ?? undefined;
      if (!response.pagination.has_more) break;
    } while (cursor);
  }
}
