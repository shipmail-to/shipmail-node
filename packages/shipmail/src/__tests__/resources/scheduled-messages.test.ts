import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { ScheduledMessage } from "../../types/message.js";

const scheduledMessage: ScheduledMessage = {
  object: "scheduled_message",
  id: "msg_123",
  scheduled_message_id: "sch_123",
  status: "settling",
  kind: "scheduled",
  mailbox_id: "mbx_123",
  mailbox_address: "hello@example.com",
  from_address: "hello@example.com",
  identity_id: "ident_123",
  mode: "live",
  subject: "Hello",
  to: [{ address: "customer@example.net", name: null }],
  cc: [],
  bcc: [],
  attachments: [],
  scheduled_at: "2026-08-01T08:00:00.000Z",
  created_at: "2026-07-24T12:00:00.000Z",
  updated_at: "2026-07-24T12:00:00.000Z",
  last_error: null,
};

function clientWith(
  handler: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>,
): ShipmailClient {
  return new ShipmailClient({
    apiKey: "sm_live_test",
    baseUrl: "https://api.test.com/v1",
    maxRetries: 0,
    fetch: handler as typeof fetch,
  });
}

describe("ScheduledMessages", () => {
  test("lists scheduled messages with held and search filters", async () => {
    const client = clientWith((input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("GET");
      expect(url.pathname).toBe("/v1/scheduled-messages");
      expect(url.searchParams.get("include_held")).toBe("true");
      expect(url.searchParams.get("search")).toBe("Christelle");
      expect(url.searchParams.get("limit")).toBe("25");
      return Response.json({
        object: "scheduled_message_list",
        data: [scheduledMessage],
        total: 1,
      });
    });

    const result = await client.scheduledMessages.list({
      include_held: true,
      search: "Christelle",
      limit: 25,
    });
    expect(result.data[0]?.id).toBe("msg_123");
    expect(result.data[0]?.status).toBe("settling");
  });

  test("gets, replaces, and cancels a scheduled message", async () => {
    const requests: Array<{ readonly url: URL; readonly init?: RequestInit }> = [];
    const client = clientWith((input, init) => {
      requests.push({ url: new URL(String(input)), init });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json(scheduledMessage);
    });

    await client.scheduledMessages.get("msg_123");
    await client.scheduledMessages.update(
      "msg_123",
      {
        to: ["customer@example.net"],
        subject: "Updated",
        text: "Updated body",
        staged_attachment_ids: ["sat_123"],
        scheduled_at: "2026-08-02T08:00:00.000Z",
      },
      { idempotencyKey: "update-123" },
    );
    await client.scheduledMessages.cancel("msg_123");

    expect(requests.map((request) => request.init?.method)).toEqual(["GET", "PATCH", "DELETE"]);
    expect(requests.map((request) => request.url.pathname)).toEqual([
      "/v1/scheduled-messages/msg_123",
      "/v1/scheduled-messages/msg_123",
      "/v1/scheduled-messages/msg_123",
    ]);
    expect(JSON.parse(String(requests[1]?.init?.body)) as Record<string, unknown>).toMatchObject({
      subject: "Updated",
      staged_attachment_ids: ["sat_123"],
    });
    expect(new Headers(requests[1]?.init?.headers).get("Idempotency-Key")).toBe("update-123");
  });
});
