import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, test } from "bun:test";

import { isMainModule, runCli } from "./cli.js";
import { VERSION } from "./version.js";

type CapturedRequest = {
  readonly url: URL;
  readonly init: RequestInit | undefined;
};

function createOutput() {
  let text = "";
  return {
    out: {
      write(chunk: string) {
        text += chunk;
      },
    },
    text: () => text,
  };
}

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return Response.json(value, init);
}

function stubFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return handler as typeof fetch;
}

function headersFrom(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers);
}

async function readJsonBody(init: RequestInit | undefined): Promise<unknown> {
  if (typeof init?.body !== "string") {
    throw new Error("expected JSON string request body");
  }
  return JSON.parse(init.body);
}

describe("shipmail CLI", () => {
  const opaqueCalendarEventId = "evt:opaque.123";

  test("prints help without requiring an API key", async () => {
    const stdout = createOutput();
    const stderr = createOutput();

    const code = await runCli(["--help"], { stdout: stdout.out, stderr: stderr.out, env: {} });

    expect(code).toBe(0);
    expect(stderr.text()).toBe("");
    expect(stdout.text()).toContain("shipmail status");
    expect(stdout.text()).toContain("shipmail capabilities");
    expect(stdout.text()).toContain("shipmail api <METHOD> <PATH>");
    expect(stdout.text()).toContain("shipmail automations create");
    expect(stdout.text()).toContain("shipmail calendar events list");
    expect(stdout.text()).toContain("shipmail booking-pages create");
    expect(stdout.text()).toContain("shipmail booking-links create");
    expect(stdout.text()).toContain("shipmail members list");
    expect(stdout.text()).toContain("shipmail members invite <email> --role admin|member");
    expect(stdout.text()).toContain("shipmail members mailboxes grant <member-id> <mailbox-id>");
    expect(stdout.text()).toContain("role is owner, admin, or member");
    expect(stdout.text()).toContain("selected IDs may be limited");
    expect(stdout.text()).toContain("shipmail inbox list <mailbox-id>");
    expect(stdout.text()).toContain("shipmail mailboxes import-resume <id> <import-id>");
    expect(stdout.text()).toContain(
      "shipmail mailboxes import-restore <id> <import-id> --file-id impf_...",
    );
    expect(stdout.text()).toContain("[--search text]");
    expect(stdout.text()).toContain("--conferencing-provider zoom|google_meet|none");
    expect(stdout.text()).toContain("--styling-mode <styled|plain>");
    expect(stdout.text()).toContain("--track-engagement <true|false>");
    expect(stdout.text()).toContain("--publish-target <email_and_website|email|website>");
    expect(stdout.text()).toContain("--add-utm-tags <true|false>");
    expect(stdout.text()).toContain("accept bare text or sanitized inline HTML");
  });

  test("resumes an uploaded mailbox import", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(["mailboxes", "import-resume", "mbx_1", "imp_1"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({ object: "mailbox_import", id: "imp_1", status: "queued" });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/api/v1/mailboxes/mbx_1/imports/imp_1/resume");
    expect(captured?.init?.method).toBe("POST");
    expect(JSON.parse(stdout.text())).toMatchObject({ id: "imp_1", status: "queued" });
  });

  test("restores a missing uploaded mailbox import source", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      ["mailboxes", "import-restore", "mbx_1", "imp_1", "--file-id", "impf_1"],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "mailbox_import", id: "imp_1", status: "queued" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/api/v1/mailboxes/mbx_1/imports/imp_1/restore");
    expect(captured?.init?.method).toBe("POST");
    expect(captured?.init?.body).toBe(JSON.stringify({ file_ids: ["impf_1"] }));
    expect(JSON.parse(stdout.text())).toMatchObject({ id: "imp_1", status: "queued" });
  });

  test("prints version from global flag", async () => {
    const stdout = createOutput();

    const code = await runCli(["--version"], { stdout: stdout.out, env: {} });

    expect(code).toBe(0);
    expect(stdout.text()).toBe(`${VERSION}\n`);
  });

  test("detects npm bin symlinks as the main module", () => {
    const dir = mkdtempSync(join(tmpdir(), "shipmail-cli-"));
    try {
      const target = join(dir, "cli.js");
      const link = join(dir, "shipmail");
      writeFileSync(target, "");
      symlinkSync(target, link);

      expect(isMainModule(pathToFileURL(target).href, link)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("checks status without authentication", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(["status"], {
      stdout: stdout.out,
      env: {},
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({
          status: "ok",
          version: "1.0.0",
          time: "2026-05-14T00:00:00Z",
          request_id: "req_123",
        });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/status");
    expect(captured?.init?.method).toBe("GET");
    expect(headersFrom(captured?.init).has("authorization")).toBe(false);
    expect(JSON.parse(stdout.text())).toEqual({
      status: "ok",
      version: "1.0.0",
      time: "2026-05-14T00:00:00Z",
      request_id: "req_123",
    });
  });

  test("prints authenticated capability discovery", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const code = await runCli(["capabilities"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({
          capability_version: "1.0.0",
          scopes: ["messages:send"],
          constraints: {},
          allowed_mcp_tools: ["shipmail_send_message"],
        });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/capabilities");
    expect(headersFrom(captured?.init).get("authorization")).toBe("Bearer sm_live_test");
    expect(stdout.text()).toContain("shipmail_send_message");
  });

  test("prints organization access", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const code = await runCli(["organization", "access"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({
          object: "organization_access",
          organization: { id: "org_1", name: "Acme" },
          plan: "free",
          has_access: false,
          trial: { active: false, ends_at: null, eligible: true },
          mailboxes: { limit: 0, used: 0 },
          newsletters_allowed: false,
        });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/organization/access");
    expect(stdout.text()).toContain('"has_access": false');
  });

  test("prints the owner's link on a refusal the owner can lift", async () => {
    const stderr = createOutput();
    const code = await runCli(
      ["mailboxes", "create", "--domain-id", "dom_1", "--address", "hi", "--generate-password"],
      {
        stdout: createOutput().out,
        stderr: stderr.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async () =>
          jsonResponse(
            {
              error: {
                type: "quota_exceeded",
                message: "Mailbox limit reached (3/3).",
                request_id: "req_q",
                reason: "trial_capacity",
                action_url: "https://shipmail.to/billing?org=org_1",
                limit: { resource: "mailboxes", used: 3, limit: 3, scope: "trial" },
              },
            },
            { status: 403 },
          ),
        ),
      },
    );

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Mailbox limit reached (3/3). (HTTP 403)");
    expect(stderr.text()).toContain(
      "Ask the organization owner to open (trial_capacity): https://shipmail.to/billing?org=org_1",
    );
    expect(stderr.text()).toContain("Limit: mailboxes 3 of 3 (trial)");
  });

  test("prints no owner line for an older server's error", async () => {
    const stderr = createOutput();
    await runCli(
      ["mailboxes", "create", "--domain-id", "dom_1", "--address", "hi", "--generate-password"],
      {
        stdout: createOutput().out,
        stderr: stderr.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async () =>
          jsonResponse(
            { error: { type: "quota_exceeded", message: "Mailbox limit reached." } },
            { status: 403 },
          ),
        ),
      },
    );
    expect(stderr.text()).not.toContain("organization owner");
  });

  test("lists public member roles with selected mailbox access", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const response = {
      data: [
        {
          object: "member",
          id: "mem_admin",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          mailbox_access: { scope: "selected", mailbox_ids: ["mbx_support"] },
          created_at: "2026-10-01T00:00:00.000Z",
        },
      ],
      pagination: { next_cursor: null, has_more: false },
    };

    const code = await runCli(["members", "list", "--limit", "25", "--cursor", "cur_1"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse(response);
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/api/v1/members");
    expect(captured?.url.searchParams.get("limit")).toBe("25");
    expect(captured?.url.searchParams.get("cursor")).toBe("cur_1");
    expect(stdout.text()).toBe(`${JSON.stringify(response, null, 2)}\n`);
  });

  test("adds a suppression with a scope", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const response = {
      object: "suppression",
      email_address: "reader@example.com",
      reason: "manual",
      scope: "marketing",
      expires_at: null,
      created_at: "2026-10-14T00:00:00.000Z",
    };

    const code = await runCli(
      ["suppressions", "add", "reader@example.com", "--scope", "marketing"],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse(response, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.init?.method).toBe("POST");
    expect(captured?.url.pathname).toBe("/api/v1/suppressions");
    expect(JSON.parse(String(captured?.init?.body))).toEqual({
      email: "reader@example.com",
      scope: "marketing",
    });
    expect(stdout.text()).toBe(`${JSON.stringify(response, null, 2)}\n`);
  });

  test("adds a suppression without a scope, leaving the default to the API", async () => {
    let body: unknown;
    const code = await runCli(["suppressions", "add", "reader@example.com"], {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (_input, init) => {
        body = JSON.parse(String(init?.body));
        return jsonResponse({}, { status: 201 });
      }),
    });

    expect(code).toBe(0);
    expect(body).toEqual({ email: "reader@example.com" });
  });

  test("lists suppressions filtered by scope", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const response = {
      data: [
        {
          object: "suppression",
          email_address: "reader@example.com",
          reason: "complaint",
          scope: "marketing",
          expires_at: null,
          created_at: "2026-10-01T00:00:00.000Z",
        },
      ],
      pagination: { next_cursor: null, has_more: false },
    };

    const code = await runCli(["suppressions", "list", "--scope", "marketing"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse(response);
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/api/v1/suppressions");
    expect(captured?.url.searchParams.get("scope")).toBe("marketing");
    expect(stdout.text()).toBe(`${JSON.stringify(response, null, 2)}\n`);
  });

  test("prints template commands in help", async () => {
    const stdout = createOutput();
    const code = await runCli(["--help"], { stdout: stdout.out, env: {} });

    expect(code).toBe(0);
    expect(stdout.text()).toContain("shipmail templates create --name");
    expect(stdout.text()).toContain("shipmail templates restore <template-id> <version>");
    expect(stdout.text()).toContain(
      "--template tpl_... [--template-version 2] [--var name=Ada ...]",
    );
  });

  test("creates a template with fallbacks, a body from a file, and publish", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shipmail-template-"));
    const htmlPath = join(dir, "welcome.html");
    writeFileSync(htmlPath, "<p>Hi {{name}}, plan {{plan}}</p>");
    let captured: CapturedRequest | undefined;
    try {
      const code = await runCli(
        [
          "templates",
          "create",
          "--name",
          "Welcome",
          "--subject",
          "Welcome, {{name}}",
          "--html",
          `@${htmlPath}`,
          "--fallback",
          "plan=Free, for now",
          "--fallback",
          "name=there",
          "--publish",
        ],
        {
          stdout: createOutput().out,
          env: { SHIPMAIL_API_KEY: "sm_live_test" },
          fetch: stubFetch(async (input, init) => {
            captured = { url: new URL(String(input)), init };
            return jsonResponse({ object: "template", id: "tpl_123" }, { status: 201 });
          }),
        },
      );

      expect(code).toBe(0);
      expect(captured?.init?.method).toBe("POST");
      expect(captured?.url.pathname).toBe("/api/v1/templates");
      expect(await readJsonBody(captured?.init)).toEqual({
        name: "Welcome",
        subject: "Welcome, {{name}}",
        html: "<p>Hi {{name}}, plan {{plan}}</p>",
        fallbacks: { plan: "Free, for now", name: "there" },
        publish: true,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("updates a template draft, clearing html and fallbacks", async () => {
    let captured: CapturedRequest | undefined;
    const code = await runCli(
      [
        "templates",
        "update",
        "tpl_123",
        "--subject",
        "Hello",
        "--text",
        "Hi",
        "--clear-html",
        "--clear-fallbacks",
      ],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "template", id: "tpl_123" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.init?.method).toBe("PATCH");
    expect(captured?.url.pathname).toBe("/api/v1/templates/tpl_123");
    expect(await readJsonBody(captured?.init)).toEqual({
      subject: "Hello",
      html: null,
      text: "Hi",
      fallbacks: {},
    });
  });

  test("routes the other template commands to their endpoints", async () => {
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return jsonResponse({ object: "template", id: "tpl_123" });
    });
    const commands: readonly (readonly string[])[] = [
      ["templates", "list", "--limit", "10"],
      ["templates", "get", "tpl_123"],
      ["templates", "publish", "tpl_123"],
      ["templates", "render", "tpl_123", "--var", "name=Ada", "--template-version", "2"],
      ["templates", "versions", "tpl_123", "--cursor", "cur_1"],
      ["templates", "version", "tpl_123", "2"],
      ["templates", "restore", "tpl_123", "1"],
      ["templates", "delete", "tpl_123"],
    ];

    for (const args of commands) {
      const code = await runCli(args, {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch,
      });
      expect(code).toBe(0);
    }

    expect(
      requests.map(({ url, init }) => `${init?.method ?? "GET"} ${url.pathname}${url.search}`),
    ).toEqual([
      "GET /api/v1/templates?limit=10",
      "GET /api/v1/templates/tpl_123",
      "POST /api/v1/templates/tpl_123/publish",
      "POST /api/v1/templates/tpl_123/render",
      "GET /api/v1/templates/tpl_123/versions?cursor=cur_1",
      "GET /api/v1/templates/tpl_123/versions/2",
      "POST /api/v1/templates/tpl_123/versions/1/restore",
      "DELETE /api/v1/templates/tpl_123",
    ]);
    expect(await readJsonBody(requests[3]?.init)).toEqual({
      variables: { name: "Ada" },
      version: 2,
    });
  });

  test("sends a message by template with string variables", async () => {
    let captured: CapturedRequest | undefined;
    const code = await runCli(
      [
        "messages",
        "send",
        "--from",
        "hello@example.com",
        "--to",
        "ada@example.com",
        "--template",
        "tpl_123",
        "--template-version",
        "3",
        "--var",
        "name=Ada",
        "--var",
        "count=3",
      ],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "message", id: "msg_123" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/api/v1/messages");
    expect(await readJsonBody(captured?.init)).toEqual({
      from: "hello@example.com",
      to: ["ada@example.com"],
      template: { id: "tpl_123", version: 3, variables: { name: "Ada", count: "3" } },
    });
  });

  test("prints validation detail codes from a refused template send", async () => {
    const stderr = createOutput();
    const code = await runCli(
      [
        "messages",
        "send",
        "--from",
        "a@example.com",
        "--to",
        "b@example.com",
        "--template",
        "tpl_1",
      ],
      {
        stderr: stderr.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async () =>
          jsonResponse(
            {
              error: {
                type: "validation_error",
                message: "Template variables are invalid.",
                details: [
                  {
                    field: "template.variables.name",
                    message: "Missing variable name.",
                    code: "missing_variable",
                  },
                ],
              },
            },
            { status: 422 },
          ),
        ),
      },
    );

    expect(code).toBe(1);
    expect(stderr.text()).toContain(
      "template.variables.name: Missing variable name. (missing_variable)",
    );
  });

  test("refuses invalid template flag combinations before any request", async () => {
    const send = ["messages", "send", "--from", "a@example.com", "--to", "b@example.com"];
    const cases: readonly { readonly args: readonly string[]; readonly message: string }[] = [
      {
        args: [...send, "--template", "tpl_1", "--subject", "Hi"],
        message: "--subject cannot be used with --template",
      },
      {
        args: [...send, "--template", "tpl_1", "--html", "<p>Hi</p>"],
        message: "--html cannot be used with --template",
      },
      {
        args: [...send, "--subject", "Hi", "--text", "Hi", "--var", "name=Ada"],
        message: "--template-version and --var need --template.",
      },
      {
        args: [...send, "--template", "tpl_1", "--var", "name"],
        message: "--var must use key=value format.",
      },
      {
        args: ["templates", "create", "--name", "Welcome", "--subject", "Hi"],
        message: "Provide --html or --text.",
      },
      {
        args: ["templates", "update", "tpl_1", "--html", "<p>Hi</p>", "--clear-html"],
        message: "Use either --html or --clear-html, not both.",
      },
      {
        args: ["templates", "update", "tpl_1"],
        message: "Provide at least one field to change.",
      },
      {
        args: ["templates", "version", "tpl_1", "latest"],
        message: "Version must be a positive integer.",
      },
    ];

    for (const { args, message } of cases) {
      const stderr = createOutput();
      let called = false;
      const code = await runCli(args, {
        stderr: stderr.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async () => {
          called = true;
          return jsonResponse({});
        }),
      });

      expect(called).toBe(false);
      expect(code).toBe(1);
      expect(stderr.text()).toContain(message);
    }
  });

  test("gets an owner with implicit all-mailbox access", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const response = {
      object: "member",
      id: "mem_owner",
      email: "owner@example.com",
      name: "Owner",
      role: "owner",
      mailbox_access: { scope: "all", mailbox_ids: [] },
      created_at: "2026-10-01T00:00:00.000Z",
    };

    const code = await runCli(["members", "get", "mem_owner"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse(response);
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/api/v1/members/mem_owner");
    expect(stdout.text()).toBe(`${JSON.stringify(response, null, 2)}\n`);
  });

  test("invites a member with selected mailboxes and an idempotency key", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const response = {
      object: "invitation",
      id: "inv_sam",
      email: "sam@example.com",
      role: "member",
      mailbox_access: { scope: "selected", mailbox_ids: ["mbx_support", "mbx_sales"] },
      newsletter_role: "editor",
      created_at: "2026-10-27T00:00:00.000Z",
      expires_at: "2026-11-03T00:00:00.000Z",
    };

    const code = await runCli(
      [
        "members",
        "invite",
        "sam@example.com",
        "--role",
        "member",
        "--mailbox",
        "mbx_support",
        "--mailbox",
        "mbx_sales",
        "--newsletter-editor",
        "--idempotency-key",
        "invite-sam",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse(response, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.init?.method).toBe("POST");
    expect(captured?.url.pathname).toBe("/api/v1/members/invitations");
    expect(headersFrom(captured?.init).get("idempotency-key")).toBe("invite-sam");
    expect(await readJsonBody(captured?.init)).toEqual({
      email: "sam@example.com",
      role: "member",
      mailbox_ids: ["mbx_support", "mbx_sales"],
      newsletter_role: "editor",
    });
    expect(stdout.text()).toBe(`${JSON.stringify(response, null, 2)}\n`);
  });

  test("invites an admin with every mailbox", async () => {
    let body: unknown;
    const code = await runCli(
      ["members", "invite", "ops@example.com", "--role", "admin", "--all-mailboxes"],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (_input, init) => {
          body = await readJsonBody(init);
          return jsonResponse({}, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(body).toEqual({ email: "ops@example.com", role: "admin", mailbox_access: "all" });
  });

  test("rejects an invitation that mixes every mailbox with selected ones", async () => {
    const stderr = createOutput();
    const code = await runCli(
      [
        "members",
        "invite",
        "ops@example.com",
        "--role",
        "admin",
        "--all-mailboxes",
        "--mailbox",
        "mbx_support",
      ],
      { stderr: stderr.out, env: { SHIPMAIL_API_KEY: "sm_live_test" } },
    );

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Use either --all-mailboxes or --mailbox, not both.");
  });

  test("rejects an unknown invitation role", async () => {
    const stderr = createOutput();
    const code = await runCli(["members", "invite", "ops@example.com", "--role", "owner"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("--role must be admin or member.");
  });

  test("lists and cancels member invitations", async () => {
    const stdout = createOutput();
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : jsonResponse({ data: [] });
    });
    const options = { stdout: stdout.out, env: { SHIPMAIL_API_KEY: "sm_live_test" }, fetch };

    expect(await runCli(["members", "invitations", "list"], options)).toBe(0);
    expect(await runCli(["members", "invitations", "cancel", "inv_sam"], options)).toBe(0);

    expect(requests.map((request) => [request.init?.method, request.url.pathname])).toEqual([
      ["GET", "/api/v1/members/invitations"],
      ["DELETE", "/api/v1/members/invitations/inv_sam"],
    ]);
    expect(stdout.text()).toContain(JSON.stringify({ ok: true, id: "inv_sam" }, null, 2));
  });

  test("shares and unshares a mailbox with a member", async () => {
    const requests: CapturedRequest[] = [];
    const member = {
      object: "member",
      id: "mem_sam",
      email: "sam@example.com",
      name: "Sam",
      role: "member",
      mailbox_access: { scope: "selected", mailbox_ids: ["mbx_sales"] },
      created_at: "2026-10-01T00:00:00.000Z",
    };
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return jsonResponse(member);
    });
    const options = {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch,
    };

    expect(await runCli(["members", "mailboxes", "grant", "mem_sam", "mbx_sales"], options)).toBe(
      0,
    );
    expect(await runCli(["members", "mailboxes", "revoke", "mem_sam", "mbx_sales"], options)).toBe(
      0,
    );

    expect(requests.map((request) => [request.init?.method, request.url.pathname])).toEqual([
      ["PUT", "/api/v1/members/mem_sam/mailboxes/mbx_sales"],
      ["DELETE", "/api/v1/members/mem_sam/mailboxes/mbx_sales"],
    ]);
  });

  test("creates and manually runs an automation", async () => {
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return jsonResponse(
        new URL(String(input)).pathname.endsWith("/run")
          ? { object: "automation_run", id: "aar_1", status: "queued" }
          : { object: "automation", id: "aaut_1", status: "active" },
      );
    });
    const env = { SHIPMAIL_API_KEY: "sm_live_test" };
    const definition = {
      trigger: { type: "manual", mailbox_ids: ["mbx_1"] },
      conditions: [],
      actions: [{ type: "generate_mail_report", metric: "received", lookback_minutes: 1_440 }],
      mode: "draft",
      scope: { mailbox_ids: ["mbx_1"], calendar_addresses: [] },
    };

    expect(
      await runCli(
        [
          "automations",
          "create",
          "--name",
          "Daily brief",
          "--definition",
          JSON.stringify(definition),
        ],
        { stdout: createOutput().out, env, fetch },
      ),
    ).toBe(0);
    expect(
      await runCli(["automations", "run", "aaut_1"], {
        stdout: createOutput().out,
        env,
        fetch,
      }),
    ).toBe(0);
    expect(requests.map(({ url, init }) => `${init?.method} ${url.pathname}`)).toEqual([
      "POST /api/v1/automations",
      "POST /api/v1/automations/aaut_1/run",
    ]);
    expect(await readJsonBody(requests[0]?.init)).toEqual({
      name: "Daily brief",
      definition,
    });
  });

  test("creates an audience with consent_source", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      ["audiences", "create", "Newsletter", "--consent-source", "Signup form"],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse(
            { object: "audience", id: "aud_1", name: "Newsletter" },
            { status: 201 },
          );
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/audiences");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({
      name: "Newsletter",
      consent_source: "Signup form",
    });
    expect(JSON.parse(stdout.text()).id).toBe("aud_1");
  });

  test("updates audience feed settings", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "audiences",
        "feed",
        "update",
        "aud_1",
        "--enabled",
        "true",
        "--title",
        "Release notes",
        "--canonical-url",
        "https://example.com/feed.xml",
        "--entry-limit",
        "25",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "audience_feed", audience_id: "aud_1", enabled: true });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/audiences/aud_1/feed");
    expect(captured?.init?.method).toBe("PATCH");
    expect(await readJsonBody(captured?.init)).toEqual({
      enabled: true,
      title: "Release notes",
      canonical_url: "https://example.com/feed.xml",
      entry_limit: 25,
    });
  });

  test("rejects non-integer and out-of-range feed entry limits", async () => {
    for (const [value, message] of [
      ["10.5", "--entry-limit must be an integer."],
      ["9", "--entry-limit must be between 10 and 100."],
      ["101", "--entry-limit must be between 10 and 100."],
    ] as const) {
      const stderr = createOutput();
      const code = await runCli(["audiences", "feed", "update", "aud_1", "--entry-limit", value], {
        stderr: stderr.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
      });
      expect(code).toBe(1);
      expect(stderr.text()).toContain(message);
    }
  });

  test("rotates and revokes audience feed URLs", async () => {
    const paths: string[] = [];
    const methods: string[] = [];
    const headers: Headers[] = [];

    for (const action of ["rotate", "revoke"]) {
      const code = await runCli(
        ["audiences", "feed", action, "aud_1", "--idempotency-key", `feed-${action}`],
        {
          stdout: createOutput().out,
          env: { SHIPMAIL_API_KEY: "sm_live_test" },
          fetch: stubFetch(async (input, init) => {
            paths.push(new URL(String(input)).pathname);
            methods.push(init?.method ?? "");
            headers.push(headersFrom(init));
            return jsonResponse({
              object: "audience_feed",
              audience_id: "aud_1",
              enabled: true,
            });
          }),
        },
      );
      expect(code).toBe(0);
    }

    expect(paths).toEqual([
      "/api/v1/audiences/aud_1/feed/rotate",
      "/api/v1/audiences/aud_1/feed/revoke",
    ]);
    expect(methods).toEqual(["POST", "POST"]);
    expect(headers.map((value) => value.get("idempotency-key"))).toEqual([
      "feed-rotate",
      "feed-revoke",
    ]);
  });

  test("manages an audience welcome sequence", async () => {
    const calls: { path: string; method: string; body: unknown }[] = [];
    const run = (args: readonly string[]) =>
      runCli([...args], {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          calls.push({
            path: new URL(String(input)).pathname,
            method: init?.method ?? "GET",
            body: init?.body ? await readJsonBody(init) : null,
          });
          return jsonResponse({ object: "welcome_sequence", audience_id: "aud_1" });
        }),
      });

    expect(await run(["audiences", "welcome", "get", "aud_1"])).toBe(0);
    expect(await run(["audiences", "welcome", "enable", "aud_1"])).toBe(0);
    expect(
      await run([
        "audiences",
        "welcome",
        "add-step",
        "aud_1",
        "--subject",
        "Welcome",
        "--markdown",
        "# Hello",
        "--wait-minutes",
        "60",
      ]),
    ).toBe(0);
    expect(
      await run([
        "audiences",
        "welcome",
        "update-step",
        "aud_1",
        "nwswstp_1",
        "--wait-minutes",
        "0",
      ]),
    ).toBe(0);
    expect(await run(["audiences", "welcome", "remove-step", "aud_1", "nwswstp_1"])).toBe(0);

    expect(calls).toEqual([
      { path: "/api/v1/audiences/aud_1/welcome-sequence", method: "GET", body: null },
      {
        path: "/api/v1/audiences/aud_1/welcome-sequence",
        method: "PATCH",
        body: { enabled: true },
      },
      {
        path: "/api/v1/audiences/aud_1/welcome-sequence/steps",
        method: "POST",
        body: { subject: "Welcome", content_markdown: "# Hello", wait_minutes: 60 },
      },
      {
        path: "/api/v1/audiences/aud_1/welcome-sequence/steps/nwswstp_1",
        method: "PATCH",
        body: { wait_minutes: 0 },
      },
      {
        path: "/api/v1/audiences/aud_1/welcome-sequence/steps/nwswstp_1",
        method: "DELETE",
        body: null,
      },
    ]);
  });

  test("sends newsletter Markdown as content_markdown", async () => {
    let body: unknown = null;
    const code = await runCli(
      ["newsletters", "update", "nws_1", "--markdown", "## Hi\n\n:::callout\nNote\n:::"],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (_input, init) => {
          body = await readJsonBody(init);
          return jsonResponse({ object: "newsletter", id: "nws_1" });
        }),
      },
    );
    expect(code).toBe(0);
    expect(body).toEqual({ content_markdown: "## Hi\n\n:::callout\nNote\n:::" });
  });

  test("fetches audience feed settings", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(["audiences", "feed", "get", "aud_1"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({ object: "audience_feed", audience_id: "aud_1", enabled: true });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/audiences/aud_1/feed");
    expect(captured?.init?.method ?? "GET").toBe("GET");
    expect(JSON.parse(stdout.text()).audience_id).toBe("aud_1");
  });

  test("rejects a feed update without settings", async () => {
    const stderr = createOutput();

    const code = await runCli(["audiences", "feed", "update", "aud_1"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Provide at least one feed setting to update.");
  });

  test("rejects an unknown audiences feed action", async () => {
    const stderr = createOutput();

    const code = await runCli(["audiences", "feed", "enable", "aud_1"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Unknown audiences feed command.");
  });

  test("adds a subscriber to an audience", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      ["audiences", "subscribers", "add", "aud_1", "jane@example.com", "--name", "Jane"],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ email_address: "jane@example.com", outcome: "created" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/audiences/aud_1/subscribers");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({
      email_address: "jane@example.com",
      display_name: "Jane",
    });
    expect(JSON.parse(stdout.text()).outcome).toBe("created");
  });

  test("resubscribes a subscriber with consent source", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "audiences",
        "subscribers",
        "resubscribe",
        "aud_1",
        "audmem_1",
        "--consent-source",
        "Signup form",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "subscriber", id: "audmem_1", status: "subscribed" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.href).toBe(
      "https://shipmail.to/api/v1/audiences/aud_1/subscribers/audmem_1/resubscribe",
    );
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({ consent_source: "Signup form" });
    expect(JSON.parse(stdout.text()).status).toBe("subscribed");
  });

  test("runs generic authenticated API requests", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      ["api", "POST", "/mailboxes", "--data", '{"domain_id":"dom_123","address":"hello"}'],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "mailbox", id: "mbx_123" }, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/api/v1/mailboxes");
    expect(captured?.init?.method).toBe("POST");
    expect(headersFrom(captured?.init).get("authorization")).toBe("Bearer sm_test");
    expect(await readJsonBody(captured?.init)).toEqual({
      domain_id: "dom_123",
      address: "hello",
    });
    expect(JSON.parse(stdout.text())).toEqual({ object: "mailbox", id: "mbx_123" });
  });

  test("gives generic API requests a timeout", async () => {
    let captured: CapturedRequest | undefined;

    const code = await runCli(["api", "GET", "/domains"], {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({ data: [] });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("refuses a base URL outside https://*.shipmail.to", async () => {
    for (const baseUrl of ["http://shipmail.to/api/v1", "https://shipmail.to.evil.test/api/v1"]) {
      const stderr = createOutput();
      let called = false;

      const code = await runCli(["domains", "list"], {
        stderr: stderr.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: baseUrl },
        fetch: stubFetch(async () => {
          called = true;
          return jsonResponse({ data: [] });
        }),
      });

      expect(code).toBe(1);
      expect(called).toBe(false);
      expect(stderr.text()).toContain("SHIPMAIL_ALLOW_INSECURE_BASE_URL=1");
    }
  });

  test("allows a development base URL when explicitly permitted", async () => {
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      ["api", "GET", "/domains", "--base-url", "http://localhost:3000/api/v1/"],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_ALLOW_INSECURE_BASE_URL: "1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ data: [] });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.toString()).toBe("http://localhost:3000/api/v1/domains");
  });

  test("rejects JSON inputs with the wrong shape before calling the API", async () => {
    const cases: readonly { readonly args: readonly string[]; readonly message: string }[] = [
      {
        args: [
          "newsletters",
          "create",
          "--audience-id",
          "aud_1",
          "--sender-identity-id",
          "sid_1",
          "--name",
          "Launch",
          "--subject",
          "Hello",
          "--blocks",
          '[{"type":"marquee","text":"hi"}]',
        ],
        message: "Every --blocks item must be an object whose type is one of",
      },
      {
        args: ["automations", "create", "--name", "Brief", "--definition", '{"trigger":{}}'],
        message: "--definition must be a JSON object with trigger",
      },
      {
        args: [
          "messages",
          "send",
          "--from",
          "a@example.com",
          "--to",
          "b@example.com",
          "--subject",
          "Hi",
          "--text",
          "Hi",
          "--metadata",
          '{"nested":{"a":1}}',
        ],
        message: "--metadata must be a JSON object of string, number, boolean or null values",
      },
    ];

    for (const { args, message } of cases) {
      const stderr = createOutput();
      let called = false;

      const code = await runCli(args, {
        stderr: stderr.out,
        env: { SHIPMAIL_API_KEY: "sm_test" },
        fetch: stubFetch(async () => {
          called = true;
          return jsonResponse({});
        }),
      });

      expect(called).toBe(false);
      expect(code).toBe(1);
      expect(stderr.text()).toContain(message);
    }
  });

  test("suspends and resumes a mailbox", async () => {
    const requests: CapturedRequest[] = [];
    const stdout = createOutput();
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return jsonResponse({ object: "mailbox", id: "mbx_123", suspension_reasons: [] });
    });

    expect(
      await runCli(["mailboxes", "suspend", "mbx_123"], { stdout: stdout.out, env, fetch }),
    ).toBe(0);
    expect(
      await runCli(["mailboxes", "resume", "mbx_123"], { stdout: stdout.out, env, fetch }),
    ).toBe(0);
    expect(requests.map((request) => request.url.pathname)).toEqual([
      "/v1/mailboxes/mbx_123/suspend",
      "/v1/mailboxes/mbx_123/resume",
    ]);
    expect(requests.every((request) => request.init?.method === "POST")).toBe(true);
  });

  test("stages a mailbox attachment from raw file bytes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shipmail-stage-"));
    try {
      const file = join(dir, "invoice.pdf");
      writeFileSync(file, new Uint8Array([1, 2, 3, 4]));
      const stdout = createOutput();
      let captured: CapturedRequest | undefined;

      const code = await runCli(
        ["mailboxes", "stage-attachment", "mbx_123", file, "--content-type", "application/pdf"],
        {
          stdout: stdout.out,
          env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
          fetch: stubFetch(async (input, init) => {
            captured = { url: new URL(String(input)), init };
            return jsonResponse(
              {
                object: "staged_attachment",
                id: "sat_123",
                mailbox_id: "mbx_123",
                filename: "invoice.pdf",
                content_type: "application/pdf",
                size: 4,
                sha256: "a".repeat(64),
                expires_at: "2026-07-25T12:00:00.000Z",
              },
              { status: 201 },
            );
          }),
        },
      );

      expect(code).toBe(0);
      expect(captured?.url.pathname).toBe("/v1/mailboxes/mbx_123/staged-attachments");
      expect(captured?.url.searchParams.get("filename")).toBe("invoice.pdf");
      expect(captured?.init?.method).toBe("POST");
      expect(headersFrom(captured?.init).get("content-type")).toBe("application/pdf");
      expect(
        Array.from(new Uint8Array(await new Response(captured?.init?.body).arrayBuffer())),
      ).toEqual([1, 2, 3, 4]);
      expect(JSON.parse(stdout.text()).id).toBe("sat_123");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("prepares a signed component upload from local file metadata", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shipmail-prepare-upload-"));
    try {
      const file = join(dir, "invoice.pdf");
      writeFileSync(file, new Uint8Array([1, 2, 3, 4]));
      const stdout = createOutput();
      let captured: CapturedRequest | undefined;

      const code = await runCli(
        [
          "mailboxes",
          "prepare-attachment-upload",
          "mbx_123",
          file,
          "--content-type",
          "application/pdf",
        ],
        {
          stdout: stdout.out,
          env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
          fetch: stubFetch(async (input, init) => {
            captured = { url: new URL(String(input)), init };
            return jsonResponse(
              {
                object: "staged_attachment_upload",
                mailbox_id: "mbx_123",
                filename: "invoice.pdf",
                content_type: "application/pdf",
                size: 4,
                sha256: "a".repeat(64),
                upload_url: "https://shipmail.to/api/v1/staged-attachment-uploads/token",
                expires_at: "2026-07-24T12:05:00.000Z",
              },
              { status: 201 },
            );
          }),
        },
      );

      expect(code).toBe(0);
      expect(captured?.url.pathname).toBe("/v1/mailboxes/mbx_123/staged-attachment-upload-tokens");
      expect(headersFrom(captured?.init).has("idempotency-key")).toBe(false);
      expect(await readJsonBody(captured?.init)).toMatchObject({
        filename: "invoice.pdf",
        content_type: "application/pdf",
        size: 4,
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      expect(JSON.parse(stdout.text()).object).toBe("staged_attachment_upload");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("lists, updates, and cancels scheduled messages", async () => {
    const requests: CapturedRequest[] = [];
    const stdout = createOutput();
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };
    const fetch = stubFetch(async (input, init) => {
      const request = { url: new URL(String(input)), init };
      requests.push(request);
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      if (request.url.pathname.endsWith("/scheduled-messages")) {
        return jsonResponse({ object: "scheduled_message_list", data: [], total: 0 });
      }
      return jsonResponse({
        object: "scheduled_message",
        id: "msg_123",
        scheduled_message_id: "sch_123",
        kind: "scheduled",
      });
    });

    expect(
      await runCli(
        ["scheduled-messages", "list", "--include-held", "--search", "invoice", "--limit", "20"],
        { stdout: stdout.out, env, fetch },
      ),
    ).toBe(0);
    expect(
      await runCli(
        [
          "scheduled-messages",
          "update",
          "msg_123",
          "--to",
          "customer@example.net",
          "--subject",
          "Invoice",
          "--text",
          "Attached",
          "--scheduled-at",
          "2026-08-02T08:00:00.000Z",
          "--staged-attachment-id",
          "sat_123",
        ],
        { stdout: stdout.out, env, fetch },
      ),
    ).toBe(0);
    expect(
      await runCli(["scheduled-messages", "cancel", "msg_123"], {
        stdout: stdout.out,
        env,
        fetch,
      }),
    ).toBe(0);

    expect(requests.map((request) => request.init?.method)).toEqual(["GET", "PATCH", "DELETE"]);
    expect(requests[0]?.url.searchParams.get("include_held")).toBe("true");
    expect(await readJsonBody(requests[1]?.init)).toMatchObject({
      staged_attachment_ids: ["sat_123"],
      subject: "Invoice",
    });
  });

  test("lists, adds, and removes mailbox forwarding", async () => {
    const requests: CapturedRequest[] = [];
    const stdout = createOutput();
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };
    const fetch = stubFetch(async (input, init) => {
      const request = { url: new URL(String(input)), init };
      requests.push(request);
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return jsonResponse({ object: "mailbox_forwarding_list", data: [] });
    });

    await runCli(["mailboxes", "forwarding", "mbx_123"], { stdout: stdout.out, env, fetch });
    await runCli(
      [
        "mailboxes",
        "forwarding-add",
        "mbx_123",
        "--destination",
        "owner@example.net",
        "--sender",
        "newsletter@example.com",
        "--recipient",
        "nabeel@example.com",
      ],
      { stdout: stdout.out, env, fetch },
    );
    await runCli(["mailboxes", "forwarding-remove", "mbx_123", "fwd_0123456789abcdefghjkmnpq"], {
      stdout: stdout.out,
      env,
      fetch,
    });

    expect(requests.map((request) => `${request.init?.method} ${request.url.pathname}`)).toEqual([
      "GET /v1/mailboxes/mbx_123/forwarding",
      "POST /v1/mailboxes/mbx_123/forwarding",
      "DELETE /v1/mailboxes/mbx_123/forwarding/fwd_0123456789abcdefghjkmnpq",
    ]);
    expect(await readJsonBody(requests[1]?.init)).toEqual({
      destination: "owner@example.net",
      sender: "newsletter@example.com",
      recipient: "nabeel@example.com",
    });
  });

  test("lists mailbox rules", async () => {
    const requests: CapturedRequest[] = [];
    const stdout = createOutput();
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return jsonResponse({
        object: "mailbox_rules",
        mailbox_id: "mbx_123",
        address: "hello@example.com",
        rules: [],
        folders: [],
      });
    });

    expect(
      await runCli(["mailboxes", "rules", "mbx_123"], { stdout: stdout.out, env, fetch }),
    ).toBe(0);
    expect(requests.map((request) => `${request.init?.method} ${request.url.pathname}`)).toEqual([
      "GET /v1/mailboxes/mbx_123/rules",
    ]);
  });

  test("gets and updates mailbox delivery routing", async () => {
    const requests: CapturedRequest[] = [];
    const stdout = createOutput();
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return jsonResponse({
        object: "mailbox_delivery_routing",
        mailbox_id: "mbx_source",
        source_address: "sales@example.com",
        mode: "round_robin",
        destination_mailbox_ids: ["mbx_a", "mbx_b"],
        fallback_mailbox_id: "mbx_fallback",
        activation_state: "pending",
        activation_error: null,
        destinations: [],
      });
    });

    expect(
      await runCli(["mailboxes", "delivery-routing", "mbx_source"], {
        stdout: stdout.out,
        env,
        fetch,
      }),
    ).toBe(0);
    expect(
      await runCli(
        [
          "mailboxes",
          "delivery-routing-set",
          "mbx_source",
          "--mode",
          "round-robin",
          "--destination-mailbox-id",
          "mbx_a",
          "--destination-mailbox-id",
          "mbx_b",
          "--fallback-mailbox-id",
          "mbx_fallback",
        ],
        { stdout: stdout.out, env, fetch },
      ),
    ).toBe(0);

    expect(requests.map((request) => `${request.init?.method} ${request.url.pathname}`)).toEqual([
      "GET /v1/mailboxes/mbx_source/delivery-routing",
      "PATCH /v1/mailboxes/mbx_source/delivery-routing",
    ]);
    expect(await readJsonBody(requests[1]?.init)).toEqual({
      mode: "round_robin",
      destination_mailbox_ids: ["mbx_a", "mbx_b"],
      fallback_mailbox_id: "mbx_fallback",
    });
  });

  test("creates and reads a mailbox export", async () => {
    const requests: CapturedRequest[] = [];
    const stdout = createOutput();
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return jsonResponse({
        object: "mailbox_export",
        id: "mbexp_0123456789abcdefghjkmnpq",
        status: "completed",
      });
    });

    expect(
      await runCli(["mailboxes", "export", "mbx_123"], { stdout: stdout.out, env, fetch }),
    ).toBe(0);
    expect(
      await runCli(["mailboxes", "export-status", "mbx_123", "mbexp_0123456789abcdefghjkmnpq"], {
        stdout: stdout.out,
        env,
        fetch,
      }),
    ).toBe(0);
    expect(requests.map((request) => `${request.init?.method} ${request.url.pathname}`)).toEqual([
      "POST /v1/mailboxes/mbx_123/exports",
      "GET /v1/mailboxes/mbx_123/exports/mbexp_0123456789abcdefghjkmnpq",
    ]);
  });

  test("lists, creates, and revokes mailbox app passwords", async () => {
    const requests: CapturedRequest[] = [];
    const stdout = createOutput();
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      if (init?.method === "POST") {
        return jsonResponse({ object: "mailbox_app_password", id: "appwd_123", secret: "once" });
      }
      return jsonResponse({ object: "list", data: [] });
    });

    await runCli(["mailboxes", "app-passwords", "list", "mbx_123"], {
      stdout: stdout.out,
      env,
      fetch,
    });
    await runCli(
      [
        "mailboxes",
        "app-passwords",
        "create",
        "mbx_123",
        "--name",
        "Desktop mail",
        "--expires-at",
        "2026-10-01T00:00:00Z",
        "--allowed-cidr",
        "203.0.113.0/24",
        "--allowed-cidr",
        "2001:db8::/32",
      ],
      { stdout: stdout.out, env, fetch },
    );
    await runCli(["mailboxes", "app-passwords", "revoke", "mbx_123", "appwd_123"], {
      stdout: stdout.out,
      env,
      fetch,
    });

    expect(requests.map((request) => `${request.init?.method} ${request.url.pathname}`)).toEqual([
      "GET /v1/mailboxes/mbx_123/app-passwords",
      "POST /v1/mailboxes/mbx_123/app-passwords",
      "DELETE /v1/mailboxes/mbx_123/app-passwords/appwd_123",
    ]);
    expect(await readJsonBody(requests[1]?.init)).toEqual({
      name: "Desktop mail",
      expires_at: "2026-10-01T00:00:00Z",
      allowed_cidrs: ["203.0.113.0/24", "2001:db8::/32"],
    });
  });

  test("maps domain search to the SDK resource", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(["domains", "search", "acme"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({ results: [] });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://api.shipmail.to/v1/domains/search");
    expect(captured?.init?.method).toBe("POST");
    expect(headersFrom(captured?.init).get("authorization")).toBe("Bearer sm_test");
    expect(await readJsonBody(captured?.init)).toEqual({ keyword: "acme" });
    expect(JSON.parse(stdout.text())).toEqual({ results: [] });
  });

  test("gets live domain DNS records through the SDK resource", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const code = await runCli(["domains", "dns-records", "dom_123"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({ object: "dns_record_set", domain_id: "dom_123", records: [] });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/domains/dom_123/dns-records");
    expect(captured?.init?.method).toBe("GET");
  });

  const domainHealth = {
    object: "domain_health",
    domain_id: "dom_123",
    domain: "example.com",
    generated_at: "2026-10-18T12:00:00.000Z",
    dns: {
      mx: true,
      spf: true,
      dkim: true,
      dmarc: false,
      last_checked_at: "2026-10-18T06:00:00.000Z",
    },
    blocklist: { list: "spamhaus_dbl", listed: false, listed_since: null },
    delivery: {
      since: "2026-09-18T12:00:00.000Z",
      until: "2026-10-18T12:00:00.000Z",
      recipients: 3,
      delivered: 2,
      bounced: 1,
      deferred: 0,
      complained: 0,
      failed: 0,
      suppressed: 0,
      queued: 0,
      sent: 0,
      delivery_rate: 66.7,
      providers: [
        {
          provider: "google",
          recipients: 2,
          delivered: 2,
          bounced: 0,
          deferred: 0,
          complained: 0,
          delivery_rate: 100,
        },
        {
          provider: "other",
          recipients: 1,
          delivered: 0,
          bounced: 1,
          deferred: 0,
          complained: 0,
          delivery_rate: 0,
        },
      ],
    },
  };

  test("prints domain health for a person", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const code = await runCli(["domains", "health", "dom_123"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse(domainHealth);
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/domains/dom_123/health");
    expect(captured?.init?.method).toBe("GET");
    expect(stdout.text()).toBe(
      [
        "example.com (dom_123)",
        "",
        "DNS (checked 2026-10-18T06:00:00.000Z)",
        "  MX    pass",
        "  SPF   pass",
        "  DKIM  pass",
        "  DMARC fail",
        "",
        "Spamhaus DBL: not listed",
        "",
        "Delivery, last 30 days: 66.7% delivered",
        "  3 recipients: 2 delivered, 1 bounced, 0 deferred, 0 complained",
        "  Gmail   100% delivered, 2 recipients, 0 bounced, 0 deferred, 0 complained",
        "  Other   0% delivered, 1 recipient, 1 bounced, 0 deferred, 0 complained",
        "",
      ].join("\n"),
    );
  });

  test("prints raw domain health JSON with --json", async () => {
    const stdout = createOutput();
    const code = await runCli(["domains", "health", "dom_123", "--json"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async () => jsonResponse(domainHealth)),
    });

    expect(code).toBe(0);
    expect(JSON.parse(stdout.text())).toEqual(domainHealth);
  });

  test("creates a mailbox with an explicit password", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const code = await runCli(
      [
        "mailboxes",
        "create",
        "--domain-id",
        "dom_123",
        "--address",
        "hello",
        "--password",
        "StrongPass123",
        "--display-name",
        "Hello",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "mailbox", id: "mbx_123" }, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/mailboxes");
    expect(await readJsonBody(captured?.init)).toEqual({
      domain_id: "dom_123",
      address: "hello",
      password: "StrongPass123",
      display_name: "Hello",
    });
  });

  test("reads a mailbox password from a file and removes one trailing newline", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shipmail-cli-password-"));
    const passwordFile = join(dir, "password.txt");
    writeFileSync(passwordFile, "StrongPass123\n");
    try {
      const stdout = createOutput();
      let captured: CapturedRequest | undefined;
      const code = await runCli(
        [
          "mailboxes",
          "create",
          "--domain-id",
          "dom_123",
          "--address",
          "hello",
          "--password-file",
          passwordFile,
        ],
        {
          stdout: stdout.out,
          env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
          fetch: stubFetch(async (input, init) => {
            captured = { url: new URL(String(input)), init };
            return jsonResponse({ object: "mailbox", id: "mbx_123" }, { status: 201 });
          }),
        },
      );

      expect(code).toBe(0);
      expect(await readJsonBody(captured?.init)).toEqual({
        domain_id: "dom_123",
        address: "hello",
        password: "StrongPass123",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects mailbox creation without a password source", async () => {
    const stderr = createOutput();
    const code = await runCli(
      ["mailboxes", "create", "--domain-id", "dom_123", "--address", "hello"],
      { stderr: stderr.out, env: { SHIPMAIL_API_KEY: "sm_test" } },
    );

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Missing --password, --password-file, or --generate-password.");
  });

  test("requests a server-generated mailbox password", async () => {
    let captured: CapturedRequest | undefined;
    const code = await runCli(
      [
        "mailboxes",
        "create",
        "--domain-id",
        "dom_123",
        "--address",
        "hello",
        "--generate-password",
      ],
      {
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "mailbox", id: "mbx_123" }, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(await readJsonBody(captured?.init)).toEqual({
      domain_id: "dom_123",
      address: "hello",
      generate_password: true,
    });
  });

  test("sends and looks up messages with durable client correlation", async () => {
    const stdout = createOutput();
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      const request = { url: new URL(String(input)), init };
      requests.push(request);
      if (request.url.pathname === "/v1/messages" && init?.method === "POST") {
        return jsonResponse({ object: "message", id: "msg_123", client_reference: "crm-123" });
      }
      return jsonResponse({
        data: [{ object: "message", id: "msg_123", client_reference: "crm-123" }],
        pagination: { next_cursor: null, has_more: false, limit: 25 },
      });
    });
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };

    expect(
      await runCli(
        [
          "messages",
          "send",
          "--mailbox-id",
          "mbx_123",
          "--to",
          "user@example.com",
          "--subject",
          "Hello",
          "--text",
          "Hi",
          "--track-reply",
          "--client-reference",
          "crm-123",
          "--metadata",
          '{"campaign":"onboarding"}',
          "--source-rfc-message-id",
          "<crm-123@example.com>",
          "--header",
          "X-CRM-ID: crm-123",
        ],
        { stdout: stdout.out, env, fetch },
      ),
    ).toBe(0);
    expect(await readJsonBody(requests[0]?.init)).toMatchObject({
      client_reference: "crm-123",
      metadata: { campaign: "onboarding" },
      source_rfc_message_id: "<crm-123@example.com>",
      headers: [{ name: "X-CRM-ID", value: "crm-123" }],
      track_reply: true,
    });

    expect(
      await runCli(["messages", "list", "--client-reference", "crm-123"], {
        stdout: stdout.out,
        env,
        fetch,
      }),
    ).toBe(0);
    expect(requests[1]?.url.searchParams.get("client_reference")).toBe("crm-123");
    expect(requests[1]?.url.searchParams.get("mailbox_id")).toBeNull();
  });

  test("replies to a message with a client reference", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const code = await runCli(
      [
        "messages",
        "reply",
        "msg_123",
        "--to",
        "user@example.com",
        "--text",
        "Thanks",
        "--client-reference",
        "crm-reply-123",
        "--track-reply",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "message", id: "msg_reply" });
        }),
      },
    );
    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/messages/msg_123/reply");
    expect(await readJsonBody(captured?.init)).toMatchObject({
      to: ["user@example.com"],
      text: "Thanks",
      client_reference: "crm-reply-123",
      track_reply: true,
    });
  });

  test("lists analytics-safe messages within an update window", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const code = await runCli(
      [
        "messages",
        "analytics",
        "--updated-after",
        "2026-07-01T00:00:00.000Z",
        "--updated-before",
        "2026-07-29T00:00:00.000Z",
        "--limit",
        "100",
        "--cursor",
        "cursor_123",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({
            data: [],
            pagination: {
              next_cursor: null,
              has_more: false,
              limit: 100,
              snapshot_at: "2026-07-29T00:00:00.000Z",
            },
          });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/messages/analytics");
    expect(captured?.url.searchParams.get("updated_after")).toBe("2026-07-01T00:00:00.000Z");
    expect(captured?.url.searchParams.get("updated_before")).toBe("2026-07-29T00:00:00.000Z");
    expect(captured?.url.searchParams.get("limit")).toBe("100");
    expect(captured?.url.searchParams.get("cursor")).toBe("cursor_123");
  });

  test("replies to inbox IDs within their mailbox scope", async () => {
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return jsonResponse({ object: "message", id: "msg_reply" }, { status: 201 });
    });
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };

    expect(
      await runCli(
        [
          "inbox",
          "reply-message",
          "mbx_123",
          "eml_123",
          "--to",
          "user@example.com",
          "--text",
          "Thanks",
        ],
        { env, fetch },
      ),
    ).toBe(0);
    expect(
      await runCli(
        [
          "inbox",
          "reply-thread",
          "mbx_123",
          "thr_123",
          "--to",
          "user@example.com",
          "--bcc",
          "manager@example.com",
          "--text",
          "Following up",
        ],
        { env, fetch },
      ),
    ).toBe(0);

    expect(requests.map((request) => request.url.pathname)).toEqual([
      "/v1/mailboxes/mbx_123/inbox/messages/eml_123/reply",
      "/v1/mailboxes/mbx_123/inbox/threads/thr_123/reply",
    ]);
    expect(JSON.parse(String(requests[1]?.init?.body))).toMatchObject({
      bcc: ["manager@example.com"],
    });
  });

  test("runs the versioned inbox draft and reply-scan workflow", async () => {
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      const request = { url: new URL(String(input)), init };
      requests.push(request);
      if (request.url.pathname === "/v1/reply-scans") {
        return jsonResponse(
          { object: "reply_scan", id: "rsc_123", status: "completed" },
          { status: 201 },
        );
      }
      if (request.url.pathname.endsWith("/drafts")) {
        return jsonResponse(
          { object: "inbox_reply_draft", id: "drf_123", status: "draft" },
          { status: 201 },
        );
      }
      if (request.url.pathname.endsWith("/send")) {
        return jsonResponse({
          object: "inbox_reply_draft_send",
          draft_id: "drf_123",
          status: "sent",
        });
      }
      return jsonResponse({ object: "inbox_threads", data: [], pagination: {} });
    });
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };

    expect(
      await runCli(
        [
          "inbox",
          "threads",
          "mbx_123",
          "--attention-state",
          "needs_reply",
          "--after",
          "2025-07-20T00:00:00.000Z",
          "--cursor",
          "opaque_cursor",
        ],
        { env, fetch },
      ),
    ).toBe(0);
    expect(
      await runCli(
        [
          "inbox",
          "draft",
          "mbx_123",
          "thr_123",
          "--expected-version",
          "7",
          "--text",
          "Thanks for the note.",
          "--reply-mode",
          "reply_all",
        ],
        { env, fetch },
      ),
    ).toBe(0);
    expect(
      await runCli(
        [
          "inbox",
          "send-draft",
          "mbx_123",
          "thr_123",
          "drf_123",
          "--expected-content-sha256",
          "a".repeat(64),
        ],
        { env, fetch },
      ),
    ).toBe(0);
    expect(
      await runCli(
        [
          "reply-scans",
          "create",
          "--mailbox-id",
          "mbx_123",
          "--after",
          "2025-07-20T00:00:00.000Z",
          "--before",
          "2026-07-20T00:00:00.000Z",
        ],
        { env, fetch },
      ),
    ).toBe(0);

    expect(requests[0]?.url.searchParams.get("attention_state")).toBe("needs_reply");
    expect(requests[0]?.url.searchParams.get("cursor")).toBe("opaque_cursor");
    expect(await readJsonBody(requests[1]?.init)).toEqual({
      expected_version: 7,
      text: "Thanks for the note.",
      reply_mode: "reply_all",
    });
    expect(await readJsonBody(requests[2]?.init)).toEqual({
      expected_content_sha256: "a".repeat(64),
    });
    expect(requests.map((request) => request.url.pathname)).toEqual([
      "/v1/mailboxes/mbx_123/inbox/threads",
      "/v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts",
      "/v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts/drf_123/send",
      "/v1/reply-scans",
    ]);
    expect(await readJsonBody(requests[3]?.init)).toEqual({
      mailbox_ids: ["mbx_123"],
      after: "2025-07-20T00:00:00.000Z",
      before: "2026-07-20T00:00:00.000Z",
    });
  });

  test("lists, reads, updates and deletes reply drafts", async () => {
    const requests: CapturedRequest[] = [];
    const stdout = createOutput();
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      if (String(input).endsWith("/drafts")) {
        return jsonResponse({ object: "list", data: [] });
      }
      return jsonResponse({ object: "inbox_reply_draft", id: "drf_123", status: "draft" });
    });
    const env = { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" };
    const draftArgs = ["mbx_123", "thr_123", "drf_123"];

    expect(await runCli(["inbox", "drafts", "mbx_123", "thr_123"], { env, fetch })).toBe(0);
    expect(await runCli(["inbox", "get-draft", ...draftArgs], { env, fetch })).toBe(0);
    expect(
      await runCli(["inbox", "update-draft", ...draftArgs, "--html", "<p>Thanks.</p>"], {
        env,
        fetch,
      }),
    ).toBe(0);
    expect(
      await runCli(["inbox", "delete-draft", ...draftArgs], { stdout: stdout.out, env, fetch }),
    ).toBe(0);
    expect(await runCli(["inbox", "update-draft", ...draftArgs], { env, fetch })).toBe(1);

    expect(
      requests.map((request) => `${request.init?.method ?? "GET"} ${request.url.pathname}`),
    ).toEqual([
      "GET /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts",
      "GET /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts/drf_123",
      "PATCH /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts/drf_123",
      "DELETE /v1/mailboxes/mbx_123/inbox/threads/thr_123/drafts/drf_123",
    ]);
    expect(await readJsonBody(requests[2]?.init)).toEqual({ html: "<p>Thanks.</p>" });
    expect(JSON.parse(stdout.text())).toEqual({ ok: true, id: "drf_123" });
  });

  test("saves a new inbox draft without sending it", async () => {
    let captured: CapturedRequest | undefined;
    const stdout = createOutput();
    const fetch = stubFetch(async (input, init) => {
      captured = { url: new URL(String(input)), init };
      return jsonResponse({ object: "inbox_draft", id: "eml_draft" }, { status: 201 });
    });

    const code = await runCli(
      [
        "inbox",
        "compose-draft",
        "mbx_123",
        "--to",
        "Jane <jane@example.com>",
        "--to",
        "ops@example.com",
        "--bcc",
        "audit@example.com",
        "--subject",
        "Kickoff",
        "--text",
        "Draft for review.",
        "--idempotency-key",
        "draft-123",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch,
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/mailboxes/mbx_123/inbox/drafts");
    expect(captured?.init?.method).toBe("POST");
    expect(headersFrom(captured?.init).get("idempotency-key")).toBe("draft-123");
    expect(await readJsonBody(captured?.init)).toEqual({
      to: ["Jane <jane@example.com>", "ops@example.com"],
      bcc: ["audit@example.com"],
      subject: "Kickoff",
      text: "Draft for review.",
    });
    expect(JSON.parse(stdout.text()).object).toBe("inbox_draft");
  });

  test("passes the inbox listing filters", async () => {
    const urls: URL[] = [];
    const fetch = stubFetch(async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      return jsonResponse({ object: "inbox_messages", data: [], pagination: {} });
    });
    const options = {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch,
    };
    const textFilters = ["--from", "jane@example.com", "--to", "billing", "--subject", "Invoice"];

    expect(
      await runCli(["inbox", "list", "mbx_123", ...textFilters, "--has-attachment"], options),
    ).toBe(0);
    expect(await runCli(["inbox", "list", "mbx_123", "--has-attachment", "false"], options)).toBe(
      0,
    );

    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      from: "jane@example.com",
      to: "billing",
      subject: "Invoice",
      has_attachment: "true",
    });
    expect(Object.fromEntries(urls[1]?.searchParams ?? [])).toEqual({ has_attachment: "false" });
  });

  test("updates mailbox hold and releases an exact security snapshot", async () => {
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      const request = { url: new URL(String(input)), init };
      requests.push(request);
      if (request.url.pathname.endsWith("/security-review")) {
        return jsonResponse({
          object: "inbox_message_security_review",
          mailbox_id: "mbx_123",
          message_id: "eml_123",
          security: { status: "flagged", review: { decision: "released" } },
        });
      }
      return jsonResponse({ object: "mailbox", id: "mbx_123", agent_security_hold: true });
    });
    const options = {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch,
    };

    expect(
      await runCli(["mailboxes", "update", "mbx_123", "--agent-security-hold", "true"], options),
    ).toBe(0);
    expect(
      await runCli(
        [
          "inbox",
          "security-review",
          "mbx_123",
          "eml_123",
          "--reason",
          "Known invoice workflow",
          "--expected-content-sha256",
          "a".repeat(64),
        ],
        options,
      ),
    ).toBe(0);

    expect(requests.map((request) => `${request.init?.method} ${request.url.pathname}`)).toEqual([
      "PATCH /v1/mailboxes/mbx_123",
      "POST /v1/mailboxes/mbx_123/inbox/messages/eml_123/security-review",
    ]);
    expect(await readJsonBody(requests[0]?.init)).toEqual({ agent_security_hold: true });
    expect(await readJsonBody(requests[1]?.init)).toEqual({
      decision: "release",
      reason: "Known invoice workflow",
      expected_content_sha256: "a".repeat(64),
    });
  });

  test("rejects an inbox compose-draft without a body", async () => {
    const stderr = createOutput();

    const code = await runCli(["inbox", "compose-draft", "mbx_123", "--to", "jane@example.com"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Provide --text or --html.");
  });

  test("injects a fake inbound sandbox message", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;
    const code = await runCli(
      [
        "mailboxes",
        "sandbox-inbound",
        "mbx_123",
        "--from",
        "customer@example.com",
        "--subject",
        "Sandbox reply",
        "--text",
        "Looks good",
        "--message-id",
        "<reply-1@example.com>",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test_key", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "message", id: "msg_test", mode: "test" }, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/mailboxes/mbx_123/sandbox/inbound");
    expect(await readJsonBody(captured?.init)).toEqual({
      from: "customer@example.com",
      subject: "Sandbox reply",
      text: "Looks good",
      message_id: "<reply-1@example.com>",
    });
    expect(JSON.parse(stdout.text()).mode).toBe("test");
  });

  test("lists newsletter domains through the SDK resource", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(["newsletter-domains", "list", "--limit", "10"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({
          data: [{ object: "newsletter_domain", id: "nwsdom_123" }],
          pagination: { next_cursor: null, has_more: false, limit: 10 },
        });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://api.shipmail.to/v1/newsletter-domains?limit=10");
    expect(captured?.init?.method).toBe("GET");
    expect(headersFrom(captured?.init).get("authorization")).toBe("Bearer sm_test");
    expect(JSON.parse(stdout.text()).data[0].id).toBe("nwsdom_123");
  });

  test("lists newsletter sender identities through the SDK resource", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(["newsletter-sender-identities", "list", "--limit", "10"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({
          data: [{ object: "newsletter_sender_identity", id: "nwsid_123" }],
          pagination: { next_cursor: null, has_more: false, limit: 10 },
        });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.href).toBe(
      "https://api.shipmail.to/v1/newsletter-sender-identities?limit=10",
    );
    expect(captured?.init?.method).toBe("GET");
    expect(headersFrom(captured?.init).get("authorization")).toBe("Bearer sm_test");
    expect(JSON.parse(stdout.text()).data[0].id).toBe("nwsid_123");
  });

  test("registers newsletter assets from existing CDN URLs", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "newsletter-assets",
        "register-url",
        "https://cdn.shipmail.to/newsletter-images/org_123/hero.png",
        "--filename",
        "hero.png",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "newsletter_asset", id: "nwsasset_123" }, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/newsletter-assets");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({
      url: "https://cdn.shipmail.to/newsletter-images/org_123/hero.png",
      filename: "hero.png",
    });
    expect(JSON.parse(stdout.text()).id).toBe("nwsasset_123");
  });

  test("lists newsletter assets with filtering and cursor pagination", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "newsletter-assets",
        "list",
        "--kind",
        "image",
        "--q",
        "hero",
        "--limit",
        "25",
        "--cursor",
        "next-page",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({
            data: [],
            pagination: { next_cursor: null, has_more: false, limit: 25 },
            storage: {
              used_bytes: 1_024,
              limit_bytes: null,
              remaining_bytes: null,
              over_limit: false,
              plan: "free",
              is_in_trial: false,
              next_upgrade: null,
            },
          });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/newsletter-assets");
    expect(captured?.url.searchParams.get("kind")).toBe("image");
    expect(captured?.url.searchParams.get("q")).toBe("hero");
    expect(captured?.url.searchParams.get("limit")).toBe("25");
    expect(captured?.url.searchParams.get("cursor")).toBe("next-page");
    expect(JSON.parse(stdout.text()).storage.limit_bytes).toBeNull();
  });

  test("uploads newsletter images through direct storage and single-use completion", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shipmail-newsletter-upload-"));
    try {
      const file = join(dir, "hero.png");
      writeFileSync(file, new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
      const requests: CapturedRequest[] = [];
      const stdout = createOutput();
      const code = await runCli(["newsletter-assets", "upload", file], {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          const request = { url: new URL(String(input)), init };
          requests.push(request);
          if (request.url.pathname === "/v1/newsletter-assets/upload-tokens") {
            return jsonResponse(
              {
                object: "newsletter_asset_upload",
                kind: "image",
                filename: "hero.png",
                content_type: "image/png",
                size: 4,
                sha256: "a".repeat(64),
                upload_url: "https://r2.example/hero.png?signed=put",
                upload_method: "PUT",
                upload_headers: {
                  "Content-Type": "image/png",
                  "If-None-Match": "*",
                },
                complete_url: "https://api.shipmail.to/v1/newsletter-asset-uploads/token",
                complete_method: "POST",
                expires_at: "2026-08-09T12:05:00.000Z",
              },
              { status: 201 },
            );
          }
          if (request.url.hostname === "r2.example") return new Response(null, { status: 200 });
          return jsonResponse({ object: "newsletter_asset", id: "nwsasset_123" }, { status: 201 });
        }),
      });

      expect(code).toBe(0);
      expect(requests.map((request) => request.init?.method)).toEqual(["POST", "PUT", "POST"]);
      expect(headersFrom(requests[0]?.init).get("authorization")).toBe("Bearer sm_test");
      expect(headersFrom(requests[1]?.init).get("authorization")).toBeNull();
      expect(headersFrom(requests[1]?.init).get("if-none-match")).toBe("*");
      expect(headersFrom(requests[2]?.init).get("authorization")).toBeNull();
      expect(JSON.parse(stdout.text()).id).toBe("nwsasset_123");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("creates newsletters from flags and blocks JSON", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "newsletters",
        "create",
        "--audience-id",
        "aud_123",
        "--sender-identity-id",
        "nwsid_456",
        "--name",
        "July changelog",
        "--subject",
        "What shipped in July",
        "--blocks",
        '[{"type":"heading","level":1,"text":"July updates"},{"type":"paragraph","body":"Read the <a href=\\"https://example.com/launch\\">launch notes</a>."}]',
        "--send-window-hours",
        "6",
        "--feed-entry-url",
        "https://example.com/",
        "--styling-mode",
        "plain",
        "--track-engagement",
        "true",
        "--add-utm-tags",
        "true",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse(
            { object: "newsletter", id: "nws_123", status: "draft" },
            { status: 201 },
          );
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/newsletters");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({
      audience_id: "aud_123",
      sender_identity_id: "nwsid_456",
      name: "July changelog",
      subject: "What shipped in July",
      blocks: [
        { type: "heading", level: 1, text: "July updates" },
        {
          type: "paragraph",
          body: 'Read the <a href="https://example.com/launch">launch notes</a>.',
        },
      ],
      send_window_hours: 6,
      feed_entry_url: "https://example.com/",
      styling_mode: "plain",
      track_engagement: true,
      add_utm_tags: true,
    });
    expect(JSON.parse(stdout.text()).id).toBe("nws_123");
  });

  test("creates newsletters with plain-text body", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "newsletters",
        "create",
        "--audience-id",
        "aud_123",
        "--sender-identity-id",
        "nwsid_456",
        "--name",
        "Quick note",
        "--subject",
        "Hello",
        "--body-text",
        "Plain text draft.",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse(
            { object: "newsletter", id: "nws_124", status: "draft" },
            { status: 201 },
          );
        }),
      },
    );

    expect(code).toBe(0);
    expect(await readJsonBody(captured?.init)).toEqual({
      audience_id: "aud_123",
      sender_identity_id: "nwsid_456",
      name: "Quick note",
      subject: "Hello",
      body_text: "Plain text draft.",
    });
  });

  test("rejects newsletter create without a body", async () => {
    const stderr = createOutput();

    const code = await runCli(
      [
        "newsletters",
        "create",
        "--audience-id",
        "aud_123",
        "--sender-identity-id",
        "nwsid_456",
        "--name",
        "Empty",
        "--subject",
        "No body",
      ],
      { stderr: stderr.out, env: { SHIPMAIL_API_KEY: "sm_test" } },
    );

    expect(code).toBe(1);
    expect(stderr.text()).toContain(
      "Provide at least one of --blocks, --body-html, --body-text, or --markdown.",
    );
  });

  test("updates newsletters through PATCH", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "newsletters",
        "update",
        "nws_789",
        "--subject",
        "Updated subject",
        "--feed-entry-url",
        "https://example.com/linked-post",
        "--styling-mode",
        "styled",
        "--track-engagement",
        "false",
        "--add-utm-tags",
        "false",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "newsletter", id: "nws_789", subject: "Updated subject" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/newsletters/nws_789");
    expect(captured?.init?.method).toBe("PATCH");
    expect(await readJsonBody(captured?.init)).toEqual({
      subject: "Updated subject",
      feed_entry_url: "https://example.com/linked-post",
      styling_mode: "styled",
      track_engagement: false,
      add_utm_tags: false,
    });
  });

  test("rejects invalid newsletter styling mode", async () => {
    const stderr = createOutput();

    const code = await runCli(["newsletters", "update", "nws_789", "--styling-mode", "minimal"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("--styling-mode must be styled or plain.");
  });

  test("sends the newsletter publish target on update", async () => {
    let captured: { url: URL; init: RequestInit | undefined } | undefined;

    const code = await runCli(["newsletters", "update", "nws_789", "--publish-target", "website"], {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({ object: "newsletter", id: "nws_789", status: "draft" });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/newsletters/nws_789");
    expect(await readJsonBody(captured?.init)).toEqual({ publish_target: "website" });
  });

  test("rejects an invalid newsletter publish target", async () => {
    const stderr = createOutput();

    const code = await runCli(["newsletters", "update", "nws_789", "--publish-target", "rss"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain(
      "--publish-target must be email_and_website, email or website.",
    );
  });

  test("rejects invalid newsletter track engagement", async () => {
    const stderr = createOutput();

    const code = await runCli(["newsletters", "update", "nws_789", "--track-engagement", "maybe"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("--track-engagement must be true or false.");
  });

  test("rejects invalid newsletter UTM tags", async () => {
    const stderr = createOutput();

    const code = await runCli(["newsletters", "update", "nws_789", "--add-utm-tags", "maybe"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("--add-utm-tags must be true or false.");
  });

  test("runs newsletter preflight", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(["newsletters", "preflight", "nws_789"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({ object: "newsletter_preflight", newsletter_id: "nws_789" });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/newsletters/nws_789/preflight");
    expect(captured?.init?.method).toBe("POST");
    expect(JSON.parse(stdout.text()).newsletter_id).toBe("nws_789");
  });

  test("sends newsletter tests", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      ["newsletters", "test-send", "nws_789", "--recipient-email", "owner@example.com"],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "newsletter_test_send", id: "nwstest_123" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/newsletters/nws_789/test-send");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({ recipient_email: "owner@example.com" });
  });

  test("schedules newsletters", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      ["newsletters", "schedule", "nws_789", "--scheduled-at", "2026-08-01T09:00:00.000Z"],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "newsletter", id: "nws_789", status: "scheduled" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/v1/newsletters/nws_789/schedule");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({
      scheduled_at: "2026-08-01T09:00:00.000Z",
    });
  });

  test("schedules to the most engaged readers and sends to more", async () => {
    const requests: CapturedRequest[] = [];
    const run = (args: readonly string[]) =>
      runCli([...args], {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          requests.push({ url: new URL(String(input)), init });
          return jsonResponse({ object: "newsletter", id: "nws_789", status: "sending" });
        }),
      });

    expect(
      await run([
        "newsletters",
        "schedule",
        "nws_789",
        "--scheduled-at",
        "2026-08-01T09:00:00.000Z",
        "--limit",
        "500",
      ]),
    ).toBe(0);
    expect(await run(["newsletters", "send-more", "nws_789", "--count", "1000"])).toBe(0);
    expect(await run(["newsletters", "send-more", "nws_789"])).toBe(0);
    expect(requests.map((request) => request.url.pathname)).toEqual([
      "/v1/newsletters/nws_789/schedule",
      "/v1/newsletters/nws_789/send-more",
      "/v1/newsletters/nws_789/send-more",
    ]);
    expect(await Promise.all(requests.map((request) => readJsonBody(request.init)))).toEqual([
      { scheduled_at: "2026-08-01T09:00:00.000Z", limit: 500 },
      { count: 1000 },
      {},
    ]);
  });

  test("sets a subject test and audience list cleanup", async () => {
    const requests: CapturedRequest[] = [];
    const run = (args: readonly string[]) =>
      runCli([...args], {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          requests.push({ url: new URL(String(input)), init });
          return jsonResponse({ object: "newsletter", id: "nws_789" });
        }),
      });

    expect(
      await run([
        "newsletters",
        "update",
        "nws_789",
        "--subject-b",
        "Another subject",
        "--subject-test-percent",
        "15",
      ]),
    ).toBe(0);
    expect(await run(["newsletters", "update", "nws_789", "--clear-subject-b"])).toBe(0);
    expect(
      await run([
        "audiences",
        "update",
        "aud_1",
        "--cleanup",
        "true",
        "--cleanup-inactive-days",
        "90",
      ]),
    ).toBe(0);
    expect(await Promise.all(requests.map((request) => readJsonBody(request.init)))).toEqual([
      { subject_b: "Another subject", subject_test_percent: 15 },
      { subject_b: null },
      { cleanup_enabled: true, cleanup_inactive_days: 90 },
    ]);
  });

  test("cancels and resumes newsletters", async () => {
    const stdout = createOutput();
    const paths: string[] = [];

    const firstCode = await runCli(["newsletters", "cancel", "nws_789"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async (input) => {
        paths.push(new URL(String(input)).pathname);
        return jsonResponse({ object: "newsletter", id: "nws_789", status: "cancelled" });
      }),
    });
    const secondCode = await runCli(["newsletters", "resume", "nws_789"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
      fetch: stubFetch(async (input) => {
        paths.push(new URL(String(input)).pathname);
        return jsonResponse({ object: "newsletter", id: "nws_789", status: "sending" });
      }),
    });

    expect(firstCode).toBe(0);
    expect(secondCode).toBe(0);
    expect(paths).toEqual(["/v1/newsletters/nws_789/cancel", "/v1/newsletters/nws_789/resume"]);
  });

  test("rejects newsletter update without fields", async () => {
    const stderr = createOutput();

    const code = await runCli(["newsletters", "update", "nws_789"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Provide at least one field to update.");
  });

  test("builds send message requests from flags", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "messages",
        "send",
        "--mailbox-id",
        "mbx_123",
        "--to",
        "user@example.com",
        "--cc",
        "ops@example.com,dev@example.com",
        "--subject",
        "Hello",
        "--text",
        "It works.",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_test", SHIPMAIL_BASE_URL: "https://api.shipmail.to/v1" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "message", id: "msg_123", status: "queued" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://api.shipmail.to/v1/messages");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({
      mailbox_id: "mbx_123",
      to: ["user@example.com"],
      cc: ["ops@example.com", "dev@example.com"],
      subject: "Hello",
      text: "It works.",
    });
    expect(JSON.parse(stdout.text())).toEqual({
      object: "message",
      id: "msg_123",
      status: "queued",
    });
  });

  test("creates a calendar event", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "calendar",
        "events",
        "create",
        "--mailbox",
        "hello@example.com",
        "--title",
        "Sync",
        "--start",
        "2026-08-01T14:00:00",
        "--timezone",
        "Europe/Paris",
        "--duration",
        "PT30M",
        "--invitation-language",
        "fr",
        "--operation-key",
        "calendar-create-0001",
        "--send-invitations",
        "false",
        "--reminders",
        '[{"minutes_before":15}]',
        "--attendees",
        '[{"email":"guest@example.com","name":"Guest"}]',
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "calendar_event", id: "evt_1" }, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/calendar/events");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({
      mailbox: "hello@example.com",
      operation_key: "calendar-create-0001",
      send_invitations: false,
      title: "Sync",
      start: "2026-08-01T14:00:00",
      timezone: "Europe/Paris",
      duration: "PT30M",
      invitation_language: "fr",
      reminders: [{ minutes_before: 15 }],
      attendees: [{ email: "guest@example.com", name: "Guest" }],
    });
    expect(JSON.parse(stdout.text()).id).toBe("evt_1");
  });

  test("gets, updates, and deletes calendar events with mailbox query", async () => {
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return jsonResponse({ object: "calendar_event", id: "evt_1" });
    });

    const getCode = await runCli(
      ["calendar", "events", "get", opaqueCalendarEventId, "--mailbox", "hello@example.com"],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch,
      },
    );
    const updateCode = await runCli(
      [
        "calendar",
        "events",
        "update",
        opaqueCalendarEventId,
        "--mailbox",
        "hello@example.com",
        "--location",
        "HQ",
        "--invitation-language",
        "es",
        "--operation-key",
        "calendar-update-0001",
        "--expected-revision",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "--send-guest-updates",
        "false",
      ],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch,
      },
    );
    const deleteStdout = createOutput();
    const deleteCode = await runCli(
      ["calendar", "events", "delete", opaqueCalendarEventId, "--mailbox", "hello@example.com"],
      {
        stdout: deleteStdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch,
      },
    );

    expect(getCode).toBe(0);
    expect(updateCode).toBe(0);
    expect(deleteCode).toBe(0);
    expect(requests[0]?.url.pathname).toBe("/api/v1/calendar/events/evt%3Aopaque.123");
    expect(requests[0]?.url.searchParams.get("mailbox")).toBe("hello@example.com");
    expect(requests[1]?.init?.method).toBe("PATCH");
    expect(requests[1]?.url.pathname).toBe("/api/v1/calendar/events/evt%3Aopaque.123");
    expect(await readJsonBody(requests[1]?.init)).toEqual({
      mailbox: "hello@example.com",
      operation_key: "calendar-update-0001",
      expected_revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      send_guest_updates: false,
      invitation_language: "es",
      location: "HQ",
    });
    expect(requests[2]?.init?.method).toBe("DELETE");
    expect(requests[2]?.url.pathname).toBe("/api/v1/calendar/events/evt%3Aopaque.123");
    expect(requests[2]?.url.searchParams.get("mailbox")).toBe("hello@example.com");
    expect(JSON.parse(deleteStdout.text())).toEqual({ ok: true, id: opaqueCalendarEventId });
  });

  test("lists calendar events with mailbox/from/to query", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "calendar",
        "events",
        "list",
        "--mailbox",
        "hello@example.com",
        "--from",
        "2026-08-01T00:00:00Z",
        "--to",
        "2026-08-08T00:00:00Z",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ data: [], pagination: { next_cursor: null, has_more: false } });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/api/v1/calendar/events");
    expect(captured?.url.searchParams.get("mailbox")).toBe("hello@example.com");
    expect(captured?.url.searchParams.get("from")).toBe("2026-08-01T00:00:00Z");
  });

  test("reads availability and joins days into a comma list", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "calendar",
        "availability",
        "--mailbox",
        "hello@example.com",
        "--from",
        "2026-08-03T00:00:00Z",
        "--to",
        "2026-08-04T00:00:00Z",
        "--duration",
        "30",
        "--days",
        "1,3,5",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({
            object: "calendar_availability",
            mailbox: "hello@example.com",
            from: "2026-08-03T00:00:00Z",
            to: "2026-08-04T00:00:00Z",
            duration_minutes: 30,
            timezone: "Etc/UTC",
            slots: [],
          });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.pathname).toBe("/api/v1/calendar/availability");
    expect(captured?.url.searchParams.get("days")).toBe("1,3,5");
    expect(captured?.url.searchParams.get("duration")).toBe("30");
  });

  test("creates a booking page", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "booking-pages",
        "create",
        "--name",
        "Intro",
        "--mailbox",
        "hello@example.com",
        "--slug",
        "intro",
        "--duration-minutes",
        "30",
        "--availability-days",
        "1,2,3,4,5",
        "--window-start-minutes",
        "540",
        "--window-end-minutes",
        "1020",
        "--timezone",
        "America/New_York",
        "--conferencing-provider",
        "google_meet",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "booking_page", id: "bkp_1" }, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/booking-pages");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({
      name: "Intro",
      mailbox: "hello@example.com",
      slug: "intro",
      duration_minutes: 30,
      availability_days: [1, 2, 3, 4, 5],
      window_start_minutes: 540,
      window_end_minutes: 1020,
      timezone: "America/New_York",
      conferencing_provider: "google_meet",
    });
    expect(JSON.parse(stdout.text()).id).toBe("bkp_1");
  });

  test("lists, gets, and updates booking pages", async () => {
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      if (init?.method === "PATCH") {
        return jsonResponse({ object: "booking_page", id: "bkp_1", active: false });
      }
      return jsonResponse({
        data: [{ object: "booking_page", id: "bkp_1" }],
        pagination: { next_cursor: null, has_more: false },
      });
    });

    const listCode = await runCli(["booking-pages", "list", "--limit", "10", "--cursor", "cur_1"], {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch,
    });
    const getCode = await runCli(["booking-pages", "get", "bkp_1"], {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch,
    });
    const updateCode = await runCli(
      ["booking-pages", "update", "bkp_1", "--active", "false", "--conferencing-provider", "none"],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch,
      },
    );

    expect(listCode).toBe(0);
    expect(getCode).toBe(0);
    expect(updateCode).toBe(0);
    expect(requests[0]?.url.pathname).toBe("/api/v1/booking-pages");
    expect(requests[0]?.url.searchParams.get("limit")).toBe("10");
    expect(requests[0]?.url.searchParams.get("cursor")).toBe("cur_1");
    expect(requests[1]?.url.pathname).toBe("/api/v1/booking-pages/bkp_1");
    expect(requests[1]?.init?.method).toBe("GET");
    expect(requests[2]?.init?.method).toBe("PATCH");
    expect(await readJsonBody(requests[2]?.init)).toEqual({
      conferencing_provider: null,
      active: false,
    });
  });

  test("deletes a booking page", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(["booking-pages", "delete", "bkp_1"], {
      stdout: stdout.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return new Response(null, { status: 204 });
      }),
    });

    expect(code).toBe(0);
    expect(captured?.init?.method).toBe("DELETE");
    expect(captured?.url.pathname).toBe("/api/v1/booking-pages/bkp_1");
    expect(JSON.parse(stdout.text())).toEqual({ ok: true, id: "bkp_1" });
  });

  test("creates a one-off booking link with ranges and unlimited bookings", async () => {
    const stdout = createOutput();
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "booking-links",
        "create",
        "--name",
        "Call with Sam",
        "--mailbox",
        "hello@example.com",
        "--duration-minutes",
        "30",
        "--timezone",
        "Europe/Lisbon",
        "--range",
        "2026-11-02T09:00:00Z/2026-11-02T12:00:00Z",
        "--range",
        "2026-11-03T09:00:00Z/2026-11-03T10:00:00Z",
        "--max-bookings",
        "unlimited",
        "--expires-at",
        "2026-11-10T00:00:00Z",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "booking_link", id: "bkp_link" }, { status: 201 });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.url.href).toBe("https://shipmail.to/api/v1/booking-links");
    expect(captured?.init?.method).toBe("POST");
    expect(await readJsonBody(captured?.init)).toEqual({
      name: "Call with Sam",
      mailbox: "hello@example.com",
      duration_minutes: 30,
      timezone: "Europe/Lisbon",
      offered_ranges: [
        { start: "2026-11-02T09:00:00Z", end: "2026-11-02T12:00:00Z" },
        { start: "2026-11-03T09:00:00Z", end: "2026-11-03T10:00:00Z" },
      ],
      max_bookings: null,
      expires_at: "2026-11-10T00:00:00Z",
    });
    expect(JSON.parse(stdout.text()).id).toBe("bkp_link");
  });

  test("rejects a malformed booking link range", async () => {
    const stderr = createOutput();
    const code = await runCli(
      [
        "booking-links",
        "create",
        "--name",
        "Call",
        "--mailbox",
        "hello@example.com",
        "--duration-minutes",
        "30",
        "--timezone",
        "Europe/Lisbon",
        "--range",
        "2026-11-02T09:00:00Z",
      ],
      {
        stdout: createOutput().out,
        stderr: stderr.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async () => jsonResponse({})),
      },
    );
    expect(code).not.toBe(0);
    expect(stderr.text()).toContain("--range must be <start>/<end>");
  });

  test("lists, gets, updates, and revokes booking links", async () => {
    const requests: CapturedRequest[] = [];
    const fetch = stubFetch(async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      if (init?.method === "GET" && new URL(String(input)).pathname.endsWith("booking-links")) {
        return jsonResponse({
          data: [{ object: "booking_link", id: "bkp_link" }],
          pagination: { next_cursor: null, has_more: false },
        });
      }
      return jsonResponse({ object: "booking_link", id: "bkp_link" });
    });
    const run = (args: string[]): Promise<number> =>
      runCli(args, {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch,
      });

    expect(await run(["booking-links", "list", "--status", "open", "--limit", "10"])).toBe(0);
    expect(await run(["booking-links", "get", "bkp_link"])).toBe(0);
    expect(
      await run([
        "booking-links",
        "update",
        "bkp_link",
        "--range",
        "none",
        "--source-page",
        "bkp_page",
        "--max-bookings",
        "3",
        "--expires-at",
        "none",
      ]),
    ).toBe(0);
    expect(await run(["booking-links", "revoke", "bkp_link"])).toBe(0);

    expect(requests[0]?.url.pathname).toBe("/api/v1/booking-links");
    expect(requests[0]?.url.searchParams.get("status")).toBe("open");
    expect(requests[0]?.url.searchParams.get("limit")).toBe("10");
    expect(requests[1]?.url.pathname).toBe("/api/v1/booking-links/bkp_link");
    expect(requests[1]?.init?.method).toBe("GET");
    expect(requests[2]?.init?.method).toBe("PATCH");
    expect(await readJsonBody(requests[2]?.init)).toEqual({
      offered_ranges: null,
      source_page_id: "bkp_page",
      max_bookings: 3,
      expires_at: null,
    });
    expect(requests[3]?.init?.method).toBe("POST");
    expect(requests[3]?.url.pathname).toBe("/api/v1/booking-links/bkp_link/revoke");
  });

  test("rejects an unknown booking link status", async () => {
    const code = await runCli(["booking-links", "list", "--status", "used"], {
      stdout: createOutput().out,
      stderr: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async () => jsonResponse({})),
    });
    expect(code).not.toBe(0);
  });

  test("creates a webhook with an authorization header value", async () => {
    let captured: CapturedRequest | undefined;
    const stdout = createOutput();

    const code = await runCli(
      [
        "webhooks",
        "create",
        "--url",
        "https://example.com/hook",
        "--events",
        "message.received",
        "--authorization",
        "Bearer key_123",
      ],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "webhook", id: "whk_123", has_authorization: true });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.init?.method).toBe("POST");
    expect(JSON.parse(String(captured?.init?.body))).toEqual({
      url: "https://example.com/hook",
      events: ["message.received"],
      authorization: "Bearer key_123",
    });
    expect(JSON.parse(stdout.text()).has_authorization).toBe(true);
  });

  test("replaces a webhook authorization", async () => {
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      ["webhooks", "update", "whk_123", "--authorization", "Bearer key_456"],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "webhook", id: "whk_123", has_authorization: true });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.init?.method).toBe("PATCH");
    expect(captured?.url.pathname).toBe("/api/v1/webhooks/whk_123");
    expect(JSON.parse(String(captured?.init?.body))).toEqual({ authorization: "Bearer key_456" });
  });

  test("clears a webhook authorization", async () => {
    let captured: CapturedRequest | undefined;

    const code = await runCli(["webhooks", "update", "whk_123", "--clear-authorization"], {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (input, init) => {
        captured = { url: new URL(String(input)), init };
        return jsonResponse({ object: "webhook", id: "whk_123", has_authorization: false });
      }),
    });

    expect(code).toBe(0);
    expect(JSON.parse(String(captured?.init?.body))).toEqual({ authorization: null });
  });

  test("rejects --authorization with --clear-authorization", async () => {
    const stderr = createOutput();

    const code = await runCli(
      ["webhooks", "update", "whk_123", "--authorization", "Bearer key", "--clear-authorization"],
      { stderr: stderr.out, env: { SHIPMAIL_API_KEY: "sm_live_test" } },
    );

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Use --authorization or --clear-authorization, not both.");
  });

  test("creates a webhook with a Standard Webhooks secret", async () => {
    let captured: CapturedRequest | undefined;

    const code = await runCli(
      [
        "webhooks",
        "create",
        "--url",
        "https://example.com/hook",
        "--events",
        "message.received",
        "--standard-webhooks-secret",
        "whsec_abc",
      ],
      {
        stdout: createOutput().out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({ object: "webhook", id: "whk_123" });
        }),
      },
    );

    expect(code).toBe(0);
    expect(JSON.parse(String(captured?.init?.body))).toEqual({
      url: "https://example.com/hook",
      events: ["message.received"],
      standard_webhooks_secret: "whsec_abc",
    });
  });

  test("turns webhook reply text on at creation and off on update", async () => {
    const bodies: unknown[] = [];
    const options = {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ object: "webhook", id: "whk_123" });
      }),
    };

    expect(
      await runCli(
        [
          "webhooks",
          "create",
          "--url",
          "https://example.com/hook",
          "--events",
          "message.received",
          "--include-reply-text",
        ],
        options,
      ),
    ).toBe(0);
    expect(
      await runCli(["webhooks", "update", "whk_123", "--include-reply-text", "false"], options),
    ).toBe(0);
    expect(bodies).toEqual([
      {
        url: "https://example.com/hook",
        events: ["message.received"],
        include_reply_text: true,
      },
      { include_reply_text: false },
    ]);
  });

  test("limits a webhook to authenticated senders and lifts the limit", async () => {
    const bodies: unknown[] = [];
    const options = {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ object: "webhook", id: "whk_123" });
      }),
    };

    expect(
      await runCli(
        [
          "webhooks",
          "create",
          "--url",
          "https://example.com/hook",
          "--events",
          "message.received",
          "--authenticated-senders-only",
        ],
        options,
      ),
    ).toBe(0);
    expect(
      await runCli(
        ["webhooks", "update", "whk_123", "--authenticated-senders-only", "false"],
        options,
      ),
    ).toBe(0);
    expect(bodies).toEqual([
      {
        url: "https://example.com/hook",
        events: ["message.received"],
        authenticated_senders_only: true,
      },
      { authenticated_senders_only: false },
    ]);
  });

  test("sets, replaces and clears webhook allowed senders", async () => {
    const bodies: unknown[] = [];
    const options = {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ object: "webhook", id: "whk_123" });
      }),
    };

    expect(
      await runCli(
        [
          "webhooks",
          "create",
          "--url",
          "https://example.com/hook",
          "--events",
          "message.received",
          "--allowed-sender",
          "jane@customer.com",
          "--allowed-sender",
          "customer.org",
        ],
        options,
      ),
    ).toBe(0);
    expect(
      await runCli(["webhooks", "update", "whk_123", "--allowed-sender", "acme.com"], options),
    ).toBe(0);
    expect(
      await runCli(["webhooks", "update", "whk_123", "--clear-allowed-senders"], options),
    ).toBe(0);
    expect(bodies).toEqual([
      {
        url: "https://example.com/hook",
        events: ["message.received"],
        allowed_senders: ["jane@customer.com", "customer.org"],
      },
      { allowed_senders: ["acme.com"] },
      { allowed_senders: null },
    ]);
  });

  test("rejects --allowed-sender with --clear-allowed-senders", async () => {
    const stderr = createOutput();

    const code = await runCli(
      ["webhooks", "update", "whk_123", "--allowed-sender", "acme.com", "--clear-allowed-senders"],
      { stderr: stderr.out, env: { SHIPMAIL_API_KEY: "sm_live_test" } },
    );

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Use --allowed-sender or --clear-allowed-senders, not both.");
  });

  test("replaces and clears a webhook Standard Webhooks secret", async () => {
    const bodies: unknown[] = [];
    const options = {
      stdout: createOutput().out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
      fetch: stubFetch(async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ object: "webhook", id: "whk_123" });
      }),
    };

    expect(
      await runCli(
        ["webhooks", "update", "whk_123", "--standard-webhooks-secret", "whsec_abc"],
        options,
      ),
    ).toBe(0);
    expect(
      await runCli(["webhooks", "update", "whk_123", "--clear-standard-webhooks-secret"], options),
    ).toBe(0);
    expect(bodies).toEqual([
      { standard_webhooks_secret: "whsec_abc" },
      { standard_webhooks_secret: null },
    ]);
  });

  test("rejects --standard-webhooks-secret with --clear-standard-webhooks-secret", async () => {
    const stderr = createOutput();

    const code = await runCli(
      [
        "webhooks",
        "update",
        "whk_123",
        "--standard-webhooks-secret",
        "whsec_abc",
        "--clear-standard-webhooks-secret",
      ],
      { stderr: stderr.out, env: { SHIPMAIL_API_KEY: "sm_live_test" } },
    );

    expect(code).toBe(1);
    expect(stderr.text()).toContain(
      "Use --standard-webhooks-secret or --clear-standard-webhooks-secret, not both.",
    );
  });

  test("rejects a webhook update without options", async () => {
    const stderr = createOutput();

    const code = await runCli(["webhooks", "update", "whk_123"], {
      stderr: stderr.out,
      env: { SHIPMAIL_API_KEY: "sm_live_test" },
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Nothing to update.");
  });

  test("replays a webhook delivery with an idempotency key", async () => {
    let captured: CapturedRequest | undefined;
    const stdout = createOutput();

    const code = await runCli(
      ["webhooks", "replay-delivery", "whk_123", "dlv_123", "--idempotency-key", "replay-123"],
      {
        stdout: stdout.out,
        env: { SHIPMAIL_API_KEY: "sm_live_test" },
        fetch: stubFetch(async (input, init) => {
          captured = { url: new URL(String(input)), init };
          return jsonResponse({
            object: "webhook_delivery",
            id: "dlv_replay",
            replayed_from_delivery_id: "dlv_123",
          });
        }),
      },
    );

    expect(code).toBe(0);
    expect(captured?.init?.method).toBe("POST");
    expect(captured?.url.pathname).toBe("/api/v1/webhooks/whk_123/deliveries/dlv_123/replay");
    expect(new Headers(captured?.init?.headers).get("idempotency-key")).toBe("replay-123");
    expect(JSON.parse(stdout.text()).id).toBe("dlv_replay");
  });
});
