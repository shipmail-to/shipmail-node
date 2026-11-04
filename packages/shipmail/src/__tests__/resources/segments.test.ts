import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { Segment } from "../../types/segment.js";

type Recorded = { readonly path: string; readonly method: string; readonly body: unknown };

const segment: Segment = {
  object: "segment",
  id: "nwsseg_1",
  audience_id: "aud_123",
  name: "Founders",
  definition: {
    match: "all",
    rules: [{ kind: "merge_field", field: "role", operator: "equals", value: "founder" }],
  },
  matching_count: 4,
  created_at: "2026-11-03T00:00:00Z",
  updated_at: "2026-11-03T00:00:00Z",
};

function recordingClient(requests: Recorded[]): ShipmailClient {
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const method = init?.method ?? "GET";
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ path: url.pathname, method, body });
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/segments") && method === "GET") {
      return Response.json({ data: [segment] });
    }
    return Response.json(segment, { status: method === "POST" ? 201 : 200 });
  };
  return new ShipmailClient({
    apiKey: "sm_live_test",
    baseUrl: "https://api.test.com/v1",
    fetch: fetch as typeof globalThis.fetch,
    maxRetries: 0,
  });
}

describe("audiences.segments", () => {
  test("lists, creates, reads, updates and deletes segments", async () => {
    const requests: Recorded[] = [];
    const client = recordingClient(requests);

    const listed = await client.audiences.segments.list("aud_123");
    expect(listed.data[0]?.matching_count).toBe(4);
    const created = await client.audiences.segments.create("aud_123", {
      name: "Founders",
      definition: segment.definition,
    });
    expect(created.id).toBe("nwsseg_1");
    await client.audiences.segments.get("aud_123", "nwsseg_1");
    await client.audiences.segments.update("aud_123", "nwsseg_1", { name: "All founders" });
    await client.audiences.segments.delete("aud_123", "nwsseg_1");

    expect(requests).toEqual([
      { path: "/v1/audiences/aud_123/segments", method: "GET", body: null },
      {
        path: "/v1/audiences/aud_123/segments",
        method: "POST",
        body: { name: "Founders", definition: segment.definition },
      },
      { path: "/v1/audiences/aud_123/segments/nwsseg_1", method: "GET", body: null },
      {
        path: "/v1/audiences/aud_123/segments/nwsseg_1",
        method: "PATCH",
        body: { name: "All founders" },
      },
      { path: "/v1/audiences/aud_123/segments/nwsseg_1", method: "DELETE", body: null },
    ]);
  });
});
