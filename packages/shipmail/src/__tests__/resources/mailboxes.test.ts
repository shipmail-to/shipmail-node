import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { PaginatedResponse } from "../../types/common.js";
import type {
  InboxMessageAction,
  InboxMessages,
  InboxThread,
  Mailbox,
  MailboxFolder,
  MailboxFolders,
  MailboxForwarding,
  MailboxForwardingList,
  MailboxIdentities,
  MailboxRules,
} from "../../types/mailbox.js";

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

const mockMailbox: Mailbox = {
  object: "mailbox",
  id: "mbx_123",
  domain_id: "dom_456",
  address: "hello@example.com",
  display_name: "Hello",
  suspended_at: null,
  suspension_reasons: [],
  auto_reply: {
    enabled: false,
    subject: null,
    body: null,
    from_date: null,
    to_date: null,
  },
  agent_security_hold: false,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockMailboxForwarding: MailboxForwarding = {
  object: "mailbox_forwarding",
  id: "fwd_0123456789abcdefghjkmnpq",
  mailbox_id: "mbx_123",
  destination: "owner@example.net",
  sender: "newsletter@example.com",
  recipient: "nabeel@example.com",
  status: "pending",
  verification_sent_at: "2026-07-13T12:00:00Z",
  verified_at: null,
  created_at: "2026-07-13T12:00:00Z",
  updated_at: "2026-07-13T12:00:00Z",
};

const mockMailboxForwardingList: MailboxForwardingList = {
  object: "mailbox_forwarding_list",
  mailbox_id: "mbx_123",
  data: [mockMailboxForwarding],
};

const mockMailboxFolder: MailboxFolder = {
  object: "mailbox_folder",
  id: "fld_123",
  name: "VIP",
  parent_id: null,
  role: null,
  kind: "custom",
  total_emails: 0,
  unread_emails: 0,
  unread_threads: 0,
  sort_order: 0,
};

const mockMailboxFolders: MailboxFolders = {
  object: "mailbox_folders",
  mailbox_id: "mbx_123",
  address: "hello@example.com",
  data: [mockMailboxFolder],
};

const mockMailboxRules: MailboxRules = {
  object: "mailbox_rules",
  mailbox_id: "mbx_123",
  address: "hello@example.com",
  rules: [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Flag invoices",
      enabled: true,
      position: 0,
      match_mode: "all",
      stop: false,
      conditions: [{ type: "subject_contains", value: "invoice" }],
      actions: [{ type: "star" }],
    },
  ],
  folders: [{ id: "fld_123", name: "VIP", parent_id: null, role: null, kind: "custom" }],
};

const mockMailboxIdentities: MailboxIdentities = {
  object: "mailbox_identities",
  mailbox_id: "mbx_123",
  address: "hello@example.com",
  data: [
    {
      object: "mailbox_identity",
      id: "ident_123",
      name: "Hello",
      email: "hello@example.com",
    },
  ],
};

const mockInboxMessages: InboxMessages = {
  object: "inbox_messages",
  mailbox_id: "mbx_123",
  address: "hello@example.com",
  junk_total: null,
  data: [
    {
      object: "inbox_message_full",
      id: "eml_123",
      thread_id: "thr_123",
      conversation_id: "thd_123",
      mailbox_id: "mbx_123",
      address: "hello@example.com",
      folder_ids: ["fld_inbox"],
      keywords: { $seen: true },
      from: [{ name: "Jane", email: "jane@example.com" }],
      to: [{ name: null, email: "hello@example.com" }],
      cc: null,
      reply_to: null,
      message_id: ["msg-1@example.com"],
      in_reply_to: null,
      references: null,
      subject: "Hello",
      received_at: "2026-05-13T12:00:00Z",
      preview: "Accept your Linear invite",
      has_attachment: true,
      size: 456,
      body_values: {
        body_1: {
          value: "Accept your Linear invite: https://linear.app/invite/example",
          is_encoding_problem: false,
        },
      },
      text_body: [{ part_id: "body_1", type: "text/plain" }],
      html_body: [],
      attachments: [
        {
          part_id: "att_1",
          blob_id: "blob/123",
          name: "invite.ics",
          content_type: "text/calendar",
          size: 1024,
          download_path:
            "/mailboxes/mbx_123/inbox/attachments?message_id=eml_123&blob_id=blob%2F123&name=invite.ics",
        },
      ],
      authentication_results: {
        spf: "pass",
        dkim: "pass",
        dmarc: "pass",
        spam: { isSpam: false, scoreMilli: -1200 },
        raw: {
          authenticationResults: "mx.example; spf=pass; dkim=pass; dmarc=pass",
          receivedSpf: "pass",
          spamStatus: "No, score=-1.2",
        },
      },
      security: {
        status: "flagged",
        risk_codes: ["instruction_override"],
        scanner: "pattern_v1",
        content_sha256: "a".repeat(64),
        review: null,
      },
      reply_text: "Accept your Linear invite",
    },
  ],
  pagination: { limit: 10, total: 1, has_more: false, next_cursor: null },
};

