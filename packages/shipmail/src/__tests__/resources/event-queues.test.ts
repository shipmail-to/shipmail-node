import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { PaginatedResponse } from "../../types/common.js";
import type { EventQueue, EventQueueEvents } from "../../types/event-queue.js";

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

const mockQueue: EventQueue = {
  object: "event_queue",
  id: "evq_123",
  events: ["message.received", "message.bounced"],
  description: "Inbound for my agent",
  mailbox_ids: null,
  domain_ids: null,
  include_reply_text: false,
  authenticated_senders_only: false,
  allowed_senders: null,
  created_at: "2026-11-04T10:00:00.000Z",
};

const mockEvents: EventQueueEvents = {
  data: [
    {
      version: "2026-07-20",
      event_id: "evt_001",
      event_type: "message.received",
      created_at: "2026-11-04T10:01:00.000Z",
      test: false,
      data: { message_id: "msg_1" },
    },
  ],
  has_more: true,
};

describe("EventQueues", () => {
  describe("create", () => {
    test("sends POST /event-queues with body", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/event-queues");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({
          events: ["message.received", "message.bounced"],
          description: "Inbound for my agent",
          allowed_senders: ["customer.com"],
        });
        return Response.json({ ...mockQueue, allowed_senders: ["customer.com"] }, { status: 201 });
      });

      const queue = await client.eventQueues.create({
        events: ["message.received", "message.bounced"],
        description: "Inbound for my agent",
        allowed_senders: ["customer.com"],
      });
      expect(queue.id).toBe("evq_123");
      expect(queue.allowed_senders).toEqual(["customer.com"]);
    });
  });

  describe("list", () => {
    test("sends GET /event-queues", async () => {
      const response: PaginatedResponse<EventQueue> = {
        data: [mockQueue],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/event-queues");
        return Response.json(response);
      });

      const result = await client.eventQueues.list();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("evq_123");
    });

    test("sends cursor and limit", async () => {
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("cursor")).toBe("cur_abc");
        expect(url.searchParams.get("limit")).toBe("50");
        return Response.json({ data: [], pagination: { next_cursor: null, has_more: false } });
      });

      await client.eventQueues.list({ cursor: "cur_abc", limit: 50 });
    });
  });

  describe("get", () => {
    test("sends GET /event-queues/:id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/event-queues/evq_123");
        return Response.json(mockQueue);
      });

      const queue = await client.eventQueues.get("evq_123");
      expect(queue.events).toEqual(["message.received", "message.bounced"]);
    });
  });

  describe("delete", () => {
    test("sends DELETE /event-queues/:id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("DELETE");
        expect(new URL(String(input)).pathname).toBe("/v1/event-queues/evq_123");
        return new Response(null, { status: 204 });
      });

      const result = await client.eventQueues.delete("evq_123");
      expect(result).toBeUndefined();
    });
  });

  describe("listEvents", () => {
    test("sends GET /event-queues/:id/events with limit", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        const url = new URL(String(input));
        expect(url.pathname).toBe("/v1/event-queues/evq_123/events");
        expect(url.searchParams.get("limit")).toBe("100");
        return Response.json(mockEvents);
      });

      const result = await client.eventQueues.listEvents("evq_123", { limit: 100 });
      expect(result.has_more).toBe(true);
      expect(result.data[0]?.event_id).toBe("evt_001");
    });

    test("omits limit when not given", async () => {
      const client = createClient((input) => {
        expect(new URL(String(input)).searchParams.has("limit")).toBe(false);
        return Response.json({ data: [], has_more: false });
      });

      const result = await client.eventQueues.listEvents("evq_123");
      expect(result.data).toEqual([]);
    });
  });

  describe("ack", () => {
    test("sends POST /event-queues/:id/events/ack with event_ids", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/event-queues/evq_123/events/ack");
        expect(JSON.parse(init?.body as string)).toEqual({ event_ids: ["evt_001", "evt_002"] });
        return Response.json({ acknowledged: 1 });
      });

      const result = await client.eventQueues.ack("evq_123", ["evt_001", "evt_002"]);
      expect(result.acknowledged).toBe(1);
    });
  });
});
