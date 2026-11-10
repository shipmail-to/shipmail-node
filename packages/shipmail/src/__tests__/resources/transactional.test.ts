import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { TransactionalDomain, TransactionalSender } from "../../types/transactional.js";

type Captured = {
  readonly method: string;
  readonly url: URL;
  readonly body: string | null;
};

const domain: TransactionalDomain = {
  object: "transactional_domain",
  id: "txdom_0123456789abcdefghjkmnpq",
  name: "mail.example.com",
  root_domain: "example.com",
  status: "pending",
  mail_from_domain: "mail.mail.example.com",
  dns_records: [
    {
      key: "dkim",
      type: "TXT",
      host: "shipmail._domainkey.mail.example.com",
      value: "v=DKIM1; k=rsa; p=abc",
      priority: null,
      ttl: 300,
      description: "Signs your transactional email so inboxes trust it.",
      status: "pending",
    },
  ],
  verified_at: null,
  created_at: "2026-11-08T09:00:00.000Z",
};

const sender: TransactionalSender = {
  object: "transactional_sender",
  id: "txbind_0123456789abcdefghjkmnpq",
  from: "hello@mail.example.com",
  display_name: "Acme",
  domain_id: domain.id,
  mailbox_id: "550e8400-e29b-41d4-a716-446655440000",
  reply_to: "support@example.com",
  state: "active",
  refuse_disposable: false,
  smtp_enabled: false,
  created_at: "2026-11-08T09:00:00.000Z",
};

function createClient(captured: Captured[], respond: (request: Captured) => Response) {
  const fetchFn: typeof fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const request: Captured = {
        method: init?.method ?? "GET",
        url: new URL(String(input)),
        body: typeof init?.body === "string" ? init.body : null,
      };
      captured.push(request);
      return respond(request);
    },
    { preconnect: globalThis.fetch.preconnect },
  );
  return new ShipmailClient({
    apiKey: "sm_live_test",
    baseUrl: "https://api.test.com/v1",
    fetch: fetchFn,
    maxRetries: 0,
  });
}

function routes(captured: readonly Captured[]): string[] {
  return captured.map((request) => `${request.method} ${request.url.pathname}`);
}

describe("TransactionalDomains", () => {
  test("lists, creates, gets, verifies and deletes domains", async () => {
    const captured: Captured[] = [];
    const client = createClient(captured, (request) => {
      if (request.method === "DELETE") return new Response(null, { status: 204 });
      if (request.url.pathname === "/v1/transactional-domains" && request.method === "GET") {
        return Response.json({ object: "list", data: [domain] });
      }
      if (request.url.pathname.endsWith("/verify")) {
        return Response.json({ ...domain, status: "verified" });
      }
      return Response.json(domain, { status: request.method === "POST" ? 201 : 200 });
    });

    const list = await client.transactionalDomains.list();
    const created = await client.transactionalDomains.create({
      root_domain: "example.com",
      subdomain: "mail",
    });
    const fetched = await client.transactionalDomains.get(domain.id);
    const verified = await client.transactionalDomains.verify(domain.id);
    await client.transactionalDomains.delete(domain.id);

    expect(list.data[0]?.id).toBe(domain.id);
    expect(created.dns_records[0]?.key).toBe("dkim");
    expect(fetched.name).toBe("mail.example.com");
    expect(verified.status).toBe("verified");
    expect(routes(captured)).toEqual([
      "GET /v1/transactional-domains",
      "POST /v1/transactional-domains",
      `GET /v1/transactional-domains/${domain.id}`,
      `POST /v1/transactional-domains/${domain.id}/verify`,
      `DELETE /v1/transactional-domains/${domain.id}`,
    ]);
    expect(JSON.parse(captured[1]?.body ?? "null")).toEqual({
      root_domain: "example.com",
      subdomain: "mail",
    });
  });
});

describe("TransactionalSenders", () => {
  test("lists senders, filtered by domain", async () => {
    const captured: Captured[] = [];
    const client = createClient(captured, () => Response.json({ object: "list", data: [sender] }));

    await client.transactionalSenders.list();
    const filtered = await client.transactionalSenders.list({ domain_id: domain.id });

    expect(filtered.data[0]?.from).toBe("hello@mail.example.com");
    expect(captured[0]?.url.searchParams.has("domain_id")).toBe(false);
    expect(captured[1]?.url.searchParams.get("domain_id")).toBe(domain.id);
  });

  test("creates, gets and updates a sender", async () => {
    const captured: Captured[] = [];
    const client = createClient(captured, (request) => {
      if (request.method === "PATCH") return Response.json({ ...sender, state: "disabled" });
      return Response.json(sender, { status: request.method === "POST" ? 201 : 200 });
    });

    await client.transactionalSenders.create({
      domain_id: domain.id,
      mailbox_id: sender.mailbox_id,
      local_part: "hello",
      display_name: "Acme",
    });
    await client.transactionalSenders.get(sender.id);
    const updated = await client.transactionalSenders.update(sender.id, {
      state: "disabled",
      refuse_disposable: true,
    });

    expect(updated.state).toBe("disabled");
    expect(routes(captured)).toEqual([
      "POST /v1/transactional-senders",
      `GET /v1/transactional-senders/${sender.id}`,
      `PATCH /v1/transactional-senders/${sender.id}`,
    ]);
    expect(JSON.parse(captured[0]?.body ?? "null")).toEqual({
      domain_id: domain.id,
      mailbox_id: sender.mailbox_id,
      local_part: "hello",
      display_name: "Acme",
    });
    expect(JSON.parse(captured[2]?.body ?? "null")).toEqual({
      state: "disabled",
      refuse_disposable: true,
    });
  });
});
