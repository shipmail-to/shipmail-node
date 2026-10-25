import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../client.js";
import { InternalServerError, NotFoundError, ShipmailError } from "../errors.js";
import { VERSION } from "../version.js";

function createClient(
  handler: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>,
  options?: { maxRetries?: number; timeout?: number },
): ShipmailClient {
  return new ShipmailClient({
    apiKey: "sm_live_test_key",
    baseUrl: "https://api.test.com/v1",
    fetch: handler as typeof fetch,
    maxRetries: options?.maxRetries ?? 0,
    timeout: options?.timeout,
  });
}

function getHeaders(init?: RequestInit): Headers {
  return new Headers(init?.headers as HeadersInit);
}

describe("ShipmailClient", () => {
  describe("default headers", () => {
    test("sends Authorization Bearer header", async () => {
      const client = createClient((input, init) => {
        const headers = getHeaders(init);
        expect(headers.get("Authorization")).toBe("Bearer sm_live_test_key");
        return Response.json({ status: "ok", version: "1", time: "t", request_id: "r" });
      });
      await client.status.get();
    });

    test("sends User-Agent header with SDK version", async () => {
      const client = createClient((input, init) => {
        const headers = getHeaders(init);
        expect(headers.get("User-Agent")).toBe(`shipmail-node/${VERSION}`);
        return Response.json({ status: "ok", version: "1", time: "t", request_id: "r" });
      });
      await client.status.get();
    });

    test("sends Accept application/json header", async () => {
      const client = createClient((input, init) => {
        const headers = getHeaders(init);
        expect(headers.get("Accept")).toBe("application/json");
        return Response.json({ status: "ok", version: "1", time: "t", request_id: "r" });
      });
      await client.status.get();
    });

    test("sends Content-Type application/json for JSON body", async () => {
      const client = createClient((input, init) => {
        const headers = getHeaders(init);
        expect(headers.get("Content-Type")).toBe("application/json");
        return Response.json({ id: "dom_123", name: "example.com" });
      });
      await client.domains.create({ name: "example.com" });
    });

    test("does not send Content-Type for GET requests", async () => {
      const client = createClient((input, init) => {
        const headers = getHeaders(init);
        expect(headers.get("Content-Type")).toBeNull();
        return Response.json({ status: "ok", version: "1", time: "t", request_id: "r" });
      });
      await client.status.get();
    });
  });

  describe("retry behavior", () => {
    test("retries on 5xx responses up to maxRetries", async () => {
      let attempts = 0;
      const client = createClient(
        () => {
          attempts++;
          if (attempts < 3) {
            return Response.json(
              { error: { type: "internal_error", message: "Server error" } },
              { status: 500 },
            );
          }
          return Response.json({ status: "ok", version: "1", time: "t", request_id: "r" });
        },
        { maxRetries: 2 },
      );
      const result = await client.status.get();
      expect(result.status).toBe("ok");
      expect(attempts).toBe(3);
    });

    test("retries on 429 responses", async () => {
      let attempts = 0;
      const client = createClient(
        () => {
          attempts++;
          if (attempts < 2) {
            return Response.json(
              { error: { type: "rate_limit_error", message: "Too many requests" } },
              { status: 429 },
            );
          }
          return Response.json({ status: "ok", version: "1", time: "t", request_id: "r" });
        },
        { maxRetries: 2 },
      );
      const result = await client.status.get();
      expect(result.status).toBe("ok");
      expect(attempts).toBe(2);
    });

    test("does not retry on 4xx non-429 errors", async () => {
      let attempts = 0;
      const client = createClient(
        () => {
          attempts++;
          return Response.json(
            { error: { type: "not_found", message: "Not found" } },
            { status: 404 },
          );
        },
        { maxRetries: 2 },
      );
      try {
        await client.status.get();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
      }
      expect(attempts).toBe(1);
    });

    test("throws after exhausting all retries on 5xx", async () => {
      let attempts = 0;
      const client = createClient(
        () => {
          attempts++;
          return Response.json(
            { error: { type: "internal_error", message: "Server error" } },
            { status: 500 },
          );
        },
        { maxRetries: 2 },
      );
      try {
        await client.status.get();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(InternalServerError);
      }
      expect(attempts).toBe(3);
    });

    test("retries on network errors", async () => {
      let attempts = 0;
      const client = createClient(
        () => {
          attempts++;
          if (attempts < 3) {
            throw new Error("Connection refused");
          }
          return Response.json({ status: "ok", version: "1", time: "t", request_id: "r" });
        },
        { maxRetries: 2 },
      );
      const result = await client.status.get();
      expect(result.status).toBe("ok");
      expect(attempts).toBe(3);
    });
  });

  describe("timeout", () => {
    test("passes AbortSignal to fetch", async () => {
      const client = createClient(
        (input, init) => {
          expect(init?.signal).toBeDefined();
          return Response.json({ status: "ok", version: "1", time: "t", request_id: "r" });
        },
        { timeout: 5000 },
      );
      await client.status.get();
    });
  });

  describe("query params serialization", () => {
    test("appends query params to URL", async () => {
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("cursor")).toBe("abc123");
        expect(url.searchParams.get("limit")).toBe("10");
        return Response.json({ data: [], pagination: { next_cursor: null, has_more: false } });
      });
      await client.domains.list({ cursor: "abc123", limit: 10 });
    });

    test("omits undefined query params", async () => {
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.has("cursor")).toBe(false);
        expect(url.searchParams.has("limit")).toBe(false);
        return Response.json({ data: [], pagination: { next_cursor: null, has_more: false } });
      });
      await client.domains.list();
    });

    test("serializes boolean query params", async () => {
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("active")).toBe("true");
        return Response.json({ ok: true });
      });
      await client.request({
        method: "GET",
        path: "/test",
        query: { active: true },
      });
    });
  });

  describe("audience feeds", () => {
    test("covers settings, rotation, and revocation endpoints", async () => {
      const requests: { readonly path: string; readonly method: string; readonly body: unknown }[] =
        [];
      const client = createClient((input, init) => {
        requests.push({
          path: new URL(String(input)).pathname,
          method: init?.method ?? "",
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        });
        return Response.json({
          object: "audience_feed",
          audience_id: "aud_123",
          enabled: true,
          title: "Release notes",
          subtitle: null,
          site_url: null,
          canonical_url: "https://example.com/feed.xml",
          author_name: null,
          icon_url: null,
          entry_limit: 25,
          url: "https://shipmail.to/f/audfeed_test/feed.xml",
          updated_at: "2026-07-28T00:00:00.000Z",
        });
      });

      await client.audiences.feeds.get("aud_123");
      await client.audiences.feeds.update("aud_123", {
        title: "Release notes",
        canonical_url: "https://example.com/feed.xml",
        entry_limit: 25,
      });
      await client.audiences.feeds.rotate("aud_123");
      await client.audiences.feeds.revoke("aud_123");

      expect(requests).toEqual([
        { path: "/v1/audiences/aud_123/feed", method: "GET", body: null },
        {
          path: "/v1/audiences/aud_123/feed",
          method: "PATCH",
          body: {
            title: "Release notes",
            canonical_url: "https://example.com/feed.xml",
            entry_limit: 25,
          },
        },
        { path: "/v1/audiences/aud_123/feed/rotate", method: "POST", body: null },
        { path: "/v1/audiences/aud_123/feed/revoke", method: "POST", body: null },
      ]);
    });
  });

  describe("204 response", () => {
    test("returns undefined for 204 No Content", async () => {
      const client = createClient(() => {
        return new Response(null, { status: 204 });
      });
      const result = await client.domains.delete("dom_123");
      expect(result).toBeUndefined();
    });
  });

  describe("error mapping", () => {
    test("maps API error body to typed error", async () => {
      const client = createClient(() => {
        return Response.json(
          { error: { type: "not_found", message: "Domain not found", request_id: "req_abc" } },
          { status: 404 },
        );
      });
      try {
        await client.domains.get("dom_missing");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
        const notFound = err as NotFoundError;
        expect(notFound.message).toBe("Domain not found");
        expect(notFound.status).toBe(404);
        expect(notFound.type).toBe("not_found");
        expect(notFound.requestId).toBe("req_abc");
        expect(notFound.retryable).toBe(false);
      }
    });

    test("falls back to generic ShipmailError for non-JSON error body", async () => {
      const client = createClient(() => {
        return new Response("Internal Server Error", { status: 500 });
      });
      try {
        await client.status.get();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ShipmailError);
        const smErr = err as ShipmailError;
        expect(smErr.status).toBe(500);
        expect(smErr.retryable).toBe(true);
      }
    });

    test("falls back to generic ShipmailError for malformed error body", async () => {
      const client = createClient(() => {
        return Response.json({ message: "Bad" }, { status: 400 });
      });
      try {
        await client.status.get();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ShipmailError);
        const smErr = err as ShipmailError;
        expect(smErr.message).toBe("Request failed with status 400");
        expect(smErr.retryable).toBe(false);
      }
    });
  });

  describe("constructor", () => {
    test("accepts string config as API key", () => {
      const client = new ShipmailClient("sm_live_my_key");
      expect(client.domains).toBeDefined();
      expect(client.mailboxes).toBeDefined();
      expect(client.messages).toBeDefined();
      expect(client.threads).toBeDefined();
      expect(client.webhooks).toBeDefined();
      expect(client.status).toBeDefined();
    });
  });

  describe("request body", () => {
    test("sends JSON body for POST requests", async () => {
      const client = createClient(async (input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ name: "example.com" });
        return Response.json({ id: "dom_123", name: "example.com" });
      });
      await client.domains.create({ name: "example.com" });
    });
  });
});