const mockInboxThread: InboxThread = {
  object: "inbox_thread",
  mailbox_id: "mbx_123",
  address: "hello@example.com",
  thread_id: "thr_123",
  conversation_id: "thd_123",
  version: 7,
  data: [
    {
      object: "inbox_message_full",
      id: "eml_123",
      thread_id: "thr_123",
      conversation_id: "thd_123",
      mailbox_id: "mbx_123",
      address: "hello@example.com",
      folder_ids: ["fld_inbox"],
      keywords: {},
      from: [{ name: "Jane", email: "jane@example.com" }],
      to: [{ name: null, email: "hello@example.com" }],
      cc: null,
      reply_to: null,
      message_id: ["msg-1@example.com"],
      in_reply_to: null,
      references: null,
      subject: "Hello",
      received_at: "2026-05-13T12:00:00Z",
      preview: "Hi",
      has_attachment: true,
      size: 456,
      body_values: { body_1: { value: "Hi", is_encoding_problem: false } },
      text_body: [{ part_id: "body_1", type: "text/plain" }],
      html_body: [],
      attachments: [
        {
          part_id: "att_1",
          blob_id: "blob/123",
          name: "invoice.pdf",
          content_type: "application/pdf",
          size: 1024,
          download_path:
            "/mailboxes/mbx_123/inbox/attachments?message_id=eml_123&blob_id=blob%2F123&name=invoice.pdf",
        },
      ],
      authentication_results: {
        spf: "pass",
        dkim: "pass",
        dmarc: "pass",
        spam: { isSpam: false, scoreMilli: -1200 },
        raw: {
          authenticationResults: "mx.example; spf=pass; dkim=pass; dmarc=pass",
          receivedSpf: "pass",
          spamStatus: "No, score=-1.2",
        },
      },
      security: {
        status: "not_flagged",
        risk_codes: [],
        scanner: "pattern_v1",
        content_sha256: "b".repeat(64),
        review: null,
      },
      reply_text: "Hi",
    },
  ],
};

const mockInboxMessageAction: InboxMessageAction = {
  object: "inbox_message_action",
  mailbox_id: "mbx_123",
  address: "hello@example.com",
  message_id: "eml_123",
  ok: true,
  folder_ids: ["fld_inbox"],
  keywords: { $seen: true },
};

