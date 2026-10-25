import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { PaginatedResponse } from "../../types/common.js";
import type {
  RotateSecretResponse,
  TestWebhookResponse,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryDetail,
  WebhookWithSecret,
} from "../../types/webhook.js";

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

const mockWebhook: Webhook = {
  object: "webhook",
  id: "whk_123",
  url: "https://example.com/webhooks",
  events: ["message.received", "message.sent"],
  active: true,
  description: "My webhook",
  mailbox_ids: null,
  domain_ids: null,
  has_authorization: false,
  has_standard_webhooks_secret: false,
  include_reply_text: false,
  authenticated_senders_only: false,
  allowed_senders: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockWebhookWithSecret: WebhookWithSecret = {
  ...mockWebhook,
  secret: "whsec_abc123",
};

const mockDelivery: WebhookDelivery = {
  object: "webhook_delivery",
  id: "dlv_001",
  event_id: "evt_001",
  event_type: "message.received",
  mode: "live",
  status: "delivered",
  attempts: 1,
  last_status_code: 200,
  last_error: null,
  created_at: "2025-01-01T00:00:00Z",
  delivered_at: "2025-01-01T00:00:01Z",
};

const mockDeliveryDetail: WebhookDeliveryDetail = {
  ...mockDelivery,
  payload: { event_id: "evt_001" },
  next_attempt_at: null,
  replayed_from_delivery_id: null,
};

describe("Webhooks", () => {
  describe("create", () => {
    test("sends POST /webhooks with body", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/webhooks");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({
          url: "https://example.com/webhooks",
          events: ["message.received", "message.sent"],
          description: "My webhook",
        });
        return Response.json(mockWebhookWithSecret);
      });

      const webhook = await client.webhooks.create({
        url: "https://example.com/webhooks",
        events: ["message.received", "message.sent"],
        description: "My webhook",
      });
      expect(webhook.id).toBe("whk_123");
      expect(webhook.secret).toBe("whsec_abc123");
      expect(webhook.url).toBe("https://example.com/webhooks");
    });

    test("sends authorization and never receives it back", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({
          url: "https://example.com/hook",
          events: ["message.received"],
          authorization: "Bearer key_123",
        });
        return Response.json({ ...mockWebhookWithSecret, has_authorization: true });
      });

      const webhook = await client.webhooks.create({
        url: "https://example.com/hook",
        events: ["message.received"],
        authorization: "Bearer key_123",
      });
      expect(webhook.has_authorization).toBe(true);
      expect(webhook).not.toHaveProperty("authorization");
    });

    test("creates webhook without optional description", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({
          url: "https://example.com/hook",
          events: ["message.received"],
        });
        return Response.json(mockWebhookWithSecret);
      });

      await client.webhooks.create({
        url: "https://example.com/hook",
        events: ["message.received"],
      });
    });
  });

  describe("list", () => {
    test("sends GET /webhooks", async () => {
      const response: PaginatedResponse<Webhook> = {
        data: [mockWebhook],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/webhooks");
        return Response.json(response);
      });

      const result = await client.webhooks.list();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("whk_123");
    });

    test("sends cursor and limit", async () => {
      const response: PaginatedResponse<Webhook> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("cursor")).toBe("cur_abc");
        expect(url.searchParams.get("limit")).toBe("50");
        return Response.json(response);
      });

      await client.webhooks.list({ cursor: "cur_abc", limit: 50 });
    });
  });

  describe("get", () => {
    test("sends GET /webhooks/:id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/webhooks/whk_123");
        return Response.json(mockWebhook);
      });

      const webhook = await client.webhooks.get("whk_123");
      expect(webhook.id).toBe("whk_123");
      expect(webhook.url).toBe("https://example.com/webhooks");
      expect(webhook.events).toEqual(["message.received", "message.sent"]);
      expect(webhook.active).toBe(true);
    });
  });

  describe("update", () => {
    test("sends PATCH /webhooks/:id with body", async () => {
      const updated = { ...mockWebhook, url: "https://example.com/new-hook", active: false };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("PATCH");
        expect(new URL(String(input)).pathname).toBe("/v1/webhooks/whk_123");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({
          url: "https://example.com/new-hook",
          active: false,
        });
        return Response.json(updated);
      });

      const webhook = await client.webhooks.update("whk_123", {
        url: "https://example.com/new-hook",
        active: false,
      });
      expect(webhook.url).toBe("https://example.com/new-hook");
      expect(webhook.active).toBe(false);
    });

    test("updates events list", async () => {
      const updated = { ...mockWebhook, events: ["message.bounced"] };
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ events: ["message.bounced"] });
        return Response.json(updated);
      });

      const webhook = await client.webhooks.update("whk_123", {
        events: ["message.bounced"],
      });
      expect(webhook.events).toEqual(["message.bounced"]);
    });

    test("updates description to null", async () => {
      const updated = { ...mockWebhook, description: null };
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ description: null });
        return Response.json(updated);
      });

      const webhook = await client.webhooks.update("whk_123", {
        description: null,
      });
      expect(webhook.description).toBeNull();
    });

    test("replaces authorization", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ authorization: "Bearer key_456" });
        return Response.json({ ...mockWebhook, has_authorization: true });
      });

      const webhook = await client.webhooks.update("whk_123", {
        authorization: "Bearer key_456",
      });
      expect(webhook.has_authorization).toBe(true);
    });

    test("sets and clears a Standard Webhooks secret", async () => {
      const bodies: unknown[] = [];
      const client = createClient((input, init) => {
        bodies.push(JSON.parse(init?.body as string));
        return Response.json({ ...mockWebhook, has_standard_webhooks_secret: bodies.length === 1 });
      });

      const set = await client.webhooks.update("whk_123", {
        standard_webhooks_secret: "whsec_abc",
      });
      const cleared = await client.webhooks.update("whk_123", { standard_webhooks_secret: null });
      expect(bodies).toEqual([
        { standard_webhooks_secret: "whsec_abc" },
        { standard_webhooks_secret: null },
      ]);
      expect(set.has_standard_webhooks_secret).toBe(true);
      expect(cleared.has_standard_webhooks_secret).toBe(false);
      expect(set).not.toHaveProperty("standard_webhooks_secret");
    });

    test("sets and clears allowed_senders", async () => {
      const bodies: unknown[] = [];
      const client = createClient((input, init) => {
        bodies.push(JSON.parse(init?.body as string));
        return Response.json({
          ...mockWebhook,
          allowed_senders: bodies.length === 1 ? ["jane@customer.com", "customer.org"] : null,
        });
      });

      const set = await client.webhooks.update("whk_123", {
        allowed_senders: ["jane@customer.com", "customer.org"],
      });
      const cleared = await client.webhooks.update("whk_123", { allowed_senders: null });
      expect(bodies).toEqual([
        { allowed_senders: ["jane@customer.com", "customer.org"] },
        { allowed_senders: null },
      ]);
      expect(set.allowed_senders).toEqual(["jane@customer.com", "customer.org"]);
      expect(cleared.allowed_senders).toBeNull();
    });

    test("clears authorization with null", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ authorization: null });
        return Response.json(mockWebhook);
      });

      const webhook = await client.webhooks.update("whk_123", {
        authorization: null,
      });
      expect(webhook.has_authorization).toBe(false);
    });
  });

  describe("delete", () => {
    test("sends DELETE /webhooks/:id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("DELETE");
        expect(new URL(String(input)).pathname).toBe("/v1/webhooks/whk_123");
        return new Response(null, { status: 204 });
      });

      const result = await client.webhooks.delete("whk_123");
      expect(result).toBeUndefined();
    });
  });

  describe("rotateSecret", () => {
    test("sends POST /webhooks/:id/rotate-secret", async () => {
      const response: RotateSecretResponse = {
        secret: "whsec_new_secret",
        previous_secret_expires_at: "2025-01-08T00:00:00Z",
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/webhooks/whk_123/rotate-secret");
        return Response.json(response);
      });

      const result = await client.webhooks.rotateSecret("whk_123");
      expect(result.secret).toBe("whsec_new_secret");
      expect(result.previous_secret_expires_at).toBe("2025-01-08T00:00:00Z");
    });
  });

  describe("test", () => {
    test("sends POST /webhooks/:id/test", async () => {
      const response: TestWebhookResponse = {
        event_id: "evt_test_123",
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/webhooks/whk_123/test");
        return Response.json(response);
      });

      const result = await client.webhooks.test("whk_123");
      expect(result.event_id).toBe("evt_test_123");
    });
  });

  describe("listDeliveries", () => {
    test("sends GET /webhooks/:id/deliveries", async () => {
      const response: PaginatedResponse<WebhookDelivery> = {
        data: [mockDelivery],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/webhooks/whk_123/deliveries");
        return Response.json(response);
      });

      const result = await client.webhooks.listDeliveries("whk_123");
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("dlv_001");
      expect(result.data[0]?.status).toBe("delivered");
      expect(result.data[0]?.last_status_code).toBe(200);
    });

    test("sends status and event_type filters", async () => {
      const response: PaginatedResponse<WebhookDelivery> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("status")).toBe("failed");
        expect(url.searchParams.get("event_type")).toBe("message.bounced");
        return Response.json(response);
      });

      await client.webhooks.listDeliveries("whk_123", {
        status: "failed",
        event_type: "message.bounced",
      });
    });

    test("sends cursor and limit", async () => {
      const response: PaginatedResponse<WebhookDelivery> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("cursor")).toBe("cur_dlv");
        expect(url.searchParams.get("limit")).toBe("100");
        return Response.json(response);
      });

      await client.webhooks.listDeliveries("whk_123", {
        cursor: "cur_dlv",
        limit: 100,
      });
    });

    test("omits undefined filter params", async () => {
      const response: PaginatedResponse<WebhookDelivery> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.has("status")).toBe(false);
        expect(url.searchParams.has("event_type")).toBe(false);
        expect(url.searchParams.has("cursor")).toBe(false);
        expect(url.searchParams.has("limit")).toBe(false);
        return Response.json(response);
      });

      await client.webhooks.listDeliveries("whk_123");
    });
  });

  describe("delivery detail and replay", () => {
    test("gets one scoped delivery", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/webhooks/whk_123/deliveries/dlv_001");
        return Response.json(mockDeliveryDetail);
      });

      const result = await client.webhooks.getDelivery("whk_123", "dlv_001");
      expect(result.payload).toEqual({ event_id: "evt_001" });
    });

    test("replays one failed delivery with method options", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/webhooks/whk_123/deliveries/dlv_001/replay",
        );
        expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("idem_replay_123");
        return Response.json({
          ...mockDeliveryDetail,
          id: "dlv_replay",
          status: "pending",
          replayed_from_delivery_id: "dlv_001",
        });
      });

      const result = await client.webhooks.replayDelivery("whk_123", "dlv_001", {
        idempotencyKey: "idem_replay_123",
      });
      expect(result.replayed_from_delivery_id).toBe("dlv_001");
    });
  });
});
