import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../client.js";

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

function captureUrl(): { url: () => string; handler: (input: string | URL | Request) => Response } {
  let captured = "";
  return {
    url: () => captured,
    handler: (input) => {
      captured = String(input);
      return new Response(null, { status: 204 });
    },
  };
}

// Defense-in-depth: even if upstream callers (eg the MCP server) failed to
// validate ids, the SDK must encode interpolated path segments so attacker-
// controlled values cannot break out of the resource path or smuggle query
// strings into it.
describe("URL path encoding (defense-in-depth)", () => {
  test("domains.get encodes id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.domains.get("dom abc/../escape?evil=1").catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.pathname).toBe("/v1/domains/dom%20abc%2F..%2Fescape%3Fevil%3D1");
    expect(url.search).toBe("");
  });

  test("domains.delete encodes id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.domains.delete("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/domains/a%2Fb");
  });

  test("domains.getDnsRecords encodes id and preserves /dns-records suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.domains.getDnsRecords("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/domains/a%2Fb/dns-records");
  });

  test("domains.getHealth encodes id and preserves /health suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.domains.getHealth("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/domains/a%2Fb/health");
  });

  test("domains.verify encodes id and preserves /verification suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.domains.verify("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/domains/a%2Fb/verification");
  });

  test("mailboxes.get encodes id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes.get("a?b").catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.pathname).toBe("/v1/mailboxes/a%3Fb");
    expect(url.search).toBe("");
  });

  test("mailboxes.updateAutoReply encodes id and preserves suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes.updateAutoReply("a/b", { enabled: false }).catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/mailboxes/a%2Fb/auto-reply");
  });

  test("mailboxes.resetPassword encodes id and preserves suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes
      .resetPassword("a/b", { password: "NewPassword1" })
      .catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/mailboxes/a%2Fb/password");
  });

  test("mailboxes forwarding methods encode path IDs", async () => {
    const list = captureUrl();
    const listClient = createClient(list.handler);
    await listClient.mailboxes.listForwarding("a/b").catch(() => undefined);
    expect(new URL(list.url()).pathname).toBe("/v1/mailboxes/a%2Fb/forwarding");

    const remove = captureUrl();
    const removeClient = createClient(remove.handler);
    await removeClient.mailboxes.deleteForwarding("a/b", "fwd/a").catch(() => undefined);
    expect(new URL(remove.url()).pathname).toBe("/v1/mailboxes/a%2Fb/forwarding/fwd%2Fa");
  });

  test("mailboxes.listFolders encodes id and preserves suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes.listFolders("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/mailboxes/a%2Fb/folders");
  });

  test("mailboxes.getRules encodes id and preserves suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes.getRules("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/mailboxes/a%2Fb/rules");
  });

  test("mailboxes.createFolder encodes id and preserves suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes
      .createFolder("a/b", { name: "VIP", parent_id: null })
      .catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/mailboxes/a%2Fb/folders");
  });

  test("mailboxes.updateFolder encodes id and folder id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes
      .updateFolder("a/b", "folder/../evil?x=1", { name: "VIP" })
      .catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.pathname).toBe("/v1/mailboxes/a%2Fb/folders/folder%2F..%2Fevil%3Fx%3D1");
    expect(url.search).toBe("");
  });

  test("mailboxes.deleteFolder encodes id and folder id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes.deleteFolder("a/b", "folder#frag").catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.pathname).toBe("/v1/mailboxes/a%2Fb/folders/folder%23frag");
    expect(url.hash).toBe("");
  });

  test("mailboxes.listIdentities encodes id and preserves suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes.listIdentities("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/mailboxes/a%2Fb/identities");
  });

  test("mailboxes.listInboxMessages encodes id and preserves suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes.listInboxMessages("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/mailboxes/a%2Fb/inbox/messages");
  });

  test("mailboxes.getInboxThread encodes id and thread id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes.getInboxThread("a/b", "thread/../evil?x=1").catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.pathname).toBe("/v1/mailboxes/a%2Fb/inbox/threads/thread%2F..%2Fevil%3Fx%3D1");
    expect(url.search).toBe("");
  });

  test("mailboxes.downloadInboxAttachment keeps blob id in query", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes
      .downloadInboxAttachment("a/b", { blob_id: "blob/../x?y=1", name: "a b.pdf" })
      .catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.pathname).toBe("/v1/mailboxes/a%2Fb/inbox/attachments");
    expect(url.searchParams.get("blob_id")).toBe("blob/../x?y=1");
    expect(url.searchParams.get("name")).toBe("a b.pdf");
  });

  test("mailboxes.updateInboxMessage encodes id and message id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes
      .updateInboxMessage("a/b", "message/../evil?x=1", { read: true })
      .catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.pathname).toBe("/v1/mailboxes/a%2Fb/inbox/messages/message%2F..%2Fevil%3Fx%3D1");
    expect(url.search).toBe("");
  });

  test("mailboxes.moveInboxMessage encodes id and message id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes
      .moveInboxMessage("a/b", "message#frag", { target_role: "archive" })
      .catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.pathname).toBe("/v1/mailboxes/a%2Fb/inbox/messages/message%23frag/move");
    expect(url.hash).toBe("");
  });

  test("mailboxes.deleteInboxMessage encodes id and message id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes.deleteInboxMessage("a/b", "message/../evil").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe(
      "/v1/mailboxes/a%2Fb/inbox/messages/message%2F..%2Fevil",
    );
  });

  test("mailboxes.replyToInboxMessage encodes mailbox and JMAP message IDs", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes
      .replyToInboxMessage("a/b", "message/../evil?x=1", {
        to: ["x@y.com"],
        text: "hi",
      })
      .catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe(
      "/v1/mailboxes/a%2Fb/inbox/messages/message%2F..%2Fevil%3Fx%3D1/reply",
    );
  });

  test("mailboxes.replyToInboxThread encodes mailbox and JMAP thread IDs", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.mailboxes
      .replyToInboxThread("a/b", "thread#frag", { to: ["x@y.com"], text: "hi" })
      .catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe(
      "/v1/mailboxes/a%2Fb/inbox/threads/thread%23frag/reply",
    );
  });

  test("messages.get encodes id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.messages.get("../suppressions/victim").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/messages/..%2Fsuppressions%2Fvictim");
  });

  test("members.get encodes id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.members.get("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/members/a%2Fb");
  });

  test("messages.reply encodes id and preserves /reply suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.messages.reply("a/b", { to: ["x@y.com"], text: "hi" }).catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/messages/a%2Fb/reply");
  });

  test("threads.get encodes id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.threads.get("a/b", { mailbox_id: "mbx_123" }).catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/threads/a%2Fb");
  });

  test("threads.reply encodes id and preserves /reply suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.threads
      .reply("a/b", { mailbox_id: "mbx_123", to: ["x@y.com"], text: "hi" })
      .catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/threads/a%2Fb/reply");
  });

  test("webhooks.get encodes id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.webhooks.get("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/webhooks/a%2Fb");
  });

  test("webhooks.update encodes id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.webhooks.update("a/b", { active: false }).catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/webhooks/a%2Fb");
  });

  test("webhooks.delete encodes id", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.webhooks.delete("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/webhooks/a%2Fb");
  });

  test("webhooks.rotateSecret encodes id and preserves /rotate-secret suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.webhooks.rotateSecret("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/webhooks/a%2Fb/rotate-secret");
  });

  test("webhooks.test encodes id and preserves /test suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.webhooks.test("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/webhooks/a%2Fb/test");
  });

  test("webhooks.listDeliveries encodes id and preserves /deliveries suffix", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.webhooks.listDeliveries("a/b").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/webhooks/a%2Fb/deliveries");
  });

  test("suppressions.remove encodes email", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.suppressions.remove("user+tag@example.com/extra").catch(() => undefined);
    expect(new URL(cap.url()).pathname).toBe("/v1/suppressions/user%2Btag%40example.com%2Fextra");
  });

  test("interpolated id cannot smuggle a query string", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.domains.get("legit?force_admin=1").catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.search).toBe("");
    expect(url.searchParams.has("force_admin")).toBe(false);
  });

  test("interpolated id cannot smuggle a fragment", async () => {
    const cap = captureUrl();
    const client = createClient(cap.handler);
    await client.domains.get("legit#frag").catch(() => undefined);
    const url = new URL(cap.url());
    expect(url.hash).toBe("");
  });
});
