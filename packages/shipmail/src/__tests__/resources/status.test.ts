import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { StatusResponse } from "../../types/common.js";

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

describe("Status", () => {
  describe("get", () => {
    test("sends GET /status", async () => {
      const response: StatusResponse = {
        status: "operational",
        version: "1.0.0",
        time: "2025-01-01T00:00:00Z",
        request_id: "req_abc123",
      };
      const client = createClient((input, init) => {
        expect(init?.method).toBe("GET");
        expect(new URL(String(input)).pathname).toBe("/v1/status");
        return Response.json(response);
      });

      const result = await client.status.get();
      expect(result.status).toBe("operational");
      expect(result.version).toBe("1.0.0");
      expect(result.time).toBe("2025-01-01T00:00:00Z");
      expect(result.request_id).toBe("req_abc123");
    });

    test("does not send request body", async () => {
      const response: StatusResponse = {
        status: "operational",
        version: "1.0.0",
        time: "2025-01-01T00:00:00Z",
        request_id: "req_xyz",
      };
      const client = createClient((input, init) => {
        expect(init?.body).toBeNull();
        return Response.json(response);
      });

      await client.status.get();
    });

    test("includes authorization header", async () => {
      const response: StatusResponse = {
        status: "operational",
        version: "1.0.0",
        time: "2025-01-01T00:00:00Z",
        request_id: "req_xyz",
      };
      const client = createClient((input, init) => {
        const headers = new Headers(init?.headers as HeadersInit);
        expect(headers.get("Authorization")).toBe("Bearer sm_live_test");
        return Response.json(response);
      });

      await client.status.get();
    });
  });
});
