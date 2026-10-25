import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";

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

const scan = {
  object: "reply_scan",
  id: "rsc_123",
  mailbox_ids: ["mbx_123"],
  after: "2025-07-20T00:00:00.000Z",
  before: "2026-07-20T00:00:00.000Z",
  snapshot_at: "2026-07-20T00:00:00.000Z",
  status: "completed",
  candidate_count: 1,
  completed_at: "2026-07-20T00:00:02.000Z",
  created_at: "2026-07-20T00:00:00.000Z",
} as const;

describe("ReplyScans", () => {
  test("creates a bounded completed snapshot", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/reply-scans");
      expect(JSON.parse(init?.body as string)).toEqual({
        mailbox_ids: ["mbx_123"],
        after: "2025-07-20T00:00:00.000Z",
        before: "2026-07-20T00:00:00.000Z",
      });
      return Response.json(scan, { status: 201 });
    });

    const result = await client.replyScans.create({
      mailbox_ids: ["mbx_123"],
      after: "2025-07-20T00:00:00.000Z",
      before: "2026-07-20T00:00:00.000Z",
    });
    expect(result.id).toBe("rsc_123");
  });

  test("gets a scan with an encoded id", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe("/v1/reply-scans/rsc%2F123");
      return Response.json(scan);
    });

    expect((await client.replyScans.get("rsc/123")).status).toBe("completed");
  });

  test("lists frozen results with opaque cursor pagination", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      const url = new URL(String(input));
      expect(url.pathname).toBe("/v1/reply-scans/rsc_123/results");
      expect(url.searchParams.get("cursor")).toBe("opaque_cursor");
      expect(url.searchParams.get("limit")).toBe("25");
      return Response.json({
        object: "reply_scan_results",
        scan_id: "rsc_123",
        data: [],
        pagination: { limit: 25, has_more: false, next_cursor: null },
      });
    });

    const result = await client.replyScans.listResults("rsc_123", {
      cursor: "opaque_cursor",
      limit: 25,
    });
    expect(result.scan_id).toBe("rsc_123");
  });
});
