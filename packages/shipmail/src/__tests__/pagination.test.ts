import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../client.js";
import type { PaginatedResponse } from "../types/common.js";

function createClient(
  handler: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>,
): ShipmailClient {
  return new ShipmailClient({
    apiKey: "sm_live_test",
    baseUrl: "https://api.test.com/v1",
    fetch: handler as typeof fetch,
    maxRetries: 0,
  });
}

type Item = { readonly id: string; readonly name: string };

describe("Page pagination", () => {
  test("iterates through multiple pages", async () => {
    let requestCount = 0;
    const client = createClient((input) => {
      requestCount++;
      const url = new URL(String(input));
      const cursor = url.searchParams.get("cursor");

      if (!cursor) {
        const page: PaginatedResponse<Item> = {
          data: [
            { id: "1", name: "first" },
            { id: "2", name: "second" },
          ],
          pagination: { next_cursor: "cursor_page2", has_more: true },
        };
        return Response.json(page);
      }
      if (cursor === "cursor_page2") {
        const page: PaginatedResponse<Item> = {
          data: [{ id: "3", name: "third" }],
          pagination: { next_cursor: null, has_more: false },
        };
        return Response.json(page);
      }
      return Response.json({ data: [], pagination: { next_cursor: null, has_more: false } });
    });

    const page = client.domains.listAutoPaginating({ limit: 2 });
    const items: unknown[] = [];
    for await (const item of page) {
      items.push(item);
    }

    expect(items).toHaveLength(3);
    expect((items[0] as Item).id).toBe("1");
    expect((items[1] as Item).id).toBe("2");
    expect((items[2] as Item).id).toBe("3");
    expect(requestCount).toBe(2);
  });

  test("stops when has_more is false on first page", async () => {
    let requestCount = 0;
    const client = createClient(() => {
      requestCount++;
      const page: PaginatedResponse<Item> = {
        data: [{ id: "1", name: "only" }],
        pagination: { next_cursor: null, has_more: false },
      };
      return Response.json(page);
    });

    const page = client.domains.listAutoPaginating();
    const items: unknown[] = [];
    for await (const item of page) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(requestCount).toBe(1);
  });

  test("handles empty first page", async () => {
    const client = createClient(() => {
      return Response.json({
        data: [],
        pagination: { next_cursor: null, has_more: false },
      });
    });

    const page = client.domains.listAutoPaginating();
    const items: unknown[] = [];
    for await (const item of page) {
      items.push(item);
    }

    expect(items).toHaveLength(0);
  });

  test("passes query params through to each request", async () => {
    const limitValues: string[] = [];
    const client = createClient((input) => {
      const url = new URL(String(input));
      const limit = url.searchParams.get("limit");
      if (limit) {
        limitValues.push(limit);
      }
      const cursor = url.searchParams.get("cursor");

      if (!cursor) {
        return Response.json({
          data: [{ id: "1", name: "a" }],
          pagination: { next_cursor: "c2", has_more: true },
        });
      }
      return Response.json({
        data: [{ id: "2", name: "b" }],
        pagination: { next_cursor: null, has_more: false },
      });
    });

    const page = client.domains.listAutoPaginating({ limit: 5 });
    const items: unknown[] = [];
    for await (const item of page) {
      items.push(item);
    }

    expect(items).toHaveLength(2);
    expect(limitValues).toEqual(["5", "5"]);
  });

  test("passes cursor from previous page to next request", async () => {
    const cursorsReceived: (string | null)[] = [];
    const client = createClient((input) => {
      const url = new URL(String(input));
      cursorsReceived.push(url.searchParams.get("cursor"));

      if (cursorsReceived.length === 1) {
        return Response.json({
          data: [{ id: "1", name: "a" }],
          pagination: { next_cursor: "page2_cursor", has_more: true },
        });
      }
      if (cursorsReceived.length === 2) {
        return Response.json({
          data: [{ id: "2", name: "b" }],
          pagination: { next_cursor: "page3_cursor", has_more: true },
        });
      }
      return Response.json({
        data: [{ id: "3", name: "c" }],
        pagination: { next_cursor: null, has_more: false },
      });
    });

    const page = client.domains.listAutoPaginating();
    const items: unknown[] = [];
    for await (const item of page) {
      items.push(item);
    }

    expect(items).toHaveLength(3);
    expect(cursorsReceived[0]).toBeNull();
    expect(cursorsReceived[1]).toBe("page2_cursor");
    expect(cursorsReceived[2]).toBe("page3_cursor");
  });
});
