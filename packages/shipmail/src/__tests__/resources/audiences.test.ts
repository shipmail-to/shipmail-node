import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { Audience, AudienceFeed, Subscriber } from "../../types/audience.js";
import type { PaginatedResponse } from "../../types/common.js";

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

const mockAudience: Audience = {
  object: "audience",
  id: "aud_123",
  name: "Newsletter",
  description: null,
  member_count: 0,
  subscribed_count: 0,
  consent_source: "Signup form",
  feed_enabled: false,
  feed_url: null,
  cleanup_enabled: true,
  cleanup_ignored_issues: 6,
  cleanup_inactive_days: 180,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockSubscriber: Subscriber = {
  object: "subscriber",
  id: "audmem_1",
  audience_id: "aud_123",
  email_address: "a@shipmail.to",
  display_name: null,
  status: "subscribed",
  merge_fields: {},
  consent_source: "Signup form",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockFeed: AudienceFeed = {
  object: "audience_feed",
  audience_id: "aud_123",
  enabled: true,
  title: "Release notes",
  subtitle: null,
  site_url: "https://example.com/",
  canonical_url: "https://example.com/feed.xml",
  author_name: null,
  icon_url: null,
  entry_limit: 25,
  url: "https://shipmail.to/f/audfeed_test/feed.xml",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("Audiences", () => {
  test("create sends POST /audiences with body", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/audiences");
      expect(JSON.parse(init?.body as string)).toEqual({
        name: "Newsletter",
        consent_source: "Signup form",
      });
      return Response.json(mockAudience);
    });

    const audience = await client.audiences.create({
      name: "Newsletter",
      consent_source: "Signup form",
    });
    expect(audience.id).toBe("aud_123");
  });

  test("list sends GET /audiences", async () => {
    const response: PaginatedResponse<Audience> = {
      data: [mockAudience],
      pagination: { next_cursor: null, has_more: false },
    };
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe("/v1/audiences");
      return Response.json(response);
    });

    const result = await client.audiences.list();
    expect(result.data[0]?.id).toBe("aud_123");
  });

  test("update sends PATCH /audiences/:id", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("PATCH");
      expect(new URL(String(input)).pathname).toBe("/v1/audiences/aud_123");
      expect(JSON.parse(init?.body as string)).toEqual({ name: "Renamed" });
      return Response.json({ ...mockAudience, name: "Renamed" });
    });

    const audience = await client.audiences.update("aud_123", { name: "Renamed" });
    expect(audience.name).toBe("Renamed");
  });

  test("delete sends DELETE /audiences/:id and returns void", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("DELETE");
      expect(new URL(String(input)).pathname).toBe("/v1/audiences/aud_123");
      return new Response(null, { status: 204 });
    });

    expect(await client.audiences.delete("aud_123")).toBeUndefined();
  });
});

describe("Audiences.feeds", () => {
  test("get returns the complete stored feed settings", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe("/v1/audiences/aud_123/feed");
      return Response.json(mockFeed);
    });

    const feed = await client.audiences.feeds.get("aud_123");
    expect(feed.canonical_url).toBe("https://example.com/feed.xml");
    expect(feed.entry_limit).toBe(25);
  });

  test("update sends canonical_url and entry_limit including explicit nulls", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("PATCH");
      expect(new URL(String(input)).pathname).toBe("/v1/audiences/aud_123/feed");
      expect(JSON.parse(String(init?.body))).toEqual({
        canonical_url: null,
        entry_limit: null,
      });
      return Response.json({ ...mockFeed, canonical_url: null, entry_limit: null });
    });

    const feed = await client.audiences.feeds.update("aud_123", {
      canonical_url: null,
      entry_limit: null,
    });
    expect(feed.canonical_url).toBeNull();
    expect(feed.entry_limit).toBeNull();
  });
});

describe("Audiences.subscribers", () => {
  test("add sends POST /audiences/:id/subscribers and returns an outcome", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/audiences/aud_123/subscribers");
      expect(JSON.parse(init?.body as string)).toEqual({ email_address: "a@shipmail.to" });
      return Response.json({ email_address: "a@shipmail.to", outcome: "created" });
    });

    const result = await client.audiences.subscribers.add("aud_123", {
      email_address: "a@shipmail.to",
    });
    expect(result.outcome).toBe("created");
  });

  test("addBatch sends POST /audiences/:id/subscribers/batch with results", async () => {
    const client = createClient((input) => {
      expect(new URL(String(input)).pathname).toBe("/v1/audiences/aud_123/subscribers/batch");
      return Response.json({ results: [{ email_address: "a@shipmail.to", outcome: "created" }] });
    });

    const result = await client.audiences.subscribers.addBatch("aud_123", {
      subscribers: [{ email_address: "a@shipmail.to" }],
    });
    expect(result.results).toHaveLength(1);
  });

  test("list forwards status and email filters", async () => {
    const response: PaginatedResponse<Subscriber> = {
      data: [mockSubscriber],
      pagination: { next_cursor: null, has_more: false },
    };
    const client = createClient((input) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/v1/audiences/aud_123/subscribers");
      expect(url.searchParams.get("status")).toBe("subscribed");
      return Response.json(response);
    });

    await client.audiences.subscribers.list("aud_123", { status: "subscribed" });
  });

  test("getByEmail URL-encodes the email segment", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe(
        "/v1/audiences/aud_123/subscribers/by-email/a%40shipmail.to",
      );
      return Response.json(mockSubscriber);
    });

    const subscriber = await client.audiences.subscribers.getByEmail("aud_123", "a@shipmail.to");
    expect(subscriber.email_address).toBe("a@shipmail.to");
  });

  test("unsubscribe sends POST .../unsubscribe", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe(
        "/v1/audiences/aud_123/subscribers/audmem_1/unsubscribe",
      );
      return Response.json({ ...mockSubscriber, status: "unsubscribed" });
    });

    const subscriber = await client.audiences.subscribers.unsubscribe("aud_123", "audmem_1");
    expect(subscriber.status).toBe("unsubscribed");
  });

  test("resubscribe sends POST .../resubscribe with consent source", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe(
        "/v1/audiences/aud_123/subscribers/audmem_1/resubscribe",
      );
      expect(JSON.parse(String(init?.body))).toEqual({ consent_source: "Signup form" });
      return Response.json({ ...mockSubscriber, status: "subscribed" });
    });

    const subscriber = await client.audiences.subscribers.resubscribe("aud_123", "audmem_1", {
      consent_source: "Signup form",
    });
    expect(subscriber.status).toBe("subscribed");
  });

  test("remove sends DELETE .../:subscriberId and returns void", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("DELETE");
      expect(new URL(String(input)).pathname).toBe("/v1/audiences/aud_123/subscribers/audmem_1");
      return new Response(null, { status: 204 });
    });

    expect(await client.audiences.subscribers.remove("aud_123", "audmem_1")).toBeUndefined();
  });
});
