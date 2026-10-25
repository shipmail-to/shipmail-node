import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { OrganizationAccess } from "../../types/organization.js";

describe("Organization", () => {
  test("sends GET /organization/access", async () => {
    const response: OrganizationAccess = {
      object: "organization_access",
      organization: { id: "org_1", name: "Acme" },
      plan: "team",
      has_access: true,
      trial: { active: true, ends_at: "2026-10-19T00:00:00.000Z", eligible: false },
      mailboxes: { limit: 3, used: 1 },
      newsletters_allowed: false,
    };
    const client = new ShipmailClient({
      apiKey: "sm_live_test",
      baseUrl: "https://api.test.com/v1",
      maxRetries: 0,
      fetch: (async (input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/organization/access");
        return Response.json(response);
      }) as typeof fetch,
    });

    expect(await client.organization.access()).toEqual(response);
  });
});
