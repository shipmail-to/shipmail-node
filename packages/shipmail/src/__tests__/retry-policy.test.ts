import { describe, expect, spyOn, test } from "bun:test";

import { ShipmailClient } from "../client.js";

describe("bounded retries", () => {
  test.each(["2", "Mon, 14 Sep 2026 12:00:02 GMT"])(
    "honors Retry-After %s on byte responses",
    async (header) => {
      const now = spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-14T12:00:00Z"));
      const delays: number[] = [];
      const timer = spyOn(globalThis, "setTimeout").mockImplementation(((
        callback: () => void,
        delay: number,
      ) => {
        delays.push(delay);
        callback();
        return 0;
      }) as typeof setTimeout);
      let attempts = 0;
      try {
        const client = new ShipmailClient({
          apiKey: "test",
          fetch: (() => {
            attempts++;
            return attempts === 1
              ? new Response("unavailable", { status: 503, headers: { "Retry-After": header } })
              : new Response("ok");
          }) as typeof fetch,
        });
        expect(await client.requestBytes({ method: "GET", path: "/test" })).toEqual(
          new TextEncoder().encode("ok"),
        );
        expect(delays).toEqual([2000]);
        expect(attempts).toBe(2);
      } finally {
        timer.mockRestore();
        now.mockRestore();
      }
    },
  );

  test.each(["61", "999999999999"])(
    "does not retry earlier than a long Retry-After %s",
    async (header) => {
      let attempts = 0;
      const client = new ShipmailClient({
        apiKey: "test",
        fetch: (() => {
          attempts++;
          return new Response("busy", { status: 429, headers: { "Retry-After": header } });
        }) as typeof fetch,
      });
      await expect(client.request({ method: "GET", path: "/test" })).rejects.toThrow();
      expect(attempts).toBe(1);
    },
  );

  test.each([false, true])(
    "only retries mutations with idempotency safeguards: %s",
    async (keyed) => {
      let attempts = 0;
      const client = new ShipmailClient({
        apiKey: "test",
        fetch: ((_url, init) => {
          attempts++;
          expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(keyed ? "same-key" : null);
          return new Response("busy", { status: 503, headers: { "Retry-After": "0" } });
        }) as typeof fetch,
      });
      await expect(
        client.request({
          method: "POST",
          path: "/test",
          methodOptions: keyed ? { idempotencyKey: "same-key" } : undefined,
        }),
      ).rejects.toThrow();
      expect(attempts).toBe(keyed ? 3 : 1);
    },
  );

  test.each([-1, Infinity, NaN, 1.5])("rejects invalid retry count %s", (maxRetries) => {
    expect(() => new ShipmailClient({ apiKey: "test", maxRetries })).toThrow(RangeError);
  });
});

test("does not replay an unkeyed mutation after a network failure", async () => {
  let attempts = 0;
  const client = new ShipmailClient({
    apiKey: "test",
    fetch: (() => {
      attempts++;
      throw new Error("Connection lost after sending request");
    }) as typeof fetch,
  });
  await expect(client.request({ method: "POST", path: "/messages" })).rejects.toThrow(
    "Connection lost",
  );
  expect(attempts).toBe(1);
});

test.each(["POST", "PATCH", "PUT", "DELETE"])(
  "only retries supported keyed methods: %s",
  async (method) => {
    let attempts = 0;
    const client = new ShipmailClient({
      apiKey: "test",
      fetch: (() => {
        attempts++;
        return new Response("busy", { status: 503, headers: { "Retry-After": "0" } });
      }) as typeof fetch,
    });
    await expect(
      client.request({ method, path: "/test", methodOptions: { idempotencyKey: "same-key" } }),
    ).rejects.toThrow();
    expect(attempts).toBe(method === "DELETE" ? 1 : 3);
  },
);

test.each(["", "   "])(
  "empty idempotency key does not enable mutation retries: %s",
  async (idempotencyKey) => {
    let attempts = 0;
    const client = new ShipmailClient({
      apiKey: "test",
      fetch: (() => {
        attempts++;
        return new Response("busy", { status: 503, headers: { "Retry-After": "0" } });
      }) as typeof fetch,
    });
    await expect(
      client.request({ method: "POST", path: "/test", methodOptions: { idempotencyKey } }),
    ).rejects.toThrow();
    expect(attempts).toBe(1);
  },
);

test("does not replay a keyed DELETE after a network failure", async () => {
  let attempts = 0;
  const client = new ShipmailClient({
    apiKey: "test",
    fetch: (() => {
      attempts++;
      throw new Error("Connection lost after sending request");
    }) as typeof fetch,
  });
  await expect(
    client.request({
      method: "DELETE",
      path: "/test",
      methodOptions: { idempotencyKey: "same-key" },
    }),
  ).rejects.toThrow();
  expect(attempts).toBe(1);
});
