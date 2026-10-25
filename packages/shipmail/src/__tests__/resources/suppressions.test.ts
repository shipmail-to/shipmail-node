import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { PaginatedResponse } from "../../types/common.js";
import type { Suppression } from "../../types/suppression.js";

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

const mockSuppression: Suppression = {
  object: "suppression",
  email_address: "bounced@example.com",
  reason: "hard_bounce",
  scope: "all",
  expires_at: null,
  created_at: "2025-01-01T00:00:00Z",
};

describe("Suppressions", () => {
  describe("create", () => {
    test("sends POST /suppressions with the body", async () => {
      const client = createClient(async (input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe("/v1/suppressions");
        expect(JSON.parse(String(init?.body))).toEqual({
          email: "person@example.com",
          scope: "marketing",
        });
        return Response.json(
          { ...mockSuppression, email_address: "person@example.com", reason: "manual" },
          { status: 201 },
        );
      });

      const result = await client.suppressions.create({
        email: "person@example.com",
        scope: "marketing",
      });
      expect(result.reason).toBe("manual");
      expect(result.email_address).toBe("person@example.com");
    });
  });

  describe("list", () => {
    test("sends GET /suppressions", async () => {
      const response: PaginatedResponse<Suppression> = {
        data: [mockSuppression],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/suppressions");
        return Response.json(response);
      });

      const result = await client.suppressions.list();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.email_address).toBe("bounced@example.com");
      expect(result.pagination.has_more).toBe(false);
    });

    test("sends limit query param", async () => {
      const response: PaginatedResponse<Suppression> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("limit")).toBe("10");
        return Response.json(response);
      });

      await client.suppressions.list({ limit: 10 });
    });

    test("sends scope query param", async () => {
      const response: PaginatedResponse<Suppression> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        expect(new URL(String(input)).searchParams.get("scope")).toBe("marketing");
        return Response.json(response);
      });

      await client.suppressions.list({ scope: "marketing" });
    });

    test("omits undefined params", async () => {
      const response: PaginatedResponse<Suppression> = {
        data: [],
        pagination: { next_cursor: null, has_more: false },
      };
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.has("cursor")).toBe(false);
        expect(url.searchParams.has("limit")).toBe(false);
        expect(url.searchParams.has("scope")).toBe(false);
        return Response.json(response);
      });

      await client.suppressions.list();
    });
  });

  describe("remove", () => {
    test("sends DELETE /suppressions/:encoded_email", async () => {
      const client = createClient((input, init) => {
        expect(init?.method).toBe("DELETE");
        expect(new URL(String(input)).pathname).toBe(
          `/v1/suppressions/${encodeURIComponent("bounced@example.com")}`,
        );
        return new Response(null, { status: 204 });
      });

      const result = await client.suppressions.remove("bounced@example.com");
      expect(result).toBeUndefined();
    });
  });
});
