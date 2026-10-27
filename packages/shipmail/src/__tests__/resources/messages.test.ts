import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { Message } from "../../types/message.js";

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
  source_rfc_message_id: "<crm-123@example.com>",
  delivered_rfc_message_id: null,
  client_reference: "crm-123",
  metadata: { campaign: "onboarding" },
  headers: [{ name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" }],
  subject: "Hello",
  from_address: "hello@example.com",
  to_addresses: [{ address: "user@example.com", name: "User" }],
  cc_addresses: null,
  bcc_addresses: null,
  attachments: null,
  source: "api",
  mode: "live",
  status: "queued",
  rule_disposition: null,
  scheduled_at: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockInboundMessage: Message = {
  ...mockMessage,
  source: "inbound",
  status: "delivered",
  rule_disposition: {
    matched_rule_ids: ["rule_invoices", "rule_priority"],
    stop_rule_id: "rule_priority",
  },
};

describe("Messages", () => {
  describe("send", () => {
    test("passes a synthetic outcome for sandbox sends", async () => {
      const client = createClient((input, init) => {
        expect(new URL(String(input)).pathname).toBe("/v1/messages");
        expect(JSON.parse(init?.body as string).sandbox_outcome).toBe("bounced");
        return Response.json({ ...mockMessage, mode: "test", status: "bounced" });
      });

      const message = await client.messages.send({
        mailbox_id: "mbx_456",
        to: ["user@example.com"],
        subject: "Sandbox bounce",
        text: "test",
        sandbox_outcome: "bounced",
      });

      expect(message.mode).toBe("test");
      expect(message.status).toBe("bounced");
    });

    test("sends POST /messages with html", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/messages");
        const body = JSON.parse(init?.body as string);
        expect(body.from).toBe("hello@example.com");
        expect(body.to).toEqual(["user@example.com"]);
        expect(body.html).toBe("<p>Hi there</p>");
        return Response.json(mockMessage);
      });

      const message = await client.messages.send({
        from: "hello@example.com",
        to: ["user@example.com"],
        subject: "Hello",
        html: "<p>Hi there</p>",
      });
      expect(message.id).toBe("msg_123");
      expect(message.status).toBe("queued");
    });

    test("sends a stored template with variables and a pinned version", async () => {
      const client = createClient((input, init) => {
        expect(new URL(String(input)).pathname).toBe("/v1/messages");
        expect(JSON.parse(init?.body as string)).toEqual({
          from: "hello@example.com",
          to: ["user@example.com"],
          template: { id: "tpl_123", version: 2, variables: { name: "Ada", count: 3 } },
        });
        return Response.json(mockMessage);
      });

      const message = await client.messages.send({
        from: "hello@example.com",
        to: ["user@example.com"],
        template: { id: "tpl_123", version: 2, variables: { name: "Ada", count: 3 } },
      });
      expect(message.id).toBe("msg_123");
    });

    test("sends with mailbox_id (legacy)", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.mailbox_id).toBe("mbx_456");
        return Response.json(mockMessage);
      });

      await client.messages.send({
        mailbox_id: "mbx_456",
        to: [{ address: "user@example.com", name: "User" }],
        subject: "Hello",
        html: "<p>Hi there</p>",
      });
    });

    test("sends with string recipients including display name", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.to).toEqual(["Jane Doe <jane@example.com>"]);
        expect(body.cc).toEqual(["cc@example.com"]);
        return Response.json(mockMessage);
      });

      await client.messages.send({
        from: "hello@example.com",
        to: ["Jane Doe <jane@example.com>"],
        cc: ["cc@example.com"],
        subject: "Test",
        text: "Plain text",
      });
    });

    test("sends with cc, bcc, and reply_to", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.cc).toEqual([{ address: "cc@example.com" }]);
        expect(body.bcc).toEqual([{ address: "bcc@example.com" }]);
        expect(body.reply_to).toEqual({ address: "reply@example.com", name: "Reply" });
        return Response.json(mockMessage);
      });

      await client.messages.send({
        mailbox_id: "mbx_456",
        to: [{ address: "user@example.com" }],
        subject: "Test",
        cc: [{ address: "cc@example.com" }],
        bcc: [{ address: "bcc@example.com" }],
        reply_to: { address: "reply@example.com", name: "Reply" },
        text: "test",
      });
    });

    test("sends with text only", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.text).toBe("Plain text");
        expect(body.html).toBeUndefined();
        return Response.json(mockMessage);
      });

      await client.messages.send({
        mailbox_id: "mbx_456",
        to: [{ address: "user@example.com" }],
        subject: "Test",
        text: "Plain text",
      });
    });

    test("sends with in_reply_to and references", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.in_reply_to).toBe("<msg-id-1@example.com>");
        expect(body.references).toEqual(["<msg-id-0@example.com>", "<msg-id-1@example.com>"]);
        expect(body.track_reply).toBe(true);
        return Response.json(mockMessage);
      });

      await client.messages.send({
        mailbox_id: "mbx_456",
        to: [{ address: "user@example.com" }],
        subject: "Re: Test",
        html: "<p>Reply</p>",
        in_reply_to: "<msg-id-1@example.com>",
        references: ["<msg-id-0@example.com>", "<msg-id-1@example.com>"],
        track_reply: true,
      });
    });

    test("sends durable correlation, metadata, and safe headers", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.client_reference).toBe("crm-123");
        expect(body.metadata).toEqual({ campaign: "onboarding", sequence: 2 });
        expect(body.source_rfc_message_id).toBe("<crm-123@example.com>");
        expect(body.headers).toEqual([
          { name: "List-Unsubscribe", value: "<https://example.com/unsubscribe/123>" },
        ]);
        return Response.json(mockMessage);
      });

      await client.messages.send({
        mailbox_id: "mbx_456",
        to: ["user@example.com"],
        subject: "Hello",
        text: "Hi",
        client_reference: "crm-123",
        metadata: { campaign: "onboarding", sequence: 2 },
        source_rfc_message_id: "<crm-123@example.com>",
        headers: [{ name: "List-Unsubscribe", value: "<https://example.com/unsubscribe/123>" }],
      });
    });
  });

  describe("list", () => {
    test("sends GET /messages with mailbox_id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        const url = new URL(String(input));
        expect(url.pathname).toBe("/v1/messages");
        expect(url.searchParams.get("mailbox_id")).toBe("mbx_456");
        return Response.json({
          data: [mockInboundMessage],
          pagination: { next_cursor: null, has_more: false, limit: 25 },
        });
      });

      const result = await client.messages.list({ mailbox_id: "mbx_456" });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.rule_disposition?.matched_rule_ids).toEqual([
        "rule_invoices",
        "rule_priority",
      ]);
      expect(result.pagination.has_more).toBe(false);
      expect(result.pagination.limit).toBe(25);
    });

    test("sends cursor and limit", async () => {
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("cursor")).toBe("abc");
        expect(url.searchParams.get("limit")).toBe("10");
        return Response.json({
          data: [],
          pagination: { next_cursor: null, has_more: false, limit: 10 },
        });
      });

      await client.messages.list({ mailbox_id: "mbx_456", cursor: "abc", limit: 10 });
    });

    test("looks up a message by client_reference without a mailbox id", async () => {
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("mailbox_id")).toBeNull();
        expect(url.searchParams.get("client_reference")).toBe("crm-123");
        return Response.json({
          data: [mockMessage],
          pagination: { next_cursor: null, has_more: false, limit: 25 },
        });
      });

      const result = await client.messages.list({ client_reference: "crm-123" });
      expect(result.data[0]?.client_reference).toBe("crm-123");
    });
  });

  describe("get", () => {
    test("sends GET /messages/:id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/messages/msg_123");
        return Response.json(mockInboundMessage);
      });

      const message = await client.messages.get("msg_123");
      expect(message.id).toBe("msg_123");
      expect(message.mailbox_id).toBe("mbx_456");
      expect(message.thread_id).toBe("thr_789");
      expect(message.conversation_id).toBe("thd_789");
      expect(message.source).toBe("inbound");
      expect(message.rule_disposition?.stop_rule_id).toBe("rule_priority");
    });
  });

  describe("listAnalytics", () => {
    test("sends bounded incremental analytics query", async () => {
      const client = createClient((input, init) => {
        const url = new URL(String(input));
        expect(init?.method).toBe("GET");
        expect(url.pathname).toBe("/v1/messages/analytics");
        expect(url.searchParams.get("updated_after")).toBe("2026-07-01T00:00:00.000Z");
        expect(url.searchParams.get("updated_before")).toBe("2026-07-29T00:00:00.000Z");
        expect(url.searchParams.get("cursor")).toBe("cursor_123");
        expect(url.searchParams.get("limit")).toBe("100");
        return Response.json({
          data: [],
          pagination: {
            next_cursor: null,
            has_more: false,
            limit: 100,
            snapshot_at: "2026-07-29T00:00:00.000Z",
          },
        });
      });

      const result = await client.messages.listAnalytics({
        updated_after: "2026-07-01T00:00:00.000Z",
        updated_before: "2026-07-29T00:00:00.000Z",
        cursor: "cursor_123",
        limit: 100,
      });
      expect(result.pagination.snapshot_at).toBe("2026-07-29T00:00:00.000Z");
    });
  });

  describe("reply", () => {
    test("sends POST /messages/:id/reply", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/messages/msg_123/reply");
        const body = JSON.parse(init?.body as string);
        expect(body.to).toEqual(["user@example.com"]);
        expect(body.text).toBe("Reply text");
        return Response.json(mockMessage);
      });

      const message = await client.messages.reply("msg_123", {
        to: ["user@example.com"],
        text: "Reply text",
      });
      expect(message.id).toBe("msg_123");
    });

    test("sends reply with object recipients and html", async () => {
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.to).toEqual([{ address: "user@example.com", name: "User" }]);
        expect(body.html).toBe("<p>Reply</p>");
        return Response.json(mockMessage);
      });

      await client.messages.reply("msg_123", {
        to: [{ address: "user@example.com", name: "User" }],
        html: "<p>Reply</p>",
      });
    });
  });
});
