import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { PaginatedResponse } from "../../types/common.js";
import type {
  Domain,
  DomainDnsRecordSet,
  DomainHealth,
  DomainVerificationResult,
} from "../../types/domain.js";

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

const mockDomain: Domain = {
  object: "domain",
  id: "dom_123",
  name: "example.com",
  status: "verified",
  managed_by: "external",
  dns_provider: null,
  mx_verified: true,
  spf_verified: true,
  dkim_verified: true,
  dmarc_verified: true,
  dmarc_managed_externally: false,
  outbound_verified: true,
  catch_all_mailbox_id: null,
  verified_at: "2025-01-01T00:00:00Z",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("Domains", () => {
  describe("create", () => {
    test("sends POST /domains with body", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/domains");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ name: "example.com" });
        return Response.json(mockDomain);
      });

      const domain = await client.domains.create({ name: "example.com" });
      expect(domain.id).toBe("dom_123");
      expect(domain.name).toBe("example.com");
    });
  });

  describe("list", () => {
    test("sends GET /domains", async () => {
      const response: PaginatedResponse<Domain> = {
        data: [mockDomain],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/domains");
        return Response.json(response);
      });

      const result = await client.domains.list();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("dom_123");
      expect(result.pagination.has_more).toBe(false);
    });

    test("sends cursor and limit query params", async () => {
      const response: PaginatedResponse<Domain> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("cursor")).toBe("cur_abc");
        expect(url.searchParams.get("limit")).toBe("25");
        return Response.json(response);
      });

      await client.domains.list({ cursor: "cur_abc", limit: 25 });
    });

    test("omits undefined params", async () => {
      const response: PaginatedResponse<Domain> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.has("cursor")).toBe(false);
        expect(url.searchParams.has("limit")).toBe(false);
        return Response.json(response);
      });

      await client.domains.list();
    });
  });

  describe("get", () => {
    test("sends GET /domains/:id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/domains/dom_123");
        return Response.json(mockDomain);
      });

      const domain = await client.domains.get("dom_123");
      expect(domain.id).toBe("dom_123");
      expect(domain.name).toBe("example.com");
    });
  });

  describe("getDnsRecords", () => {
    test("sends GET /domains/:id/dns-records", async () => {
      const dnsRecords: DomainDnsRecordSet = {
        object: "dns_record_set",
        domain_id: "dom_123",
        domain_name: "example.com",
        all_verified: false,
        checked_at: "2026-07-13T12:00:00.000Z",
        records: [
          {
            key: "mx",
            type: "MX",
            host: "@",
            value: "mx1.shipmail.to",
            priority: 10,
            ttl: 300,
            status: "verified",
            found_values: ["mx1.shipmail.to"],
          },
        ],
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/domains/dom_123/dns-records");
        return Response.json(dnsRecords);
      });

      const result = await client.domains.getDnsRecords("dom_123");
      expect(result.object).toBe("dns_record_set");
      expect(result.records[0]?.status).toBe("verified");
    });
  });

  describe("getHealth", () => {
    test("sends GET /domains/:id/health", async () => {
      const health: DomainHealth = {
        object: "domain_health",
        domain_id: "dom_123",
        domain: "example.com",
        generated_at: "2026-10-18T12:00:00.000Z",
        dns: { mx: true, spf: true, dkim: true, dmarc: false, last_checked_at: null },
        blocklist: { list: "spamhaus_dbl", listed: false, listed_since: null },
        delivery: {
          since: "2026-09-18T12:00:00.000Z",
          until: "2026-10-18T12:00:00.000Z",
          recipients: 2,
          delivered: 2,
          bounced: 0,
          deferred: 0,
          complained: 0,
          failed: 0,
          suppressed: 0,
          queued: 0,
          sent: 0,
          delivery_rate: 100,
          providers: [
            {
              provider: "google",
              recipients: 2,
              delivered: 2,
              bounced: 0,
              deferred: 0,
              complained: 0,
              delivery_rate: 100,
            },
          ],
        },
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/domains/dom_123/health");
        return Response.json(health);
      });

      const result = await client.domains.getHealth("dom_123");
      expect(result.object).toBe("domain_health");
      expect(result.delivery.providers[0]?.provider).toBe("google");
    });
  });

  describe("update", () => {
    test("sends PATCH /domains/:id with body", async () => {
      const updated = { ...mockDomain, catch_all_mailbox_id: "mbx_456" };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("PATCH");
        expect(new URL(String(input)).pathname).toBe("/v1/domains/dom_123");
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ catch_all_mailbox_id: "mbx_456" });
        return Response.json(updated);
      });

      const domain = await client.domains.update("dom_123", {
        catch_all_mailbox_id: "mbx_456",
      });
      expect(domain.catch_all_mailbox_id).toBe("mbx_456");
    });

    test("sends null to clear catch_all_mailbox_id", async () => {
      const updated = { ...mockDomain, catch_all_mailbox_id: null };
      const client = createClient((input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ catch_all_mailbox_id: null });
        return Response.json(updated);
      });

      const domain = await client.domains.update("dom_123", {
        catch_all_mailbox_id: null,
      });
      expect(domain.catch_all_mailbox_id).toBeNull();
    });
  });

  describe("delete", () => {
    test("sends DELETE /domains/:id", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("DELETE");
        expect(new URL(String(input)).pathname).toBe("/v1/domains/dom_123");
        return new Response(null, { status: 204 });
      });

      const result = await client.domains.delete("dom_123");
      expect(result).toBeUndefined();
    });
  });

  describe("verify", () => {
    test("sends POST /domains/:id/verification", async () => {
      const verificationResult: DomainVerificationResult = {
        all_verified: true,
        records: {
          mx: true,
          spf: true,
          dkim: true,
          dmarc: true,
        },
        outbound_verified: true,
        outbound_error: false,
        existing_spf: "v=spf1 include:_spf.google.com ~all",
        suggested_spf: "v=spf1 include:_spf.google.com include:amazonses.com ~all",
        conflicting_mx: [],
        dmarc_valid: true,
        dmarc_exact_match: true,
        dmarc_record_value: "v=DMARC1; p=none; rua=mailto:dmarc@example.com",
        dmarc_managed_externally: false,
      };

      const client = createClient((input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/domains/dom_123/verification");
        return Response.json(verificationResult);
      });

      const result = await client.domains.verify("dom_123");
      expect(result.all_verified).toBe(true);
      expect(result.records.mx).toBe(true);
      expect(result.records.spf).toBe(true);
      expect(result.records.dkim).toBe(true);
      expect(result.records.dmarc).toBe(true);
      expect(result.outbound_verified).toBe(true);
      expect(result.outbound_error).toBe(false);
      expect(result.conflicting_mx).toEqual([]);
    });
  });
});
