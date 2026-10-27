import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { PaginatedResponse } from "../../types/common.js";
import type { RenderedTemplate, Template, TemplateVersion } from "../../types/template.js";

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

const mockTemplate: Template = {
  object: "template",
  id: "tpl_123",
  name: "Welcome",
  subject: "Welcome, {{name}}",
  html: "<p>Hi {{name}}, your plan is {{plan}}.</p>",
  text: null,
  fallbacks: { plan: "Free" },
  variables: [
    { key: "name", required: true, fallback: null },
    { key: "plan", required: false, fallback: "Free" },
  ],
  published_version: 1,
  has_unpublished_changes: false,
  created_at: "2026-10-27T00:00:00Z",
  updated_at: "2026-10-27T00:00:00Z",
};

const mockVersion: TemplateVersion = {
  object: "template_version",
  template_id: "tpl_123",
  version: 1,
  subject: mockTemplate.subject,
  html: mockTemplate.html,
  text: null,
  fallbacks: mockTemplate.fallbacks,
  variables: mockTemplate.variables,
  published_at: "2026-10-27T00:00:00Z",
};

describe("Templates", () => {
  test("create sends POST /templates with the body", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/templates");
      expect(JSON.parse(String(init?.body))).toEqual({
        name: "Welcome",
        subject: "Welcome, {{name}}",
        html: "<p>Hi {{name}}</p>",
        fallbacks: { plan: "Free" },
        publish: true,
      });
      return Response.json(mockTemplate, { status: 201 });
    });

    const template = await client.templates.create({
      name: "Welcome",
      subject: "Welcome, {{name}}",
      html: "<p>Hi {{name}}</p>",
      fallbacks: { plan: "Free" },
      publish: true,
    });
    expect(template.id).toBe("tpl_123");
    expect(template.variables[0]?.required).toBe(true);
  });

  test("list sends GET /templates with pagination params", async () => {
    const response: PaginatedResponse<Template> = {
      data: [mockTemplate],
      pagination: { next_cursor: null, has_more: false, limit: 10 },
    };
    const client = createClient((input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("GET");
      expect(url.pathname).toBe("/v1/templates");
      expect(url.searchParams.get("limit")).toBe("10");
      expect(url.searchParams.get("cursor")).toBe("cur_1");
      return Response.json(response);
    });

    const result = await client.templates.list({ limit: 10, cursor: "cur_1" });
    expect(result.data).toHaveLength(1);
  });

  test("listAutoPaginating follows next_cursor", async () => {
    const seen: (string | null)[] = [];
    const client = createClient((input) => {
      const cursor = new URL(String(input)).searchParams.get("cursor");
      seen.push(cursor);
      return Response.json({
        data: [{ ...mockTemplate, id: cursor ? "tpl_2" : "tpl_1" }],
        pagination: { next_cursor: cursor ? null : "cur_2", has_more: !cursor, limit: 1 },
      });
    });

    const ids: string[] = [];
    for await (const template of client.templates.listAutoPaginating({ limit: 1 })) {
      ids.push(template.id);
    }
    expect(ids).toEqual(["tpl_1", "tpl_2"]);
    expect(seen).toEqual([null, "cur_2"]);
  });

  test("get, update and delete use the encoded template path", async () => {
    const calls: string[] = [];
    const bodies: unknown[] = [];
    const client = createClient((input, init) => {
      calls.push(`${init?.method ?? "GET"} ${new URL(String(input)).pathname}`);
      if (init?.body) bodies.push(JSON.parse(String(init.body)));
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json(mockTemplate);
    });

    await client.templates.get("tpl/1");
    await client.templates.update("tpl/1", { subject: "Hi", text: null });
    const deleted = await client.templates.delete("tpl/1");

    expect(deleted).toBeUndefined();
    expect(bodies).toEqual([{ subject: "Hi", text: null }]);
    expect(calls).toEqual([
      "GET /v1/templates/tpl%2F1",
      "PATCH /v1/templates/tpl%2F1",
      "DELETE /v1/templates/tpl%2F1",
    ]);
  });

  test("publish sends POST /templates/:id/publish", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/templates/tpl_123/publish");
      return Response.json({ ...mockTemplate, published_version: 2 });
    });

    const template = await client.templates.publish("tpl_123");
    expect(template.published_version).toBe(2);
  });

  test("render sends variables and a version", async () => {
    const rendered: RenderedTemplate = {
      object: "rendered_template",
      template_id: "tpl_123",
      version: 1,
      subject: "Welcome, Ada",
      html: "<p>Hi Ada, your plan is Free.</p>",
      text: null,
    };
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/templates/tpl_123/render");
      expect(JSON.parse(String(init?.body))).toEqual({
        variables: { name: "Ada", vip: true },
        version: 1,
      });
      return Response.json(rendered);
    });

    const result = await client.templates.render("tpl_123", {
      variables: { name: "Ada", vip: true },
      version: 1,
    });
    expect(result.subject).toBe("Welcome, Ada");
  });

  test("render without params renders the draft with an empty body", async () => {
    const client = createClient((_input, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({});
      return Response.json({ object: "rendered_template", version: null });
    });

    const result = await client.templates.render("tpl_123");
    expect(result.version).toBeNull();
  });

  test("listVersions, getVersion and restoreVersion use the version paths", async () => {
    const calls: string[] = [];
    const client = createClient((input, init) => {
      const url = new URL(String(input));
      calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
      if (url.pathname.endsWith("/versions")) {
        return Response.json({
          data: [mockVersion],
          pagination: { next_cursor: null, has_more: false, limit: 5 },
        });
      }
      if (url.pathname.endsWith("/restore")) return Response.json(mockTemplate);
      return Response.json(mockVersion);
    });

    const versions = await client.templates.listVersions("tpl_123", { limit: 5 });
    const version = await client.templates.getVersion("tpl_123", 1);
    const restored = await client.templates.restoreVersion("tpl_123", 1);

    expect(versions.data[0]?.version).toBe(1);
    expect(version.object).toBe("template_version");
    expect(restored.object).toBe("template");
    expect(calls).toEqual([
      "GET /v1/templates/tpl_123/versions?limit=5",
      "GET /v1/templates/tpl_123/versions/1",
      "POST /v1/templates/tpl_123/versions/1/restore",
    ]);
  });
});
