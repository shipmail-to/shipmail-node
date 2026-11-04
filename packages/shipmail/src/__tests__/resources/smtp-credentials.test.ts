import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { SmtpCredential } from "../../types/smtp-credential.js";

type Captured = {
  readonly method: string;
  readonly url: URL;
  readonly headers: Headers;
  readonly body: string | null;
};

const credential: SmtpCredential = {
  object: "smtp_credential",
  id: "smtpc_0123456789abcdefghjkmnpq",
  from: "notifications@notify.example.com",
  name: "Supabase Auth",
  username: "smtp-smtpc_0123456789abcdefghjkmnpq@txsmtp.shipmail.to",
  host: "mx1.shipmail.to",
  ports: [
    { port: 465, security: "tls" },
    { port: 587, security: "starttls" },
  ],
  last_used_at: null,
  created_at: "2026-11-03T00:00:00.000Z",
};

function createClient(captured: Captured[], respond: (request: Captured) => Response) {
  const fetchFn: typeof fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const request: Captured = {
        method: init?.method ?? "GET",
        url: new URL(String(input)),
        headers: new Headers(init?.headers),
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

describe("SmtpCredentials", () => {
  test("lists credentials, filtered by sender", async () => {
    const captured: Captured[] = [];
    const client = createClient(captured, () =>
      Response.json({ object: "list", data: [credential] }),
    );

    const all = await client.smtpCredentials.list();
    const one = await client.smtpCredentials.list({ from: "notifications@notify.example.com" });

    expect(all.data[0]?.id).toBe(credential.id);
    expect(one.data).toHaveLength(1);
    expect(captured.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
      "GET /v1/smtp-credentials",
      "GET /v1/smtp-credentials",
    ]);
    expect(captured[0]?.url.searchParams.has("from")).toBe(false);
    expect(captured[1]?.url.searchParams.get("from")).toBe("notifications@notify.example.com");
  });

  test("creates a credential without an Idempotency-Key and returns the password", async () => {
    const captured: Captured[] = [];
    const client = createClient(captured, () =>
      Response.json({ ...credential, password: "shown-once" }, { status: 201 }),
    );

    const created = await client.smtpCredentials.create({
      from: "notifications@notify.example.com",
      name: "Supabase Auth",
    });

    expect(created.password).toBe("shown-once");
    expect(created.ports).toEqual(credential.ports);
    expect(captured[0]?.method).toBe("POST");
    expect(captured[0]?.url.pathname).toBe("/v1/smtp-credentials");
    expect(captured[0]?.headers.get("Idempotency-Key")).toBeNull();
    expect(JSON.parse(captured[0]?.body ?? "null")).toEqual({
      from: "notifications@notify.example.com",
      name: "Supabase Auth",
    });
  });

  test("revokes a credential by ID", async () => {
    const captured: Captured[] = [];
    const client = createClient(captured, () => new Response(null, { status: 204 }));

    await client.smtpCredentials.revoke("smtpc_0123456789abcdefghjkmnpq");

    expect(captured.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
      "DELETE /v1/smtp-credentials/smtpc_0123456789abcdefghjkmnpq",
    ]);
  });
});
