# Shipmail TypeScript SDK

[![npm version](https://img.shields.io/npm/v/shipmail.svg)](https://www.npmjs.com/package/shipmail)
[![npm downloads](https://img.shields.io/npm/dm/shipmail.svg)](https://www.npmjs.com/package/shipmail)
[![bundle size](https://img.shields.io/bundlephobia/minzip/shipmail.svg)](https://bundlephobia.com/package/shipmail)
[![types](https://img.shields.io/npm/types/shipmail.svg)](https://www.npmjs.com/package/shipmail)
[![license](https://img.shields.io/npm/l/shipmail.svg)](./LICENSE)

Official TypeScript SDK for the [Shipmail](https://shipmail.to) API. Zero runtime dependencies. Native `fetch`. Full TypeScript types. ESM and CommonJS.

**Runtimes**: Node.js 18+, Bun, Deno. Webhook verification uses `node:crypto` (enable `nodejs_compat` on Cloudflare Workers if you verify webhooks there).

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Domains](#domains)
- [Mailboxes](#mailboxes)
- [Messages](#messages)
- [Scheduled messages and attachments](#scheduled-messages-and-attachments)
- [Sandbox](#sandbox)
- [Threads](#threads)
- [Reply scans](#reply-scans)
- [Webhooks](#webhooks)
- [Suppressions](#suppressions)
- [Audiences](#audiences)
- [Newsletters](#newsletters)
- [Status](#status)
- [Pagination](#pagination)
- [Webhook verification](#webhook-verification)
- [Per-request options](#per-request-options)
- [Idempotency](#idempotency)
- [Cancellation](#cancellation)
- [Custom fetch and proxies](#custom-fetch-and-proxies)
- [Errors](#errors)
- [Retries](#retries)
- [Bundling](#bundling)
- [Testing](#testing)
- [License](#license)
- [Links](#links)

## Install

```bash
bun add shipmail
# or
npm install shipmail
# or
pnpm add shipmail
```

## Quick start

```ts
import { ShipmailClient } from "shipmail";

const shipmail = new ShipmailClient({ apiKey: process.env.SHIPMAIL_API_KEY! });

const message = await shipmail.messages.send({
  mailbox_id: "mbx_...",
  to: [{ address: "user@example.com", name: "User" }],
  subject: "Hello",
  text: "Hi there",
  html: "<p>Hi there</p>",
  client_reference: "crm-123",
  metadata: { campaign: "onboarding" },
  source_rfc_message_id: "<crm-123@example.com>",
});

const sameMessage = await shipmail.messages.list({ client_reference: "crm-123" });
```

The SDK does not auto-read environment variables. Pass the key explicitly.

You can also pass a key string directly:

```ts
const shipmail = new ShipmailClient("sm_live_...");
```

## Configuration

```ts
const shipmail = new ShipmailClient({
  apiKey: process.env.SHIPMAIL_API_KEY!,
  baseUrl: "https://shipmail.to/api/v1",
  maxRetries: 2,
  timeout: 30_000,
  fetch: customFetch,
  defaultHeaders: { "x-app-name": "my-app" },
});
```

| Option           | Type                     | Default                      | Description                                                         |
| ---------------- | ------------------------ | ---------------------------- | ------------------------------------------------------------------- |
| `apiKey`         | `string`                 | required                     | Shipmail API key (`sm_live_...`).                                   |
| `baseUrl`        | `string`                 | `https://shipmail.to/api/v1` | API base URL.                                                       |
| `maxRetries`     | `number`                 | `2`                          | Retry count for eligible requests. Up to `maxRetries + 1` attempts. |
| `timeout`        | `number`                 | `30_000`                     | Per-request timeout in ms.                                          |
| `fetch`          | `typeof fetch`           | `globalThis.fetch`           | Custom fetch implementation.                                        |
| `defaultHeaders` | `Record<string, string>` | `{}`                         | Headers added to every request.                                     |

## Domains

```ts
await shipmail.domains.create({ name: "example.com" });
await shipmail.domains.list({ limit: 10 });
await shipmail.domains.get("dom_...");
await shipmail.domains.getDnsRecords("dom_...");
await shipmail.domains.getHealth("dom_...");
await shipmail.domains.update("dom_...", { catch_all_mailbox_id: "mbx_..." });
await shipmail.domains.delete("dom_...");
await shipmail.domains.verify("dom_...");
await shipmail.domains.search({ keyword: "example" });
await shipmail.domains.register({
  name: "example.com",
  years: 1,
  contact: {
    first_name: "Jane",
    last_name: "Doe",
    address1: "1 Main St",
    /* ... */
  },
});
```

## Mailboxes

```ts
await shipmail.mailboxes.create({
  domain_id: "dom_...",
  address: "hello",
  password: "StrongPass123",
  display_name: "Hello",
});
await shipmail.mailboxes.list({ domain_id: "dom_..." });
await shipmail.mailboxes.get("mbx_...");
await shipmail.mailboxes.update("mbx_...", { display_name: "New Name" });
await shipmail.mailboxes.suspend("mbx_...");
await shipmail.mailboxes.resume("mbx_...");
await shipmail.mailboxes.resetPassword("mbx_...", { password: "NewPassword1" });
const forwarding = await shipmail.mailboxes.createForwarding("mbx_...", {
  destination: "owner@example.net",
  recipient: "support@example.com",
});
const forwardingList = await shipmail.mailboxes.listForwarding("mbx_...");
await shipmail.mailboxes.deleteForwarding("mbx_...", forwarding.id);
const appPassword = await shipmail.mailboxes.createAppPassword("mbx_...", {
  name: "Desktop mail",
  expires_at: "2026-10-01T00:00:00Z",
});
const appPasswords = await shipmail.mailboxes.listAppPasswords("mbx_...");
await shipmail.mailboxes.revokeAppPassword("mbx_...", appPassword.id);
const folders = await shipmail.mailboxes.listFolders("mbx_...");
const folder = await shipmail.mailboxes.createFolder("mbx_...", {
  name: "VIP",
  parent_id: null,
});
await shipmail.mailboxes.updateFolder("mbx_...", folder.id, { name: "VIP Clients" });
await shipmail.mailboxes.deleteFolder("mbx_...", folder.id);
const identities = await shipmail.mailboxes.listIdentities("mbx_...");
const currentRules = await shipmail.mailboxes.getRules("mbx_...");
const updatedRules = await shipmail.mailboxes.updateRules("mbx_...", {
  rules: [
    ...currentRules.rules,
    {
      id: crypto.randomUUID(),
      name: "Flag invoices",
      enabled: true,
      position: currentRules.rules.length,
      match_mode: "all",
      stop: false,
      conditions: [{ type: "subject_contains", value: "invoice" }],
      actions: [{ type: "star" }, { type: "send_webhook" }],
    },
  ],
});
await shipmail.mailboxes.delete("mbx_...");

await shipmail.mailboxes.updateAutoReply("mbx_...", {
  enabled: true,
  subject: "Out of office",
  body: "Back on Monday.",
  from_date: "2026-06-01",
  to_date: "2026-06-07",
});

const mailboxId = "550e8400-e29b-41d4-a716-446655440000";
const inbox = await shipmail.mailboxes.listInboxMessages(mailboxId, {
  after: "2025-07-20T00:00:00.000Z",
  before: "2026-07-20T00:00:00.000Z",
  limit: 50,
});
const invoices = await shipmail.mailboxes.listInboxMessages(mailboxId, {
  from: "billing@vendor.example",
  subject: "invoice",
  has_attachment: true,
});
const exact = await shipmail.mailboxes.getInboxMessage(mailboxId, inbox.data[0].id);

// Changing API-agent hold requires both mailboxes:write and messages:review.
await shipmail.mailboxes.update(mailboxId, { agent_security_hold: true });
// Use a separate securityReview credential to inspect and release the exact snapshot.
const reviewer = new ShipmailClient({ apiKey: process.env.SHIPMAIL_REVIEW_API_KEY! });
const reviewed = await reviewer.mailboxes.getInboxMessage(mailboxId, exact.id);
await reviewer.mailboxes.releaseInboxMessageSecurity(mailboxId, reviewed.id, {
  decision: "release",
  reason: "Reviewed against the customer request",
  expected_content_sha256: reviewed.security.content_sha256,
});

const queue = await shipmail.mailboxes.listInboxThreads(mailboxId, {
  attention_state: "needs_reply",
  after: "2025-07-20T00:00:00.000Z",
});
const candidate = queue.data[0];
// `conversation_id` is the ID to store. `thread_id` is deprecated: it still works and its
// value is unchanged, but the mail server can re-thread it when conversations merge.
const draft = await shipmail.mailboxes.createInboxReplyDraft(mailboxId, candidate.conversation_id, {
  text: "Thanks for the note.",
  expected_version: candidate.version,
});
// `removed_formatting` lists what the HTML sanitiser dropped, such as "table" or "h4".
console.log(draft.removed_formatting);

// Read and revise a draft before sending. The new body replaces the old one.
await shipmail.mailboxes.listInboxReplyDrafts(mailboxId, candidate.conversation_id);
await shipmail.mailboxes.getInboxReplyDraft(mailboxId, candidate.conversation_id, draft.id);
await shipmail.mailboxes.updateInboxReplyDraft(mailboxId, candidate.conversation_id, draft.id, {
  html: "<p>Thanks for the note.</p><p>I will send the contract today.</p>",
});

// Read and approve the final snapshot. Any later subject/body edit fails with 409.
const approved = await shipmail.mailboxes.getInboxReplyDraft(
  mailboxId,
  candidate.conversation_id,
  draft.id,
);
if (!approved.content_sha256) throw new Error("Draft content is incomplete; read it again.");
await shipmail.mailboxes.sendInboxReplyDraft(mailboxId, candidate.conversation_id, draft.id, {
  expectedContentSha256: approved.content_sha256,
});

// Or discard it. Drafts that are sending or sent cannot be deleted.
// await shipmail.mailboxes.deleteInboxReplyDraft(mailboxId, candidate.conversation_id, draft.id);

// A full thread read carries `version` too: pass it as `expected_version`.
const thread = await shipmail.mailboxes.getInboxThread(mailboxId, candidate.conversation_id);
console.log(thread.version);

// Save a new message to Drafts for a person to review and send. This never sends.
const newDraft = await shipmail.mailboxes.createInboxDraft(mailboxId, {
  to: ["jane@example.com"],
  subject: "Quick intro",
  text: "Hi Jane,",
});
```

## Messages

```ts
await shipmail.messages.send({
  mailbox_id: "mbx_...",
  to: [{ address: "user@example.com" }],
  cc: [{ address: "cc@example.com" }],
  subject: "Hello",
  text: "Hi there",
  html: "<p>Hi there</p>",
});

await shipmail.messages.list({ mailbox_id: "mbx_...", limit: 25 });
const analytics = await shipmail.messages.listAnalytics({
  updated_after: "2026-07-01T00:00:00.000Z",
  limit: 100,
});
// Follow analytics.pagination.next_cursor, then persist analytics.pagination.snapshot_at.
await shipmail.messages.get("msg_...");

await shipmail.messages.reply("msg_...", {
  to: [{ address: "user@example.com" }],
  text: "Thanks for your email.",
});
```

## Scheduled messages and attachments

Stage raw files up to 25 MB, then reference their opaque IDs from send or scheduled-update calls.
The older base64 `attachments` field still works, but staged IDs avoid putting file bytes in JSON.

```ts
const bytes = await Bun.file("./invoice.pdf").arrayBuffer();
const attachment = await shipmail.mailboxes.stageAttachment("mbx_...", {
  filename: "invoice.pdf",
  content_type: "application/pdf",
  data: bytes,
});

const scheduled = await shipmail.messages.send({
  mailbox_id: "mbx_...",
  to: ["customer@example.com"],
  subject: "Invoice",
  text: "Attached.",
  staged_attachment_ids: [attachment.id],
  scheduled_at: "2026-08-01T08:00:00.000Z",
});

const pending = await shipmail.scheduledMessages.list();
const detail = await shipmail.scheduledMessages.get(scheduled.id);
await shipmail.scheduledMessages.update(scheduled.id, {
  to: detail.to,
  subject: detail.subject,
  text: detail.text ?? "",
  staged_attachment_ids: [attachment.id],
  scheduled_at: "2026-08-02T08:00:00.000Z",
});
await shipmail.scheduledMessages.cancel(scheduled.id);
```

Staged IDs expire after 24 hours and are bound to the API key, organization, mailbox, and file
metadata that created them.

For browser-hosted components that must keep the Shipmail API key off the page, prepare a
five-minute, single-use upload URL:

```ts
const prepared = await shipmail.mailboxes.prepareStagedAttachmentUpload("mbx_...", {
  filename: "invoice.pdf",
  content_type: "application/pdf",
  size: bytes.byteLength,
  sha256: "<lowercase SHA-256 of the exact bytes>",
});

await fetch(prepared.upload_url, {
  method: "POST",
  body: bytes,
  headers: { "Content-Type": prepared.content_type },
  credentials: "omit",
  redirect: "error",
});
```

The upload succeeds only when filename, MIME type, byte size, and digest match the preparation
request. The returned upload URL is a secret and cannot be replayed after a successful upload.

## Sandbox

Create a test API key (`sm_test_...`) to simulate email without contacting real recipients. Test messages, threads, Assistant automations, webhooks, quota, suppressions, and reputation are isolated from live mode.

```ts
const testClient = new ShipmailClient("sm_test_...");

await testClient.messages.send({
  mailbox_id: "mbx_...",
  to: ["customer@example.com"],
  subject: "Sandbox test",
  text: "Not delivered",
  sandbox_outcome: "bounced",
});

await testClient.mailboxes.injectSandboxInbound("mbx_...", {
  from: "customer@example.com",
  subject: "Re: Sandbox test",
  text: "Fake inbound reply",
});
```

## Threads

```ts
const threads = await shipmail.threads.list({ mailbox_id: "mbx_..." });
const threadId = threads.data[0].id;
const thread = await shipmail.threads.get(threadId, { mailbox_id: "mbx_..." });

await shipmail.threads.reply(threadId, {
  mailbox_id: "mbx_...",
  to: ["customer@example.com"],
  text: "Thanks for your email.",
});
```

## Reply scans

Use a durable, atomically captured scan for a historical window. Creation returns a completed
snapshot; retry a `409` with bounded backoff while historical classification finishes, then follow
every opaque `next_cursor`; never parse or fabricate cursors. Scans are retained for 30 days.

```ts
const scan = await shipmail.replyScans.create({
  mailbox_ids: ["550e8400-e29b-41d4-a716-446655440000"],
  after: new Date(Date.now() - 365 * 86_400_000).toISOString(),
});
const results = await shipmail.replyScans.listResults(scan.id, { limit: 100 });
console.log(results.data);
```

## Webhooks

```ts
const webhook = await shipmail.webhooks.create({
  url: "https://example.com/webhook",
  events: ["message.received", "message.sent"],
  description: "Incoming email handler",
  // Optional. Sent as the Authorization header of every delivery. Never returned.
  authorization: "Bearer your-endpoint-key",
  // Optional. A whsec_ secret from the receiving service, such as a Grok automation.
  // Deliveries then carry webhook-id, webhook-timestamp and webhook-signature. Never returned.
  standard_webhooks_secret: "whsec_...",
});
// webhook.secret is returned only on creation. Store it now.
// webhook.has_authorization is true when an authorization value is set.
// webhook.has_standard_webhooks_secret is true when a signing secret is set.

await shipmail.webhooks.list();
await shipmail.webhooks.get("whk_...");
await shipmail.webhooks.update("whk_...", { active: false });
await shipmail.webhooks.update("whk_...", { authorization: null }); // remove the header
await shipmail.webhooks.update("whk_...", { standard_webhooks_secret: null }); // stop signing
await shipmail.webhooks.delete("whk_...");

await shipmail.webhooks.rotateSecret("whk_...");
await shipmail.webhooks.test("whk_...");
await shipmail.webhooks.listDeliveries("whk_...");
await shipmail.webhooks.getDelivery("whk_...", "dlv_...");
await shipmail.webhooks.replayDelivery("whk_...", "dlv_...", {
  idempotencyKey: "replay-dlv-123",
});
```

Supported event types:

```
message.received
message.sent
message.delayed
message.delivered
message.bounced
message.complained
mailbox.rule_matched
domain.verified
domain.verification_failed
domain.degraded
org.reputation_warning
org.sending_throttled
org.sending_suspended
org.reputation_recovered
reply.overdue
conversation.needs_action
calendar.event_starting
booking.created
subscriber.added
newsletter.sent
```

## Suppressions

```ts
await shipmail.suppressions.create({ email: "user@example.com" }); // scope defaults to "all"
await shipmail.suppressions.create({ email: "user@example.com", scope: "marketing" });
await shipmail.suppressions.list({ limit: 25 });
await shipmail.suppressions.list({ scope: "marketing" }); // newsletter complaints only
await shipmail.suppressions.remove("user@example.com");
```

Auto-paginate:

```ts
for await (const item of shipmail.suppressions.listAutoPaginating({ limit: 100 })) {
  console.log(item.email_address, item.reason);
}
```

## Audiences

```ts
const audience = await shipmail.audiences.create({
  name: "Newsletter",
  consent_source: "Website signup form",
});

await shipmail.audiences.subscribers.add(audience.id, {
  email_address: "jane@example.com",
  merge_fields: { plan: "pro" },
});

await shipmail.audiences.feeds.update(audience.id, {
  enabled: true,
  title: "Release notes",
  canonical_url: "https://example.com/feed.xml",
  entry_limit: 25,
});
// Graceful migration: the current URL redirects to the replacement.
await shipmail.audiences.feeds.rotate(audience.id);
// Leaked URL: immediately invalidate both current and previous URLs.
await shipmail.audiences.feeds.revoke(audience.id);
```

## Newsletters

```ts
import { readFile } from "node:fs/promises";

const senderIdentities = await shipmail.newsletters.senderIdentities.list({ limit: 25 });
const assets = await shipmail.newsletters.assets.list({ kind: "image", q: "hero", limit: 25 });
const hero = await shipmail.newsletters.assets.upload({
  filename: "hero.png",
  content_type: "image/png",
  data: await readFile("hero.png"),
});
const existingHero = await shipmail.newsletters.assets.registerFromUrl({
  url: "https://cdn.shipmail.to/newsletter-images/org_123/hero.png",
  filename: "hero.png",
});

console.log(assets.storage.used_bytes, assets.storage.limit_bytes);

const newsletter = await shipmail.newsletters.create({
  audience_id: "aud_...",
  sender_identity_id: senderIdentities.data[0].id,
  name: "July changelog",
  subject: "What shipped in July",
  preview_text: "A quick product update",
  blocks: [
    { type: "heading", level: 1, text: "July updates" },
    {
      type: "callout",
      variant: "info",
      title: "Quick note",
      body: "A <strong>short</strong> intro.",
    },
    {
      type: "paragraph",
      body: 'Read the <a href="https://example.com/launch">full announcement</a>.',
    },
    { type: "image", url: hero.url, alt: "Product screenshot" },
    { type: "image", url: existingHero.url, alt: "Existing CDN screenshot" },
    {
      type: "columns",
      ratio: "50-50",
      left: { title: "For teams", image_url: hero.url, image_fit: "natural" },
      right: { title: "For agents", image_url: existingHero.url, image_fit: "contain" },
    },
  ],
});

await shipmail.newsletters.preview(newsletter.id);

await shipmail.newsletters.sendTest(newsletter.id, {
  recipient_email: "owner@example.com",
});

await shipmail.newsletters.preflight(newsletter.id);

await shipmail.newsletters.schedule(newsletter.id, {
  scheduled_at: "2026-08-01T09:00:00.000Z",
});
```

Newsletter test sends and schedules must pass preflight. Guardrail failures throw
`ValidationError` with the failed preflight items in `error.details`.
Preflight responses include `url_breakdown` so you can see which links, image
URLs, and video thumbnails contribute to deliverability checks.
Paragraph, quote, callout, list-item, and column bodies accept bare text or
sanitized inline HTML. Use `<p>` and `<br>` for line breaks. Allowed tags are
`a`, `b`, `br`, `code`, `em`, `i`, `p`, `s`, `span`, `strong`, and `u`. Use
`body_html` or `custom_html` for a fully custom email-safe layout.
Concurrent newsletter updates can throw `ConflictError` (409). Fetch the latest
newsletter, merge your changes, and retry the update.

## Status

```ts
const status = await shipmail.status.get();
```

## Pagination

List methods return `{ data, pagination }` with cursor-based pagination:

```ts
const page = await shipmail.domains.list({ limit: 10 });
page.data; // Domain[]
page.pagination; // { next_cursor, has_more }

if (page.pagination.has_more) {
  const next = await shipmail.domains.list({
    cursor: page.pagination.next_cursor,
    limit: 10,
  });
}
```

Cursors are opaque and operation-specific. Return them unchanged to the same operation. Inbox and
reply-queue cursors are bound to their mailbox, time window, sort, and filters; omit those filters on
later pages or repeat them exactly.

Auto-paginate over all pages:

```ts
for await (const domain of shipmail.domains.listAutoPaginating({ limit: 25 })) {
  console.log(domain.name);
}
```

`listAutoPaginating` is available on `domains`, `mailboxes`, `messages`, `threads`, `webhooks`, `webhooks.listDeliveriesAutoPaginating`, `suppressions`, `members`, `bookingPages`, `bookingLinks`, `calendar.events`, `audiences`, `audiences.subscribers`, `newsletters`, `newsletters.domains`, `newsletters.senderIdentities`, and `newsletters.assets`.

## Webhook verification

Verify incoming webhook signatures without instantiating a client:

```ts
import { verifyWebhook, WebhookVerificationError } from "shipmail";

try {
  const event = await verifyWebhook(rawBody, request.headers, webhookSecret);
  event.event_type; // typed WebhookEventType union
  event.data;
} catch (err) {
  if (err instanceof WebhookVerificationError) {
    // signature mismatch, missing header, expired timestamp, etc.
  }
}
```

### Next.js Route Handler example

App Router consumes `request.text()` to get the raw body. Do not parse to JSON before verifying.

```ts
// app/api/webhooks/shipmail/route.ts
import { verifyWebhook, WebhookVerificationError } from "shipmail";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.SHIPMAIL_WEBHOOK_SECRET!;

  try {
    const event = await verifyWebhook(rawBody, request.headers, secret);
    // handle event...
    return new Response("ok");
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return new Response("invalid signature", { status: 401 });
    }
    throw err;
  }
}
```

## Per-request options

Every method accepts a final `options` argument:

```ts
type MethodOptions = {
  timeout?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  idempotencyKey?: string;
};
```

```ts
await shipmail.messages.send(params, {
  timeout: 5_000,
  headers: { "x-trace-id": traceId },
});
```

## Idempotency

Pass `idempotencyKey` on mutating calls to make them safe to retry:

```ts
await shipmail.messages.send(
  {
    mailbox_id: "mbx_...",
    to: [{ address: "user@example.com" }],
    subject: "Receipt",
    text: "Thanks for your purchase.",
  },
  { idempotencyKey: `receipt-${orderId}` },
);
```

The SDK adds the key as the `Idempotency-Key` header. Reuse the same key to retry without sending a duplicate email. Keys are scoped per API key.

## Cancellation

Pass an `AbortSignal` to cancel an in-flight request. The signal also cancels SDK-internal retries:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 2_000);

await shipmail.messages.send(params, { signal: controller.signal });
```

## Custom fetch and proxies

Inject a custom fetch implementation for proxies, observability, or testing:

```ts
const shipmail = new ShipmailClient({
  apiKey: process.env.SHIPMAIL_API_KEY!,
  fetch: async (url, init) => {
    const start = Date.now();
    const res = await fetch(url, init);
    metrics.histogram("shipmail.fetch.duration_ms", Date.now() - start);
    return res;
  },
});
```

The custom fetch receives the same arguments as the global `fetch` and must return a `Response`.

## Errors

The SDK throws typed errors that map to HTTP responses. All inherit from `ShipmailError`:

```ts
import {
  ShipmailError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  QuotaExceededError,
  InternalServerError,
  ConnectionError,
} from "shipmail";

try {
  await shipmail.messages.send(params);
} catch (err) {
  if (err instanceof ValidationError) {
    err.message;
    err.details; // field-level validation errors
  }
  if (err instanceof RateLimitError) {
    err.retryAfter; // seconds
  }
  if (err instanceof ShipmailError) {
    err.status; // HTTP status
    err.type; // error type string
    err.requestId; // include this when contacting support
    err.retryable;
  }
  throw err;
}
```

| Error                 | When                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `AuthenticationError` | 401. Bad or missing API key.                                     |
| `AuthorizationError`  | 403. Key lacks permission for the resource.                      |
| `ValidationError`     | 400 or 422. See `details` for per-field errors.                  |
| `NotFoundError`       | 404.                                                             |
| `ConflictError`       | 409. Resource already exists or state conflict.                  |
| `RateLimitError`      | 429. Read `retryAfter` (seconds).                                |
| `QuotaExceededError`  | 402. Plan or sending quota exceeded.                             |
| `InternalServerError` | 5xx. Eligible requests retry up to `maxRetries`.                 |
| `ConnectionError`     | Network error, timeout, or DNS failure. Eligible requests retry. |

## Retries

The SDK retries eligible requests after connection errors, `429` responses, and retryable `5xx` errors. Automatic retries apply to `GET`, `HEAD`, and `OPTIONS`. Only POST, PATCH, and PUT mutations can retry, and they require an explicit `idempotencyKey` method option or an `Idempotency-Key` header. Reuse the same key for the same operation. DELETE requests and errors marked non-retryable are never retried.

`maxRetries` defaults to 2 (up to 3 total attempts) and must be a non-negative integer. Set it to 0 to disable retries.

A valid `Retry-After` header, in seconds or HTTP-date format, takes precedence over the rate-limit error body's `retry_after`. Otherwise, retries use exponential backoff with jitter. If the requested delay exceeds 60 seconds, the SDK returns the error without retrying automatically; schedule any later retry after that delay.

```ts
new ShipmailClient({ apiKey, maxRetries: 0 }); // disable retries
```

Retries respect any `AbortSignal` you pass via `MethodOptions.signal`.

## Bundling

The package ships ESM and CommonJS via `exports`, with `"sideEffects": false` for tree-shaking. Importing a single resource pulls in only what it needs. The published bundle has no runtime dependencies.

## Testing

Mock by injecting a custom `fetch` at construction time:

```ts
const shipmail = new ShipmailClient({
  apiKey: "sm_live_test",
  fetch: async () =>
    new Response(JSON.stringify({ id: "msg_123", status: "queued" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
});
```

This is the recommended pattern for unit tests. No HTTP interception or mocking library required.

## License

[MIT](./LICENSE).

## Links

- [Shipmail docs](https://shipmail.to/docs)
- [Quick start](https://shipmail.to/docs/api/quick-start)
- [API reference](https://shipmail.to/docs/api)
- [TypeScript SDK guide](https://shipmail.to/docs/sdks/typescript)
- [`shipmail-mcp` (MCP server)](https://www.npmjs.com/package/shipmail-mcp)
- [Changelog](./CHANGELOG.md)
- [Source](https://github.com/shipmail-to/shipmail-node)
- [Issues](https://github.com/shipmail-to/shipmail-node/issues)
