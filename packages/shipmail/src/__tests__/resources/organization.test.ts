import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type {
  OrganizationAccess,
  OrganizationAiSettings,
  OrganizationSettings,
} from "../../types/organization.js";

function clientFor(
  method: string,
  pathname: string,
  response: unknown,
  expectedBody?: unknown,
): ShipmailClient {
  return new ShipmailClient({
    apiKey: "sm_live_test",
    baseUrl: "https://api.test.com/v1",
    maxRetries: 0,
    fetch: (async (input, init) => {
      expect(init?.method).toBe(method);
      expect(new URL(String(input)).pathname).toBe(pathname);
      if (expectedBody !== undefined) expect(JSON.parse(String(init?.body))).toEqual(expectedBody);
      return Response.json(response);
    }) as typeof fetch,
  });
}

const organization: OrganizationSettings = {
  object: "organization",
  id: "org_1",
  name: "Acme",
  default_timezone: "Europe/Paris",
};

const aiSettings: OrganizationAiSettings = {
  object: "organization_ai_settings",
  models_enabled: true,
  automatic_send_enabled: true,
  effective: { models_enabled: true, automatic_send_enabled: false },
};

describe("Organization", () => {
  test("sends GET /organization/access", async () => {
    const response: OrganizationAccess = {
      object: "organization_access",
      organization: { id: "org_1", name: "Acme", default_timezone: "Europe/Lisbon" },
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

  test("sends GET /organization", async () => {
    const client = clientFor("GET", "/v1/organization", organization);
    expect(await client.organization.get()).toEqual(organization);
  });

  test("sends PATCH /organization with a null zone to clear it", async () => {
    const cleared = { ...organization, default_timezone: null };
    const client = clientFor("PATCH", "/v1/organization", cleared, { default_timezone: null });
    expect(await client.organization.update({ default_timezone: null })).toEqual(cleared);
  });

  test("sends GET /organization/ai-settings", async () => {
    const client = clientFor("GET", "/v1/organization/ai-settings", aiSettings);
    expect(await client.organization.getAiSettings()).toEqual(aiSettings);
  });

  test("sends PATCH /organization/ai-settings", async () => {
    const client = clientFor("PATCH", "/v1/organization/ai-settings", aiSettings, {
      models_enabled: true,
    });
    expect(await client.organization.updateAiSettings({ models_enabled: true })).toEqual(
      aiSettings,
    );
  });
});
