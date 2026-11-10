import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import { ConflictError } from "../../errors.js";
import type { PaginatedResponse } from "../../types/common.js";
import type { Suppression, SuppressionEntry } from "../../types/suppression.js";

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
  source: "suppression",
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

    test("returns newsletter opt-outs and sends the reason filter", async () => {
      const response: PaginatedResponse<SuppressionEntry> = {
        data: [
          {
            object: "suppression",
            source: "newsletter_optout",
            email_address: "reader@example.com",
            reason: "unsubscribe",
            scope: "marketing",
            expires_at: null,
            created_at: "2025-01-02T00:00:00Z",
            newsletter_id: "nws_123",
            test_send: false,
          },
        ],
        pagination: { next_cursor: null, has_more: false, limit: 50 },
      };
      const client = createClient((input) => {
        expect(new URL(String(input)).searchParams.get("reason")).toBe("unsubscribe");
        return Response.json(response);
      });

      const result = await client.suppressions.list({ reason: "unsubscribe" });
      const entry = result.data[0];
      expect(entry?.source).toBe("newsletter_optout");
      if (entry?.source === "newsletter_optout") {
        expect(entry.newsletter_id).toBe("nws_123");
        expect(entry.test_send).toBe(false);
      }
    });

    test("listAutoPaginating passes the reason filter", async () => {
      const client = createClient((input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("reason")).toBe("hard_bounce");
        return Response.json({
          data: [mockSuppression],
          pagination: { next_cursor: null, has_more: false, limit: 25 },
        });
      });

      const items: SuppressionEntry[] = [];
      for await (const item of client.suppressions.listAutoPaginating({ reason: "hard_bounce" })) {
        items.push(item);
      }
      expect(items).toHaveLength(1);
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
        expect(url.searchParams.has("reason")).toBe(false);
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

    test("returns the removal when a newsletter opt-out remains", async () => {
      const client = createClient(() =>
        Response.json({
          object: "suppression_removal",
          email_address: "reader@example.com",
          removed: true,
          newsletter_optout_remains: true,
          message: "The suppression was removed. The newsletter opt-out remains.",
        }),
      );

      const result = await client.suppressions.remove("reader@example.com");
      expect(result?.object).toBe("suppression_removal");
      expect(result?.newsletter_optout_remains).toBe(true);
    });

    test("throws ConflictError with the consent_opt_out detail for an opt-out only", async () => {
      const client = createClient(() =>
        Response.json(
          {
            error: {
              type: "conflict",
              message: "This address unsubscribed from your newsletters.",
              details: [
                {
                  field: "email",
                  code: "consent_opt_out",
                  message: "Resubscribe the subscriber instead.",
                },
              ],
            },
          },
          { status: 409 },
        ),
      );

      const error = await client.suppressions.remove("reader@example.com").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      if (error instanceof ConflictError) {
        expect(error.details?.[0]?.code).toBe("consent_opt_out");
      }
    });
  });

  describe("resubscribe", () => {
    test("sends POST /newsletter-opt-outs/:encoded_email/resubscribe with the consent", async () => {
      const client = createClient(async (input, init) => {
        expect(init?.method).toBe("POST");
        expect(new URL(String(input)).pathname).toBe(
          "/v1/newsletter-opt-outs/reader%2Bnews%40example.com/resubscribe",
        );
        expect(JSON.parse(String(init?.body))).toEqual({
          consent_source: "Asked to rejoin by email",
        });
        return Response.json({
          object: "newsletter_opt_out_lift",
          email_address: "reader+news@example.com",
          consent_source: "Asked to rejoin by email",
          consent_attested_at: "2026-11-09T10:00:00.000Z",
          opted_out_at: "2026-10-01T08:00:00.000Z",
          newsletter_id: null,
        });
      });

      const lift = await client.suppressions.resubscribe("reader+news@example.com", {
        consent_source: "Asked to rejoin by email",
      });
      expect(lift.object).toBe("newsletter_opt_out_lift");
      expect(lift.opted_out_at).toBe("2026-10-01T08:00:00.000Z");
    });

    test("throws ConflictError while a suppression blocks the address", async () => {
      const client = createClient(() =>
        Response.json(
          { error: { type: "conflict", message: "Remove the suppression first." } },
          { status: 409 },
        ),
      );
      const error = await client.suppressions
        .resubscribe("bounced@example.com", { consent_source: "Asked to rejoin" })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
    });
  });
});
