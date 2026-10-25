import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { PaginatedResponse } from "../../types/common.js";
import type { Message } from "../../types/message.js";
import type { Thread } from "../../types/thread.js";

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

const mockMessage: Message = {
  object: "message",
  id: "msg_123",
  mailbox_id: "mbx_456",
  thread_id: "thr_789",
  conversation_id: "thd_789",
  source_rfc_message_id: null,
  delivered_rfc_message_id: null,
  client_reference: null,
  metadata: {},
  headers: [],
  subject: "Test thread",
  from_address: "hello@example.com",
  to_addresses: [{ address: "user@example.com" }],
  cc_addresses: null,
  bcc_addresses: null,
  attachments: null,
  source: "api",
  mode: "live",
  status: "sent",
  rule_disposition: null,
  scheduled_at: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockMessage2: Message = {
  object: "message",
  id: "msg_124",
  mailbox_id: "mbx_456",
  thread_id: "thr_789",
  conversation_id: "thd_789",
  source_rfc_message_id: null,
  delivered_rfc_message_id: null,
  client_reference: null,
  metadata: {},
  headers: [],
  subject: "Re: Test thread",
  from_address: "user@example.com",
  to_addresses: [{ address: "hello@example.com" }],
  cc_addresses: null,
  bcc_addresses: null,
  attachments: null,
  source: "inbound",
  mode: "live",
  status: "delivered",
  rule_disposition: {
    matched_rule_ids: ["rule_support"],
    stop_rule_id: null,
  },
  scheduled_at: null,
  created_at: "2025-01-02T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
};

const mockThread: Thread = {
  object: "thread",
  id: "thr_789",
  mailbox_id: "mbx_456",
  subject: "Re: Test thread",
  message_count: 2,
  latest_message: mockMessage2,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
};

describe("Threads", () => {
  describe("list", () => {
    test("sends GET /threads with required mailbox_id", async () => {
      const response: PaginatedResponse<Thread> = {
        data: [mockThread],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        const url = new URL(String(input));
        expect(url.pathname).toBe("/v1/threads");
        expect(url.searchParams.get("mailbox_id")).toBe("mbx_456");
        return Response.json(response);
      });

      const result = await client.threads.list({ mailbox_id: "mbx_456" });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("thr_789");
      expect(result.data[0]?.latest_message.rule_disposition?.matched_rule_ids).toEqual([
        "rule_support",
      ]);
      expect(result.data[0]?.latest_message.id).toBe("msg_124");
    });

    test("sends cursor and limit query params", async () => {
      const response: PaginatedResponse<Thread> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("mailbox_id")).toBe("mbx_456");
        expect(url.searchParams.get("cursor")).toBe("cur_abc");
        expect(url.searchParams.get("limit")).toBe("20");
        return Response.json(response);
      });

      await client.threads.list({
        mailbox_id: "mbx_456",
        cursor: "cur_abc",
        limit: 20,
      });
    });
  });

  describe("get", () => {
    test("sends GET /threads/:id", async () => {
      const response: PaginatedResponse<Message> = {
        data: [mockMessage, mockMessage2],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        const url = new URL(String(input));
        expect(url.pathname).toBe("/v1/threads/thr_789");
        expect(url.searchParams.get("mailbox_id")).toBe("mbx_456");
        return Response.json(response);
      });

      const result = await client.threads.get("thr_789", { mailbox_id: "mbx_456" });
      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe("msg_123");
      expect(result.data[1]?.id).toBe("msg_124");
    });

    test("sends cursor and limit for paginated thread messages", async () => {
      const response: PaginatedResponse<Message> = {
        data: [mockMessage2],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("cursor")).toBe("cur_xyz");
        expect(url.searchParams.get("limit")).toBe("5");
        return Response.json(response);
      });

      await client.threads.get("thr_789", {
        mailbox_id: "mbx_456",
        cursor: "cur_xyz",
        limit: 5,
      });
    });

    test("omits undefined params", async () => {
      const response: PaginatedResponse<Message> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.has("cursor")).toBe(false);
        expect(url.searchParams.has("limit")).toBe(false);
        return Response.json(response);
      });

      await client.threads.get("thr_789", { mailbox_id: "mbx_456" });
    });
  });

  describe("reply", () => {
    test("sends POST /threads/:id/reply with body", async () => {
      const replyMessage: Message = {
        object: "message",
        id: "msg_125",
        mailbox_id: "mbx_456",
        thread_id: "thr_789",
        conversation_id: "thd_789",
        subject: "Re: Test thread",
        from_address: "hello@example.com",
        to_addresses: [{ address: "user@example.com" }],
        cc_addresses: null,
        bcc_addresses: null,
        source: "api",
        status: "queued",
        rule_disposition: null,
        scheduled_at: null,
        created_at: "2025-01-03T00:00:00Z",
        updated_at: "2025-01-03T00:00:00Z",
      };

      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/threads/thr_789/reply");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({
          mailbox_id: "mbx_456",
          to: ["user@example.com"],
          html: "<p>Thanks for your message</p>",
        });
        return Response.json(replyMessage);
      });

      const message = await client.threads.reply("thr_789", {
        mailbox_id: "mbx_456",
        to: ["user@example.com"],
        html: "<p>Thanks for your message</p>",
      });
      expect(message.id).toBe("msg_125");
      expect(message.thread_id).toBe("thr_789");
      expect(message.conversation_id).toBe("thd_789");
    });

    test("sends reply with to and cc overrides", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.to).toEqual([{ address: "other@example.com" }]);
        expect(body.cc).toEqual([{ address: "cc@example.com", name: "CC User" }]);
        expect(body.text).toBe("Plain reply");
        return Response.json(mockMessage);
      });

      await client.threads.reply("thr_789", {
        mailbox_id: "mbx_456",
        text: "Plain reply",
        to: [{ address: "other@example.com" }],
        cc: [{ address: "cc@example.com", name: "CC User" }],
      });
    });

    test("sends scheduled reply", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.text).toBe("Later");
        expect(body.scheduled_at).toBe("2026-06-07T09:30:00.000Z");
        return Response.json(mockMessage);
      });

      await client.threads.reply("thr_789", {
        mailbox_id: "mbx_456",
        to: ["user@example.com"],
        text: "Later",
        scheduled_at: "2026-06-07T09:30:00.000Z",
      });
    });

    test("passes a synthetic outcome for a sandbox reply", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.sandbox_outcome).toBe("complained");
        return Response.json({ ...mockMessage, mode: "test", status: "complained" });
      });

      const message = await client.threads.reply("thr_789", {
        mailbox_id: "mbx_456",
        to: ["user@example.com"],
        text: "Sandbox reply",
        sandbox_outcome: "complained",
      });
      expect(message.mode).toBe("test");
      expect(message.status).toBe("complained");
    });
  });
});
