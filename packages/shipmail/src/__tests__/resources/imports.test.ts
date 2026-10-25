import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { ImportUpload, MailboxImport, MailboxImports } from "../../types/import.js";

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

const mockImport: MailboxImport = {
  object: "import",
  id: "imp_123",
  mailbox_id: "mbx_123",
  kind: "imap",
  provider: "gmail",
  source_address: "old@gmail.com",
  status: "running",
  status_detail: null,
  error: null,
  resume_at: null,
  counts: {
    found: 100,
    imported: 40,
    undone: 0,
    duplicates_skipped: 2,
    oversize_skipped: 0,
    failed: 0,
    contacts_imported: 0,
  },
  bytes: { total: 1000, imported: 400 },
  created_at: "2026-06-12T00:00:00Z",
  started_at: "2026-06-12T00:00:01Z",
  completed_at: null,
};

describe("mailbox imports resource", () => {
  test("createImport posts the source and options", async () => {
    let captured: { url: string; method: string; body: unknown } | null = null;
    const client = createClient(async (input, init) => {
      captured = {
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      };
      return Response.json(mockImport, { status: 201 });
    });

    const result = await client.mailboxes.createImport("mbx_123", {
      source: {
        type: "imap",
        provider: "gmail",
        email: "old@gmail.com",
        password: "app-password",
      },
      options: { range: "12m", include_spam: false },
    });

    expect(result.id).toBe("imp_123");
    expect(captured?.method).toBe("POST");
    expect(captured?.url).toBe("https://api.test.com/v1/mailboxes/mbx_123/imports");
    const body = captured?.body as { source: { provider: string } };
    expect(body.source.provider).toBe("gmail");
  });

  test("listImports gets the imports list", async () => {
    const payload: MailboxImports = {
      object: "imports",
      mailbox_id: "mbx_123",
      data: [mockImport],
    };
    let url = "";
    const client = createClient(async (input) => {
      url = String(input);
      return Response.json(payload);
    });

    const result = await client.mailboxes.listImports("mbx_123");
    expect(result.data.length).toBe(1);
    expect(url).toBe("https://api.test.com/v1/mailboxes/mbx_123/imports");
  });

  test("getImport, cancelImport, resumeImport, restoreImport, and undoImport hit the import-scoped paths", async () => {
    const calls: Array<{ method: string; url: string; body: unknown }> = [];
    const client = createClient(async (input, init) => {
      calls.push({
        method: init?.method ?? "GET",
        url: String(input),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
      return Response.json(mockImport);
    });

    await client.mailboxes.getImport("mbx_123", "imp_123");
    await client.mailboxes.cancelImport("mbx_123", "imp_123");
    await client.mailboxes.resumeImport("mbx_123", "imp_123");
    await client.mailboxes.restoreImport("mbx_123", "imp_123", { file_ids: ["impf_1"] });
    await client.mailboxes.undoImport("mbx_123", "imp_123");

    expect(calls).toEqual([
      {
        method: "GET",
        url: "https://api.test.com/v1/mailboxes/mbx_123/imports/imp_123",
        body: null,
      },
      {
        method: "POST",
        url: "https://api.test.com/v1/mailboxes/mbx_123/imports/imp_123/cancel",
        body: null,
      },
      {
        method: "POST",
        url: "https://api.test.com/v1/mailboxes/mbx_123/imports/imp_123/resume",
        body: null,
      },
      {
        method: "POST",
        url: "https://api.test.com/v1/mailboxes/mbx_123/imports/imp_123/restore",
        body: { file_ids: ["impf_1"] },
      },
      {
        method: "POST",
        url: "https://api.test.com/v1/mailboxes/mbx_123/imports/imp_123/undo",
        body: null,
      },
    ]);
  });

  test("createImportUpload stages a file", async () => {
    const payload: ImportUpload = {
      object: "import_upload",
      file_id: "impf_1",
      part_size_bytes: 33_554_432,
      completed_parts: [],
      parts: [{ part_number: 1, upload_url: "https://r2.example.com/put-part-1" }],
      expires_in_seconds: 518_400,
    };
    let captured: { url: string; body: unknown } | null = null;
    const client = createClient(async (input, init) => {
      captured = {
        url: String(input),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      };
      return Response.json(payload, { status: 201 });
    });

    const result = await client.mailboxes.createImportUpload("mbx_123", {
      provider: "takeout",
      file_name: "takeout.mbox",
      size_bytes: 1024,
      source_fingerprint: "a".repeat(64),
    });

    expect(result.file_id).toBe("impf_1");
    expect(captured?.url).toBe("https://api.test.com/v1/mailboxes/mbx_123/imports/files");
    const body = captured?.body as {
      provider: string;
      file_name: string;
      source_fingerprint: string;
    };
    expect(body.provider).toBe("takeout");
    expect(body.file_name).toBe("takeout.mbox");
    expect(body.source_fingerprint).toBe("a".repeat(64));
  });

  test("completeImportUpload sends part ETags and abortImportUpload deletes the session", async () => {
    const calls: Array<{ method: string; url: string; body: unknown }> = [];
    const client = createClient(async (input, init) => {
      calls.push({
        method: init?.method ?? "GET",
        url: String(input),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
      return new Response(null, { status: 204 });
    });

    await client.mailboxes.completeImportUpload("mbx_123", "impf_1", {
      parts: [{ part_number: 1, etag: '"etag-1"' }],
    });
    await client.mailboxes.abortImportUpload("mbx_123", "impf_1");

    expect(calls).toEqual([
      {
        method: "POST",
        url: "https://api.test.com/v1/mailboxes/mbx_123/imports/files/impf_1/complete",
        body: { parts: [{ part_number: 1, etag: '"etag-1"' }] },
      },
      {
        method: "DELETE",
        url: "https://api.test.com/v1/mailboxes/mbx_123/imports/files/impf_1",
        body: null,
      },
    ]);
  });
});
