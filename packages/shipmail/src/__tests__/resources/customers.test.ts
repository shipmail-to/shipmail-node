import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { Customer } from "../../types/customer.js";

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

const mockCustomer: Customer = {
  object: "customer",
  id: "cust_123",
  name: "Jane Doe",
  company: "Acme",
  notes: null,
  service_level_id: "svl_123",
  fields: { plan: "enterprise" },
  tags: ["vip"],
  identifiers: [{ kind: "email", value: "jane@acme.com" }],
  external_ids: [{ source: "hubspot", external_id: "42", url: null }],
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

describe("Customers", () => {
  test("list sends the filters", async () => {
    const client = createClient((input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("GET");
      expect(url.pathname).toBe("/v1/customers");
      expect(url.searchParams.get("domain")).toBe("acme.com");
      expect(url.searchParams.get("external_source")).toBe("hubspot");
      expect(url.searchParams.get("external_id")).toBe("42");
      expect(url.searchParams.get("tag")).toBe("vip");
      expect(url.searchParams.has("email")).toBe(false);
      return Response.json({
        data: [mockCustomer],
        pagination: { next_cursor: null, has_more: false, limit: 20 },
      });
    });
    const page = await client.customers.list({
      domain: "acme.com",
      external_source: "hubspot",
      external_id: "42",
      tag: "vip",
    });
    expect(page.data[0]?.id).toBe("cust_123");
    expect(page.data[0]?.tags).toEqual(["vip"]);
  });

  test("create, get, update and remove use the customer path", async () => {
    const calls: string[] = [];
    const client = createClient((input, init) => {
      calls.push(`${init?.method} ${new URL(String(input)).pathname}`);
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json(mockCustomer, { status: init?.method === "POST" ? 201 : 200 });
    });
    await client.customers.create({ name: "Jane Doe" });
    await client.customers.get("cust_123");
    await client.customers.update("cust_123", { notes: "VIP" });
    await client.customers.remove("cust_123");
    expect(calls).toEqual([
      "POST /v1/customers",
      "GET /v1/customers/cust_123",
      "PATCH /v1/customers/cust_123",
      "DELETE /v1/customers/cust_123",
    ]);
  });

  test("upsertByExternalId encodes the external id once", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("PUT");
      expect(new URL(String(input)).pathname).toBe("/v1/customers/external/hubspot/contact%2F42");
      expect(JSON.parse(String(init?.body))).toEqual({
        name: "Jane Doe",
        identifiers: [{ kind: "email", value: "jane@acme.com" }],
        tags: ["vip", "beta"],
      });
      return Response.json(mockCustomer);
    });
    const customer = await client.customers.upsertByExternalId("hubspot", "contact/42", {
      name: "Jane Doe",
      identifiers: [{ kind: "email", value: "jane@acme.com" }],
      tags: ["vip", "beta"],
    });
    expect(customer.id).toBe("cust_123");
  });

  test("lists service levels and fields", async () => {
    const paths: string[] = [];
    const client = createClient((input) => {
      paths.push(new URL(String(input)).pathname);
      return Response.json({ data: [] });
    });
    await client.customers.listServiceLevels();
    await client.customers.listFields();
    expect(paths).toEqual(["/v1/service-levels", "/v1/customer-fields"]);
  });
});
