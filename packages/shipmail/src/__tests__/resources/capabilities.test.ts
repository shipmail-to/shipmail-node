import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { CapabilitiesResponse } from "../../types/capabilities.js";

describe("Capabilities", () => {
  test("sends GET /capabilities with authentication", async () => {
    const response: CapabilitiesResponse = {
      capability_version: "1.1.0",
      scopes: ["messages:read", "messages:send"],
      constraints: {
        mailbox_ids: ["mbx_123"],
        domain_ids: null,
        audience_ids: null,
        resource_semantics: "legacy-intersection",
      },
      allowed_mcp_tools: ["shipmail_list_messages", "shipmail_send_message"],
    };
    const client = new ShipmailClient({
      apiKey: "sm_live_test",
      baseUrl: "https://api.test.com/v1",
      maxRetries: 0,
      fetch: (async (input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/capabilities");
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer sm_live_test");
        return Response.json(response);
      }) as typeof fetch,
    });

    expect(await client.capabilities.get()).toEqual(response);
  });
});
