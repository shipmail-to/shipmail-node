import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { MailboxExport } from "../../types/mailbox.js";

const mailboxExport: MailboxExport = {
  object: "mailbox_export",
  id: "mbexp_0123456789abcdefghjkmnpq",
  mailbox_id: "mbx_123",
  status: "completed",
  format: "zip",
  format_version: 1,
  file_size: 4096,
  message_count: 12,
  folder_count: 4,
  error_code: null,
  download_url: "https://download.test/export.zip",
  download_url_expires_at: "2026-07-13T12:05:00.000Z",
  expires_at: "2026-07-20T12:00:00.000Z",
  created_at: "2026-07-13T12:00:00.000Z",
  started_at: "2026-07-13T12:00:01.000Z",
  completed_at: "2026-07-13T12:00:02.000Z",
};

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

describe("mailbox exports resource", () => {
  test("creates and reads a mailbox export", async () => {
    const calls: string[] = [];
    const client = createClient(async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return Response.json(mailboxExport);
    });

    const created = await client.mailboxes.createExport("mbx/123", {
      idempotencyKey: "export-1",
    });
    const fetched = await client.mailboxes.getExport("mbx/123", mailboxExport.id);

    expect(created.status).toBe("completed");
    expect(fetched.download_url).toBe("https://download.test/export.zip");
    expect(calls).toEqual([
      "POST https://api.test.com/v1/mailboxes/mbx%2F123/exports",
      `GET https://api.test.com/v1/mailboxes/mbx%2F123/exports/${mailboxExport.id}`,
    ]);
  });
});
