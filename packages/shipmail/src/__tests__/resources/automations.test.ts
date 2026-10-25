import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { Automation, AutomationDefinition } from "../../types/automation.js";

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

const definition: AutomationDefinition = {
  trigger: { type: "scheduled", cron: "0 8 * * *", time_zone: "Europe/Lisbon" },
  conditions: [],
  actions: [{ type: "generate_mail_report", metric: "received", lookback_minutes: 1_440 }],
  mode: "draft",
  scope: { mailbox_ids: ["mbx_1"], calendar_addresses: [] },
};
const automation: Automation = {
  object: "automation",
  id: "aaut_abcdefghijklmnopqrstuvwx",
  name: "Daily brief",
  status: "active",
  version_id: "aav_1",
  version: 1,
  definition,
  last_run: null,
  next_run_at: "2026-08-03T08:00:00.000Z",
  created_at: "2026-08-02T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
};

describe("Automations", () => {
  test("lists automations", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe("/v1/automations");
      return Response.json({ data: [automation] });
    });
    expect((await client.automations.list()).data[0]?.id).toBe(automation.id);
  });

  test("creates an active automation from an explicit definition", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/automations");
      expect(JSON.parse(String(init?.body))).toEqual({ name: "Daily brief", definition });
      return Response.json(automation, { status: 201 });
    });
    expect((await client.automations.create({ name: "Daily brief", definition })).status).toBe(
      "active",
    );
  });

  test("gets, updates, and manually runs an automation", async () => {
    const requests: string[] = [];
    const client = createClient((input, init) => {
      requests.push(`${init?.method} ${new URL(String(input)).pathname}`);
      if (new URL(String(input)).pathname.endsWith("/run")) {
        return Response.json(
          { object: "automation_run", id: "aar_1", automation_id: automation.id, status: "queued" },
          { status: 202 },
        );
      }
      return Response.json(automation);
    });
    await client.automations.get(automation.id);
    await client.automations.update(automation.id, { status: "paused" });
    expect((await client.automations.run(automation.id)).status).toBe("queued");
    expect(requests).toEqual([
      `GET /v1/automations/${automation.id}`,
      `PATCH /v1/automations/${automation.id}`,
      `POST /v1/automations/${automation.id}/run`,
    ]);
  });
});