describe("Mailboxes", () => {
  describe("prepareStagedAttachmentUpload", () => {
    test("creates a one-time upload URL without an idempotency header", async () => {
      const client = createClient(async (input, init) => {
        expect(String(input)).toBe(
          "https://api.test.com/v1/mailboxes/mbx_123/staged-attachment-upload-tokens",
        );
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).has("idempotency-key")).toBe(false);
        expect(JSON.parse(String(init?.body))).toEqual({
          filename: "invoice.pdf",
          content_type: "application/pdf",
          size: 123,
          sha256: "a".repeat(64),
        });
        return Response.json({
          object: "staged_attachment_upload",
          mailbox_id: "mbx_123",
          filename: "invoice.pdf",
          content_type: "application/pdf",
          size: 123,
          sha256: "a".repeat(64),
          upload_url: "https://shipmail.to/api/v1/staged-attachment-uploads/token",
          expires_at: "2026-07-24T12:05:00.000Z",
        });
      });

      const result = await client.mailboxes.prepareStagedAttachmentUpload("mbx_123", {
        filename: "invoice.pdf",
        content_type: "application/pdf",
        size: 123,
        sha256: "a".repeat(64),
      });

      expect(result.upload_url).toContain("/staged-attachment-uploads/");
    });
  });

  describe("stageAttachment", () => {
    test("uploads raw bytes with filename and content type", async () => {
      const response = {
        object: "staged_attachment" as const,
        id: "sat_123",
        mailbox_id: "mbx_123",
        filename: "invoice.pdf",
        content_type: "application/pdf",
        size: 4,
        sha256: "a".repeat(64),
        expires_at: "2026-07-25T12:00:00.000Z",
      };
      const client = createClient(async (input, init) => {
        const url = new URL(String(input));
        expect(init?.method).toBe("POST");
        expect(url.pathname).toBe("/v1/mailboxes/mbx_123/staged-attachments");
        expect(url.searchParams.get("filename")).toBe("invoice.pdf");
        expect(new Headers(init?.headers).get("Content-Type")).toBe("application/pdf");
        expect(Array.from(new Uint8Array(await new Response(init?.body).arrayBuffer()))).toEqual([
          1, 2, 3, 4,
        ]);
        return Response.json(response, { status: 201 });
      });

      const staged = await client.mailboxes.stageAttachment("mbx_123", {
        filename: "invoice.pdf",
        content_type: "application/pdf",
        data: new Uint8Array([1, 2, 3, 4]),
      });
      expect(staged).toEqual(response);
    });
  });

  describe("injectSandboxInbound", () => {
    test("creates an isolated fake inbound message", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/sandbox/inbound");
        expect(JSON.parse(init?.body as string)).toEqual({
          from: "customer@example.com",
          subject: "Sandbox reply",
          text: "Looks good",
        });
        return Response.json({ object: "message", id: "msg_test", mode: "test" });
      });

      const message = await client.mailboxes.injectSandboxInbound("mbx_123", {
        from: "customer@example.com",
        subject: "Sandbox reply",
        text: "Looks good",
      });

      expect(message.mode).toBe("test");
    });
  });

  describe("create", () => {
    test("sends POST /mailboxes with body", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({
          domain_id: "dom_456",
          address: "hello@example.com",
          password: "StrongPass123",
          display_name: "Hello",
        });
        return Response.json(mockMailbox);
      });

      const mailbox = await client.mailboxes.create({
        domain_id: "dom_456",
        address: "hello@example.com",
        password: "StrongPass123",
        display_name: "Hello",
      });
      expect(mailbox.id).toBe("mbx_123");
      expect(mailbox.address).toBe("hello@example.com");
    });

    test("creates mailbox without optional display_name", async () => {
      const withoutName = { ...mockMailbox, display_name: null };
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({
          domain_id: "dom_456",
          address: "hello@example.com",
          password: "StrongPass123",
        });
        return Response.json(withoutName);
      });

      const mailbox = await client.mailboxes.create({
        domain_id: "dom_456",
        address: "hello@example.com",
        password: "StrongPass123",
      });
      expect(mailbox.display_name).toBeNull();
    });

    test("requests a server-generated primary password", async () => {
      const client = createClient((_input, init) => {
        expect(JSON.parse(init?.body as string)).toEqual({
          domain_id: "dom_456",
          address: "support",
          generate_password: true,
        });
        return Response.json(mockMailbox);
      });

      await client.mailboxes.create({
        domain_id: "dom_456",
        address: "support",
        generate_password: true,
      });
    });
  });

  describe("list", () => {
    test("sends GET /mailboxes", async () => {
      const response: PaginatedResponse<Mailbox> = {
        data: [mockMailbox],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes");
        return Response.json(response);
      });

      const result = await client.mailboxes.list();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("mbx_123");
    });

    test("sends domain_id filter", async () => {
      const response: PaginatedResponse<Mailbox> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("domain_id")).toBe("dom_456");
        return Response.json(response);
      });

      await client.mailboxes.list({ domain_id: "dom_456" });
    });

    test("sends cursor and limit", async () => {
      const response: PaginatedResponse<Mailbox> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("cursor")).toBe("cur_xyz");
        expect(url.searchParams.get("limit")).toBe("10");
        return Response.json(response);
      });

      await client.mailboxes.list({ cursor: "cur_xyz", limit: 10 });
    });
  });

  describe("get", () => {
    test("sends GET /mailboxes/:id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123");
        return Response.json(mockMailbox);
      });

      const mailbox = await client.mailboxes.get("mbx_123");
      expect(mailbox.id).toBe("mbx_123");
      expect(mailbox.address).toBe("hello@example.com");
    });
  });

  describe("update", () => {
    test("sends PATCH /mailboxes/:id with body", async () => {
      const updated = {
        ...mockMailbox,
        display_name: "Updated Name",
        agent_security_hold: true,
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("PATCH");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ display_name: "Updated Name", agent_security_hold: true });
        return Response.json(updated);
      });

      const mailbox = await client.mailboxes.update("mbx_123", {
        display_name: "Updated Name",
        agent_security_hold: true,
      });
      expect(mailbox.display_name).toBe("Updated Name");
      expect(mailbox.agent_security_hold).toBe(true);
    });

    test("sends null to clear display_name", async () => {
      const updated = { ...mockMailbox, display_name: null };
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ display_name: null });
        return Response.json(updated);
      });

      const mailbox = await client.mailboxes.update("mbx_123", {
        display_name: null,
      });
      expect(mailbox.display_name).toBeNull();
    });
  });

  describe("delete", () => {
    test("sends DELETE /mailboxes/:id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("DELETE");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123");
        return new Response(null, { status: 204 });
      });

      const result = await client.mailboxes.delete("mbx_123");
      expect(result).toBeUndefined();
    });
  });

  describe("suspension", () => {
    test("suspends and resumes a mailbox", async () => {
      const requests: string[] = [];
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        requests.push(new URL(String(input)).pathname);
        return Response.json(mockMailbox);
      });

      await client.mailboxes.suspend("mbx_123");
      await client.mailboxes.resume("mbx_123");

      expect(requests).toEqual(["/v1/mailboxes/mbx_123/suspend", "/v1/mailboxes/mbx_123/resume"]);
    });
  });

  describe("resetPassword", () => {
    test("sends PATCH /mailboxes/:id/password with body", async () => {
      const updated = { ...mockMailbox, updated_at: "2026-05-13T12:00:00Z" };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("PATCH");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/password");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ password: "NewPassword1" });
        return Response.json(updated);
      });

      const mailbox = await client.mailboxes.resetPassword("mbx_123", {
        password: "NewPassword1",
      });
      expect(mailbox.updated_at).toBe("2026-05-13T12:00:00Z");
    });
  });

  describe("forwarding", () => {
    test("lists mailbox forwarding destinations", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/forwarding");
        return Response.json(mockMailboxForwardingList);
      });

      const result = await client.mailboxes.listForwarding("mbx_123");
      expect(result.data[0]?.destination).toBe("owner@example.net");
      expect(result.data[0]?.sender).toBe("newsletter@example.com");
      expect(result.data[0]?.recipient).toBe("nabeel@example.com");
    });

    test("creates a mailbox forwarding destination", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/forwarding");
        expect(JSON.parse(init?.body as string)).toEqual({
          destination: "owner@example.net",
          sender: "newsletter@example.com",
          recipient: "nabeel@example.com",
        });
        return Response.json(mockMailboxForwarding);
      });

      const result = await client.mailboxes.createForwarding("mbx_123", {
        destination: "owner@example.net",
        sender: "newsletter@example.com",
        recipient: "nabeel@example.com",
      });
      expect(result.status).toBe("pending");
    });

    test("deletes a mailbox forwarding destination", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("DELETE");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/mailboxes/mbx_123/forwarding/fwd_0123456789abcdefghjkmnpq",
        );
        return new Response(null, { status: 204 });
      });

      await client.mailboxes.deleteForwarding("mbx_123", "fwd_0123456789abcdefghjkmnpq");
    });
  });

  describe("folders", () => {
    test("sends GET /mailboxes/:id/folders", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/folders");
        return Response.json(mockMailboxFolders);
      });

      const result = await client.mailboxes.listFolders("mbx_123");
      expect(result.data[0]?.id).toBe("fld_123");
    });

    test("sends POST /mailboxes/:id/folders with body", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/folders");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ name: "VIP", parent_id: null });
        return Response.json(mockMailboxFolder, { status: 201 });
      });

      const result = await client.mailboxes.createFolder("mbx_123", {
        name: "VIP",
        parent_id: null,
      });
      expect(result.name).toBe("VIP");
    });

    test("sends PATCH /mailboxes/:id/folders/:folderId with body", async () => {
      const renamed = { ...mockMailboxFolder, name: "VIP Clients" };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("PATCH");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/folders/fld_123");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ name: "VIP Clients" });
        return Response.json(renamed);
      });

      const result = await client.mailboxes.updateFolder("mbx_123", "fld_123", {
        name: "VIP Clients",
      });
      expect(result.name).toBe("VIP Clients");
    });

    test("sends DELETE /mailboxes/:id/folders/:folderId", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("DELETE");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/folders/fld_123");
        return new Response(null, { status: 204 });
      });

      const result = await client.mailboxes.deleteFolder("mbx_123", "fld_123");
      expect(result).toBeUndefined();
    });
  });

  describe("rules", () => {
    test("gets and replaces mailbox rules", async () => {
      const requests: { readonly method: string | undefined; readonly body: string | null }[] = [];
      const client = createClient((input, init) => {
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/rules");
        requests.push({
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : null,
        });
        return Response.json(mockMailboxRules);
      });

      const fetched = await client.mailboxes.getRules("mbx_123");
      const updated = await client.mailboxes.updateRules("mbx_123", {
        rules: mockMailboxRules.rules,
      });

      expect(fetched.rules[0]?.name).toBe("Flag invoices");
      expect(updated.rules[0]?.actions).toEqual([{ type: "star" }]);
      expect(requests.map((request) => request.method)).toEqual(["GET", "PUT"]);
      expect(JSON.parse(requests[1]?.body ?? "{}")).toEqual({ rules: mockMailboxRules.rules });
    });
  });

  describe("identities", () => {
    test("sends GET /mailboxes/:id/identities", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/identities");
        return Response.json(mockMailboxIdentities);
      });

      const result = await client.mailboxes.listIdentities("mbx_123");
      expect(result.data[0]?.email).toBe("hello@example.com");
    });
  });

  describe("inbox", () => {
    test("sends GET /mailboxes/:id/inbox/messages with filters", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        const url = new URL(String(input));
        expect(url.pathname).toBe("/v1/mailboxes/mbx_123/inbox/messages");
        expect(url.searchParams.get("folder_role")).toBe("inbox");
        expect(url.searchParams.get("cursor")).toBe("cursor_5");
        expect(url.searchParams.get("after")).toBe("2025-07-20T00:00:00.000Z");
        expect(url.searchParams.get("before")).toBe("2026-07-20T00:00:00.000Z");
        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.get("has_keyword")).toBe("$seen");
        expect(url.searchParams.get("from")).toBe("jane@example.com");
        expect(url.searchParams.get("to")).toBe("billing");
        expect(url.searchParams.get("subject")).toBe("Invoice");
        expect(url.searchParams.get("has_attachment")).toBe("false");
        return Response.json(mockInboxMessages);
      });

      const result = await client.mailboxes.listInboxMessages("mbx_123", {
        folder_role: "inbox",
        cursor: "cursor_5",
        after: "2025-07-20T00:00:00.000Z",
        before: "2026-07-20T00:00:00.000Z",
        limit: 10,
        has_keyword: "$seen",
        from: "jane@example.com",
        to: "billing",
        subject: "Invoice",
        has_attachment: false,
      });
      expect(result.data[0]?.id).toBe("eml_123");
      expect(result.data[0]?.body_values.body_1?.value).toContain("linear.app/invite");
      expect(result.data[0]?.authentication_results?.dmarc).toBe("pass");
    });

    test("gets an exact inbox message", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/mailboxes/mbx_123/inbox/messages/eml_123",
        );
        return Response.json(mockInboxMessages.data[0]);
      });

      const result = await client.mailboxes.getInboxMessage("mbx_123", "eml_123");
      expect(result.id).toBe("eml_123");
      expect(result.authentication_results?.spam.scoreMilli).toBe(-1200);
    });

    test("lists the attention queue with cursor-bound filters", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        const url = new URL(String(input));
        expect(url.pathname).toBe("/v1/mailboxes/mbx_123/inbox/threads");
        expect(url.searchParams.get("attention_state")).toBe("needs_reply");
        expect(url.searchParams.get("after")).toBe("2025-07-20T00:00:00.000Z");
        expect(url.searchParams.get("cursor")).toBe("queue_cursor");
        return Response.json({
          object: "inbox_threads",
          mailbox_id: "mbx_123",
          data: [],
          summary: {
            needs_reply: 0,
            waiting_on_them: 0,
            done: 0,
            follow_up_due: 0,
            delivery_failed: 0,
            no_action: 0,
          },
          pagination: {
            limit: 25,
            has_more: false,
            next_cursor: null,
            snapshot_at: "2026-07-20T00:00:00.000Z",
          },
        });
      });

      const result = await client.mailboxes.listInboxThreads("mbx_123", {
        attention_state: "needs_reply",
        after: "2025-07-20T00:00:00.000Z",
        cursor: "queue_cursor",
        limit: 25,
      });
      expect(result.object).toBe("inbox_threads");
    });

    test("updates state and uses a versioned draft before sending", async () => {
      const requests: string[] = [];
      const client = createClient((input, init) => {
        const url = new URL(String(input));
        requests.push(`${init?.method} ${url.pathname}`);
        if (init?.method === "PATCH") {
          expect(JSON.parse(init.body as string)).toEqual({
            done: true,
            expected_version: 7,
          });
          return Response.json({
            object: "inbox_thread_attention",
            id: "thd_tracked",
            thread_id: "thr_123",
            conversation_id: "thd_123",
            attention_state: "done",
            version: 8,
            attention_since: null,
            done_at: "2026-07-20T00:00:00.000Z",
            follow_up_at: null,
          });
        }
        if (url.pathname.endsWith("/drafts")) {
          expect(JSON.parse(init?.body as string)).toEqual({
            text: "Thanks for the note.",
            expected_version: 7,
          });
          return Response.json({
            object: "inbox_reply_draft",
            id: "drf_123",
            mailbox_id: "mbx_123",
            thread_id: "thr_123",
            conversation_id: "thd_123",
            based_on_message_id: "msg_123",
            expected_version: 7,
            reply_mode: "reply",
            status: "draft",
            to: [{ address: "jane@example.com", name: "Jane" }],
            cc: [],
            created_at: "2026-07-20T00:00:00.000Z",
          });
        }
        expect(JSON.parse(String(init?.body))).toEqual({
          expected_content_sha256: "a".repeat(64),
        });
        return Response.json({
          object: "inbox_reply_draft_send",
          draft_id: "drf_123",
          status: "sent",
          message: { object: "message", id: "msg_sent" },
        });
      });

      await client.mailboxes.updateInboxThreadAttention("mbx_123", "thr_123", {
        done: true,
        expected_version: 7,
      });
      await client.mailboxes.createInboxReplyDraft("mbx_123", "thr_123", {
        text: "Thanks for the note.",
        expected_version: 7,
      });
      await client.mailboxes.sendInboxReplyDraft("mbx_123", "thr_123", "drf_123", {
        expectedContentSha256: "a".repeat(64),
      });
      expect(requests).toEqual([
        "PATCH /v1/mailboxes/mbx_123/inbox/threads/thr_123",
        "POST /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts",
        "POST /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts/drf_123/send",
      ]);
    });

    test("preserves the legacy fourth MethodOptions argument without adding a send body", async () => {
      const client = createClient((_input, init) => {
        expect(init?.method).toBe("POST");
        expect(init?.body).toBeNull();
        expect(new Headers(init?.headers).get("idempotency-key")).toBe("legacy-send");
        return Response.json({
          object: "inbox_reply_draft_send",
          draft_id: "drf_123",
          status: "sent",
          message: { object: "message", id: "msg_sent" },
        });
      });

      await client.mailboxes.sendInboxReplyDraft("mbx_123", "thr_123", "drf_123", {
        idempotencyKey: "legacy-send",
      });
    });

    test("lists, reads, updates and deletes reply drafts", async () => {
      const draft = {
        object: "inbox_reply_draft",
        id: "drf_123",
        mailbox_id: "mbx_123",
        thread_id: "thr_123",
        conversation_id: "thd_123",
        based_on_message_id: "msg_123",
        expected_version: 7,
        reply_mode: "reply",
        status: "draft",
        to: [{ address: "jane@example.com", name: "Jane" }],
        cc: [],
        subject: "Re: Intro",
        html: "<p>Thanks.</p>",
        text: "Thanks.",
        content_sha256: "a".repeat(64),
        sent_message_id: null,
        created_at: "2026-10-16T00:00:00.000Z",
        updated_at: "2026-10-16T00:01:00.000Z",
        sent_at: null,
      };
      const requests: string[] = [];
      const client = createClient((input, init) => {
        const method = init?.method ?? "GET";
        requests.push(`${method} ${new URL(String(input)).pathname}`);
        if (method === "PATCH") {
          expect(JSON.parse(String(init?.body))).toEqual({ html: "<p>Thanks.</p><table></table>" });
          return Response.json({ ...draft, removed_formatting: ["table"] });
        }
        if (method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        if (new URL(String(input)).pathname.endsWith("/drafts")) {
          return Response.json({ object: "list", data: [draft] });
        }
        return Response.json(draft);
      });

      const list = await client.mailboxes.listInboxReplyDrafts("mbx_123", "thr_123");
      expect(list.data[0]?.html).toBe("<p>Thanks.</p>");
      const read = await client.mailboxes.getInboxReplyDraft("mbx_123", "thr_123", "drf_123");
      expect(read.updated_at).toBe("2026-10-16T00:01:00.000Z");
      const updated = await client.mailboxes.updateInboxReplyDraft(
        "mbx_123",
        "thr_123",
        "drf_123",
        {
          html: "<p>Thanks.</p><table></table>",
        },
      );
      expect(updated.removed_formatting).toEqual(["table"]);
      const deleted = await client.mailboxes.deleteInboxReplyDraft("mbx_123", "thr_123", "drf_123");
      expect(deleted).toBeUndefined();
      expect(requests).toEqual([
        "GET /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts",
        "GET /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts/drf_123",
        "PATCH /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts/drf_123",
        "DELETE /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts/drf_123",
      ]);
    });

    test("sends GET /mailboxes/:id/inbox/threads/:threadId", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/inbox/threads/thr_123");
        return Response.json(mockInboxThread);
      });

      const result = await client.mailboxes.getInboxThread("mbx_123", "thr_123");
      expect(result.version).toBe(7);
      expect(result.data[0]?.attachments[0]?.blob_id).toBe("blob/123");
      expect(result.data[0]?.authentication_results?.raw.receivedSpf).toBe("pass");
    });

    test("releases the exact security-reviewed inbox snapshot", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/mailboxes/mbx_123/inbox/messages/eml_123/security-review",
        );
        expect(JSON.parse(String(init?.body))).toEqual({
          decision: "release",
          reason: "Known invoice workflow",
          expected_content_sha256: "a".repeat(64),
        });
        return Response.json({
          object: "inbox_message_security_review",
          mailbox_id: "mbx_123",
          message_id: "eml_123",
          security: {
            status: "flagged",
            risk_codes: ["instruction_override"],
            scanner: "pattern_v1",
            content_sha256: "a".repeat(64),
            review: {
              decision: "released",
              released_at: "2026-10-23T12:00:00.000Z",
              released_by: "api_key",
            },
          },
        });
      });

      const result = await client.mailboxes.releaseInboxMessageSecurity("mbx_123", "eml_123", {
        decision: "release",
        reason: "Known invoice workflow",
        expected_content_sha256: "a".repeat(64),
      });
      expect(result.security.review?.released_by).toBe("api_key");
    });

    test("saves a new message draft with POST /mailboxes/:id/inbox/drafts", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/inbox/drafts");
        expect(JSON.parse(String(init?.body))).toEqual({
          to: ["jane@example.com"],
          bcc: [{ address: "log@example.com", name: "Log" }],
          subject: "Intro",
          text: "Hi Jane,",
        });
        return Response.json(
          {
            object: "inbox_draft",
            id: "eml_draft",
            mailbox_id: "mbx_123",
            from: { address: "founder@example.com", name: null },
            to: [{ address: "jane@example.com", name: null }],
            cc: [],
            bcc: [{ address: "log@example.com", name: "Log" }],
            subject: "Intro",
            removed_formatting: [],
            created_at: "2026-09-24T00:00:00.000Z",
          },
          { status: 201 },
        );
      });

      const draft = await client.mailboxes.createInboxDraft("mbx_123", {
        to: ["jane@example.com"],
        bcc: [{ address: "log@example.com", name: "Log" }],
        subject: "Intro",
        text: "Hi Jane,",
      });
      expect(draft.object).toBe("inbox_draft");
      expect(draft.id).toBe("eml_draft");
      expect(draft.bcc[0]?.address).toBe("log@example.com");
    });

    test("replies to a JMAP inbox message within its mailbox", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/mailboxes/mbx_123/inbox/messages/eml_123/reply",
        );
        expect(JSON.parse(init?.body as string)).toEqual({
          to: ["jane@example.com"],
          text: "Thanks for the note.",
        });
        return Response.json({ object: "message", id: "msg_reply" });
      });

      const result = await client.mailboxes.replyToInboxMessage("mbx_123", "eml_123", {
        to: ["jane@example.com"],
        text: "Thanks for the note.",
      });
      expect(result.id).toBe("msg_reply");
    });

    test("replies to a JMAP inbox thread within its mailbox", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/mailboxes/mbx_123/inbox/threads/thr_123/reply",
        );
        return Response.json({ object: "message", id: "msg_thread_reply" });
      });

      const result = await client.mailboxes.replyToInboxThread("mbx_123", "thr_123", {
        to: ["jane@example.com"],
        text: "Following up.",
      });
      expect(result.id).toBe("msg_thread_reply");
    });

    test("sends PATCH /mailboxes/:id/inbox/messages/:messageId", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("PATCH");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/mailboxes/mbx_123/inbox/messages/eml_123",
        );
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ read: true, starred: false });
        return Response.json(mockInboxMessageAction);
      });

      const result = await client.mailboxes.updateInboxMessage("mbx_123", "eml_123", {
        read: true,
        starred: false,
      });
      expect(result.ok).toBe(true);
      expect(result.message_id).toBe("eml_123");
    });

    test("sends POST /mailboxes/:id/inbox/messages/:messageId/move", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/mailboxes/mbx_123/inbox/messages/eml_123/move",
        );
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ from_folder_id: "fld_inbox", target_role: "archive" });
        return Response.json(mockInboxMessageAction);
      });

      const result = await client.mailboxes.moveInboxMessage("mbx_123", "eml_123", {
        from_folder_id: "fld_inbox",
        target_role: "archive",
      });
      expect(result.ok).toBe(true);
      expect(result.message_id).toBe("eml_123");
    });

    test("sends DELETE /mailboxes/:id/inbox/messages/:messageId", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("DELETE");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/mailboxes/mbx_123/inbox/messages/eml_123",
        );
        return new Response(null, { status: 204 });
      });

      const result = await client.mailboxes.deleteInboxMessage("mbx_123", "eml_123");
      expect(result).toBeUndefined();
    });

    test("downloads an inbox attachment as bytes", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        const headers = new Headers(init?.headers as HeadersInit);
        const url = new URL(String(input));
        expect(headers.get("Accept")).toBe("application/octet-stream");
        expect(url.pathname).toBe("/v1/mailboxes/mbx_123/inbox/attachments");
        expect(url.searchParams.get("blob_id")).toBe("blob/123");
        expect(url.searchParams.get("name")).toBe("invoice.pdf");
        return new Response(new Uint8Array([1, 2, 3]));
      });

      const result = await client.mailboxes.downloadInboxAttachment("mbx_123", {
        blob_id: "blob/123",
        name: "invoice.pdf",
      });
      expect([...result]).toEqual([1, 2, 3]);
    });
  });

  describe("delivery routing", () => {
    test("gets and updates mailbox delivery routing", async () => {
      const requests: { readonly method: string | undefined; readonly body: string | null }[] = [];
      const response = {
        object: "mailbox_delivery_routing" as const,
        mailbox_id: "mbx_123",
        source_address: "sales@example.com",
        mode: "round_robin" as const,
        destination_mailbox_ids: ["mbx_a", "mbx_b"],
        fallback_mailbox_id: "mbx_fallback",
        activation_state: "pending" as const,
        activation_error: null,
        destinations: [],
      };
      const client = createClient((input, init) => {
        expect(new URL(String(input)).pathname).toBe("/v1/mailboxes/mbx_123/delivery-routing");
        requests.push({
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : null,
        });
        return Response.json(response);
      });

      const fetched = await client.mailboxes.getDeliveryRouting("mbx_123");
      const updated = await client.mailboxes.updateDeliveryRouting("mbx_123", {
        mode: "round_robin",
        destination_mailbox_ids: ["mbx_a", "mbx_b"],
        fallback_mailbox_id: "mbx_fallback",
      });

      expect(fetched.mode).toBe("round_robin");
      expect(updated).toMatchObject({ mode: "round_robin", activation_state: "pending" });
      expect(requests).toEqual([
        { method: "GET", body: null },
        {
          method: "PATCH",
          body: JSON.stringify({
            mode: "round_robin",
            destination_mailbox_ids: ["mbx_a", "mbx_b"],
            fallback_mailbox_id: "mbx_fallback",
          }),
        },
      ]);
    });
  });

  describe("app passwords", () => {
    test("creates, lists, and revokes a mailbox app password", async () => {
      const requests: string[] = [];
      const client = createClient((input, init) => {
        const url = new URL(String(input));
        requests.push(`${init?.method ?? "GET"} ${url.pathname}`);
        if (init?.method === "POST") {
          expect(JSON.parse(String(init.body))).toEqual({
            name: "Embedded webmail",
            expires_at: "2027-01-01T00:00:00.000Z",
            allowed_cidrs: ["203.0.113.0/24"],
          });
          return Response.json({
            object: "mailbox_app_password",
            id: "appwd_123",
            mailbox_id: "mbx_123",
            name: "Embedded webmail",
            state: "active",
            purpose: "operator_client",
            expires_at: "2027-01-01T00:00:00.000Z",
            allowed_cidrs: ["203.0.113.0/24"],
            last_used_at: null,
            created_at: "2026-07-15T00:00:00.000Z",
            revoked_at: null,
            secret: "app_once",
          });
        }
        if (init?.method === "DELETE") return new Response(null, { status: 204 });
        return Response.json({ object: "list", data: [] });
      });

      const created = await client.mailboxes.createAppPassword("mbx_123", {
        name: "Embedded webmail",
        expires_at: "2027-01-01T00:00:00.000Z",
        allowed_cidrs: ["203.0.113.0/24"],
      });
      expect(created.secret).toBe("app_once");
      await client.mailboxes.listAppPasswords("mbx_123");
      await client.mailboxes.revokeAppPassword("mbx_123", "appwd:opaque/123");
      expect(requests).toEqual([
        "POST /v1/mailboxes/mbx_123/app-passwords",
        "GET /v1/mailboxes/mbx_123/app-passwords",
        "DELETE /v1/mailboxes/mbx_123/app-passwords/appwd%3Aopaque%2F123",
      ]);
    });
  });
});
