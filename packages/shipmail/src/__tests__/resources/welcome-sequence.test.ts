import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { WelcomeSequence, WelcomeStep } from "../../types/welcome-sequence.js";

type Recorded = { readonly path: string; readonly method: string; readonly body: unknown };

const step: WelcomeStep = {
  object: "welcome_step",
  id: "nwswstp_1",
  audience_id: "aud_123",
  position: 1,
  wait_minutes: 0,
  sender_identity_id: "nwsid_1",
  subject: "Welcome",
  preview_text: null,
  blocks: [{ type: "paragraph", body: "Hi" }],
  track_engagement: false,
  add_utm_tags: false,
  styling_mode: "styled",
  sent_count: 0,
  delivered_count: 0,
  bounced_count: 0,
  complained_count: 0,
  created_at: "2026-10-15T00:00:00Z",
  updated_at: "2026-10-15T00:00:00Z",
};

const sequence: WelcomeSequence = {
  object: "welcome_sequence",
  audience_id: "aud_123",
  enabled: true,
  paused: false,
  pause_reason: null,
  active_readers: 0,
  completed_readers: 0,
  steps: [step],
};

function recordingClient(requests: Recorded[]): ShipmailClient {
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ path: url.pathname, method: init?.method ?? "GET", body });
    const payload = url.pathname.endsWith("/welcome-sequence")
      ? sequence
      : init?.method === "DELETE"
        ? { object: "welcome_step", id: "nwswstp_1", deleted: true }
        : step;
    return Response.json(payload, { status: init?.method === "POST" ? 201 : 200 });
  };
  return new ShipmailClient({
    apiKey: "sm_live_test",
    baseUrl: "https://api.test.com/v1",
    fetch: fetch as typeof globalThis.fetch,
    maxRetries: 0,
  });
}

describe("audiences.welcomeSequence", () => {
  test("reads, toggles and edits a welcome sequence", async () => {
    const requests: Recorded[] = [];
    const client = recordingClient(requests);

    expect((await client.audiences.welcomeSequence.get("aud_123")).steps).toHaveLength(1);
    await client.audiences.welcomeSequence.update("aud_123", { enabled: true });
    await client.audiences.welcomeSequence.createStep("aud_123", {
      subject: "Welcome",
      content_markdown: "# Hi",
      wait_minutes: 60,
    });
    await client.audiences.welcomeSequence.updateStep("aud_123", "nwswstp_1", { wait_minutes: 0 });
    const deleted = await client.audiences.welcomeSequence.deleteStep("aud_123", "nwswstp_1");

    expect(deleted.deleted).toBe(true);
    expect(requests).toEqual([
      { path: "/v1/audiences/aud_123/welcome-sequence", method: "GET", body: null },
      {
        path: "/v1/audiences/aud_123/welcome-sequence",
        method: "PATCH",
        body: { enabled: true },
      },
      {
        path: "/v1/audiences/aud_123/welcome-sequence/steps",
        method: "POST",
        body: { subject: "Welcome", content_markdown: "# Hi", wait_minutes: 60 },
      },
      {
        path: "/v1/audiences/aud_123/welcome-sequence/steps/nwswstp_1",
        method: "PATCH",
        body: { wait_minutes: 0 },
      },
      {
        path: "/v1/audiences/aud_123/welcome-sequence/steps/nwswstp_1",
        method: "DELETE",
        body: null,
      },
    ]);
  });
});
