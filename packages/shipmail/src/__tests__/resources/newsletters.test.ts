import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { PaginatedResponse } from "../../types/common.js";
import type {
  Newsletter,
  NewsletterAsset,
  NewsletterAssetListResponse,
  NewsletterDomain,
  NewsletterPreflight,
  NewsletterPreview,
  NewsletterSenderIdentity,
  NewsletterStatus,
  NewsletterTestSend,
} from "../../types/newsletter.js";

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

const mockNewsletter: Newsletter = {
  object: "newsletter",
  id: "nws_123",
  audience_id: "aud_123",
  sender_identity_id: "nwsid_123",
  newsletter_domain_id: "nwsdom_123",
  name: "July changelog",
  subject: "What shipped in July",
  preview_text: "A quick product update",
  from_name: "Shipmail",
  from_address: "updates@example.com",
  reply_to_address: null,
  blocks: [{ type: "paragraph", body: "<p>Hello</p>" }],
  body_html: "<p>Hello</p>",
  body_text: "Hello",
  status: "draft",
  archive_visibility: "private",
  feed_entry_url: null,
  styling_mode: "styled",
  track_engagement: false,
  add_utm_tags: false,
  opened_count: null,
  clicked_count: null,
  send_limit: null,
  held_count: 0,
  subject_b: null,
  subject_test_percent: null,
  subject_test_hours: null,
  subject_test_winner: null,
  subject_test_decided_at: null,
  preflight_status: "not_run",
  preflight_results: {},
  send_window_hours: 6,
  send_rate_per_hour: 500,
  recipient_count: 0,
  sent_count: 0,
  delivered_count: 0,
  bounced_count: 0,
  complained_count: 0,
  failed_count: 0,
  skipped_count: 0,
  last_test_sent_at: null,
  last_test_recipient: null,
  content_changed_since_test_send: false,
  scheduled_at: null,
  approved_at: null,
  started_at: null,
  published_at: null,
  completed_at: null,
  cancelled_at: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

const mockNewsletterDomain: NewsletterDomain = {
  object: "newsletter_domain",
  id: "nwsdom_123",
  root_domain_name: "example.com",
  domain_name: "updates.example.com",
  from_local_part: "updates",
  from_address: "updates@updates.example.com",
  mail_from_domain: "mail.updates.example.com",
  reply_to_address: "hello@example.com",
  status: "verified",
  dkim_status: "verified",
  mail_from_status: "verified",
  spf_status: "verified",
  dmarc_status: "verified",
  verified_at: "2026-07-01T00:00:00Z",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

const mockNewsletterSenderIdentity: NewsletterSenderIdentity = {
  object: "newsletter_sender_identity",
  id: "nwsid_123",
  newsletter_domain_id: "nwsdom_123",
  from_name: "Shipmail",
  from_address: "updates@updates.example.com",
  business_name: "Shipmail, Inc.",
  postal_address: "123 Market St",
  footer_text: "You subscribed at shipmail.to.",
  domain_status: "verified",
  is_default: true,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

const emptyUrlBreakdown = {
  href_count: 0,
  image_src_count: 0,
  video_href_count: 0,
  text_url_count: 0,
  unique_url_count: 0,
  max_unique_urls: 30,
  urls: [],
  offending_urls: [],
} as const;

const mockNewsletterAsset: NewsletterAsset = {
  object: "newsletter_asset",
  id: "nwsasset_123",
  kind: "image",
  filename: "hero.png",
  content_type: "image/png",
  byte_size: 1234,
  checksum_sha256: "abc123",
  url: "https://cdn.example.com/hero.png",
  image_url: "https://cdn.example.com/hero.png",
  video_url: null,
  thumbnail_url: null,
  thumbnail_content_type: null,
  thumbnail_byte_size: null,
  duration_seconds: null,
  width: 1200,
  height: 630,
  created_at: "2026-07-01T00:00:00Z",
};

describe("Newsletters", () => {
  test("create sends POST /newsletters with blocks", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters");
      expect(JSON.parse(init?.body as string)).toEqual({
        audience_id: "aud_123",
        sender_identity_id: "nwsid_123",
        name: "July changelog",
        subject: "What shipped in July",
        feed_entry_url: "https://example.com/",
        styling_mode: "plain",
        track_engagement: true,
        blocks: [
          { type: "heading", level: 1, text: "July updates" },
          {
            type: "paragraph",
            body: '<p>Read the <a href="https://example.com/launch">launch notes</a>.</p>',
          },
          { type: "list", ordered: false, items: ["One", "<strong>Two</strong>"] },
          {
            type: "callout",
            variant: "info",
            title: "Quick note",
            body: "A <em>short</em> intro.",
          },
          {
            type: "columns",
            ratio: "50-50",
            left: {
              title: "For teams",
              image_url: "https://cdn.example.com/teams.png",
              image_alt: "Team inbox",
              image_fit: "contain",
            },
            right: { title: "For agents" },
          },
        ],
      });
      return Response.json(mockNewsletter);
    });

    const newsletter = await client.newsletters.create({
      audience_id: "aud_123",
      sender_identity_id: "nwsid_123",
      name: "July changelog",
      subject: "What shipped in July",
      feed_entry_url: "https://example.com/",
      styling_mode: "plain",
      track_engagement: true,
      blocks: [
        { type: "heading", level: 1, text: "July updates" },
        {
          type: "paragraph",
          body: '<p>Read the <a href="https://example.com/launch">launch notes</a>.</p>',
        },
        { type: "list", ordered: false, items: ["One", "<strong>Two</strong>"] },
        {
          type: "callout",
          variant: "info",
          title: "Quick note",
          body: "A <em>short</em> intro.",
        },
        {
          type: "columns",
          ratio: "50-50",
          left: {
            title: "For teams",
            image_url: "https://cdn.example.com/teams.png",
            image_alt: "Team inbox",
            image_fit: "contain",
          },
          right: { title: "For agents" },
        },
      ],
    });
    expect(newsletter.id).toBe("nws_123");
  });

  test("create sends POST /newsletters with body", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters");
      expect(JSON.parse(init?.body as string)).toEqual({
        audience_id: "aud_123",
        sender_identity_id: "nwsid_123",
        name: "July changelog",
        subject: "What shipped in July",
        body_html: "<p>Hello</p>",
      });
      return Response.json(mockNewsletter);
    });

    const newsletter = await client.newsletters.create({
      audience_id: "aud_123",
      sender_identity_id: "nwsid_123",
      name: "July changelog",
      subject: "What shipped in July",
      body_html: "<p>Hello</p>",
    });
    expect(newsletter.id).toBe("nws_123");
  });

  test("createFromChangelog sends POST /newsletters/from-changelog with body", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters/from-changelog");
      expect(JSON.parse(init?.body as string)).toEqual({
        audience_id: "aud_123",
        sender_identity_id: "nwsid_123",
        name: "July changelog",
        subject: "What shipped in July",
        tone: "friendly",
        styling_mode: "plain",
        entries: [{ title: "Media library", body: "Reuse uploads." }],
      });
      return Response.json(mockNewsletter);
    });

    const newsletter = await client.newsletters.createFromChangelog({
      audience_id: "aud_123",
      sender_identity_id: "nwsid_123",
      name: "July changelog",
      subject: "What shipped in July",
      tone: "friendly",
      styling_mode: "plain",
      entries: [{ title: "Media library", body: "Reuse uploads." }],
    });
    expect(newsletter.id).toBe("nws_123");
  });

  test("update sends PATCH /newsletters/:id with track_engagement", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("PATCH");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters/nws_123");
      expect(JSON.parse(init?.body as string)).toEqual({ track_engagement: true });
      return Response.json({
        ...mockNewsletter,
        track_engagement: true,
        opened_count: 12,
        clicked_count: 4,
      });
    });

    const newsletter = await client.newsletters.update("nws_123", { track_engagement: true });
    expect(newsletter.track_engagement).toBe(true);
    expect(newsletter.opened_count).toBe(12);
    expect(newsletter.clicked_count).toBe(4);
  });

  test("update sends PATCH /newsletters/:id with add_utm_tags", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("PATCH");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters/nws_123");
      expect(JSON.parse(init?.body as string)).toEqual({ add_utm_tags: true });
      return Response.json({ ...mockNewsletter, add_utm_tags: true });
    });

    const newsletter = await client.newsletters.update("nws_123", { add_utm_tags: true });
    expect(newsletter.add_utm_tags).toBe(true);
  });

  test("list sends GET /newsletters", async () => {
    const response: PaginatedResponse<Newsletter> = {
      data: [mockNewsletter],
      pagination: { next_cursor: null, has_more: false },
    };
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters");
      return Response.json(response);
    });

    const result = await client.newsletters.list();
    expect(result.data[0]?.id).toBe("nws_123");
  });

  test("domains.list sends GET /newsletter-domains", async () => {
    const response: PaginatedResponse<NewsletterDomain> = {
      data: [mockNewsletterDomain],
      pagination: { next_cursor: null, has_more: false },
    };
    const client = createClient((input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("GET");
      expect(url.pathname).toBe("/v1/newsletter-domains");
      expect(url.searchParams.get("limit")).toBe("10");
      return Response.json(response);
    });

    const result = await client.newsletters.domains.list({ limit: 10 });
    expect(result.data[0]?.id).toBe("nwsdom_123");
  });

  test("domains.listAutoPaginating uses /newsletter-domains", async () => {
    const paths: string[] = [];
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      paths.push(new URL(String(input)).pathname);
      return Response.json({
        data: [mockNewsletterDomain],
        pagination: { next_cursor: null, has_more: false, limit: 25 },
      });
    });

    const items: NewsletterDomain[] = [];
    for await (const item of client.newsletters.domains.listAutoPaginating({ limit: 25 })) {
      items.push(item);
    }
    expect(paths).toEqual(["/v1/newsletter-domains"]);
    expect(items[0]?.id).toBe("nwsdom_123");
  });

  test("senderIdentities.list sends GET /newsletter-sender-identities", async () => {
    const response: PaginatedResponse<NewsletterSenderIdentity> = {
      data: [mockNewsletterSenderIdentity],
      pagination: { next_cursor: null, has_more: false },
    };
    const client = createClient((input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("GET");
      expect(url.pathname).toBe("/v1/newsletter-sender-identities");
      expect(url.searchParams.get("limit")).toBe("10");
      return Response.json(response);
    });

    const result = await client.newsletters.senderIdentities.list({ limit: 10 });
    expect(result.data[0]?.id).toBe("nwsid_123");
  });

  test("assets.list sends GET /newsletter-assets", async () => {
    const response: NewsletterAssetListResponse = {
      data: [mockNewsletterAsset],
      pagination: { next_cursor: null, has_more: false, limit: 24 },
      storage: {
        used_bytes: 1234,
        limit_bytes: 2_147_483_648,
        remaining_bytes: 2_147_482_414,
        over_limit: false,
        plan: "solo",
        is_in_trial: false,
        next_upgrade: { plan: "pro", storage_bytes: 10_737_418_240 },
      },
    };
    const client = createClient((input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("GET");
      expect(url.pathname).toBe("/v1/newsletter-assets");
      expect(url.searchParams.get("kind")).toBe("image");
      expect(url.searchParams.get("q")).toBe("hero");
      return Response.json(response);
    });

    const result = await client.newsletters.assets.list({ kind: "image", q: "hero" });
    expect(result.data[0]?.id).toBe("nwsasset_123");
    expect(result.storage.limit_bytes).toBe(2_147_483_648);
  });

  test("assets.listAutoPaginating keeps filters across cursor pages", async () => {
    const requestedCursors: (string | null)[] = [];
    const client = createClient((input) => {
      const url = new URL(String(input));
      const cursor = url.searchParams.get("cursor");
      requestedCursors.push(cursor);
      expect(url.pathname).toBe("/v1/newsletter-assets");
      expect(url.searchParams.get("kind")).toBe("image");
      expect(url.searchParams.get("q")).toBe("hero");
      expect(url.searchParams.get("limit")).toBe("1");
      return Response.json({
        data: [mockNewsletterAsset],
        pagination: {
          next_cursor: cursor ? null : "next-page",
          has_more: cursor === null,
          limit: 1,
        },
        storage: {
          used_bytes: 0,
          limit_bytes: null,
          remaining_bytes: null,
          over_limit: false,
          plan: "free",
          is_in_trial: false,
          next_upgrade: null,
        },
      });
    });

    const assets: NewsletterAsset[] = [];
    for await (const asset of client.newsletters.assets.listAutoPaginating({
      kind: "image",
      q: "hero",
      limit: 1,
    })) {
      assets.push(asset);
    }

    expect(assets).toHaveLength(2);
    expect(requestedCursors).toEqual([null, "next-page"]);
  });

  test("assets.upload sends raw bytes to /newsletter-assets", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const client = createClient(async (input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("POST");
      expect(url.pathname).toBe("/v1/newsletter-assets");
      expect(url.searchParams.get("filename")).toBe("hero.png");
      expect(new Headers(init?.headers).get("content-type")).toBe("image/png");
      const body = init?.body as Blob;
      expect(Array.from(new Uint8Array(await body.arrayBuffer()))).toEqual([1, 2, 3]);
      return Response.json(mockNewsletterAsset);
    });

    const asset = await client.newsletters.assets.upload({
      filename: "hero.png",
      content_type: "image/png",
      data: bytes,
    });
    expect(asset.id).toBe("nwsasset_123");
  });

  test("assets.prepareUpload creates a one-time newsletter upload", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletter-assets/upload-tokens");
      expect(JSON.parse(init?.body as string)).toEqual({
        filename: "hero.png",
        content_type: "image/png",
        size: 123,
        sha256: "a".repeat(64),
      });
      return Response.json({
        object: "newsletter_asset_upload",
        kind: "image",
        filename: "hero.png",
        content_type: "image/png",
        size: 123,
        sha256: "a".repeat(64),
        upload_url: "https://r2.example/newsletter-images/org_123/token.png?signed=put",
        upload_method: "PUT",
        upload_headers: {
          "Content-Type": "image/png",
          "If-None-Match": "*",
        },
        complete_url: "https://shipmail.to/api/v1/newsletter-asset-uploads/token",
        complete_method: "POST",
        expires_at: "2026-08-08T12:05:00.000Z",
      });
    });

    const prepared = await client.newsletters.assets.prepareUpload({
      filename: "hero.png",
      content_type: "image/png",
      size: 123,
      sha256: "a".repeat(64),
    });
    expect(prepared.upload_method).toBe("PUT");
    expect(prepared.complete_method).toBe("POST");
  });

  test("assets.registerFromUrl sends JSON to /newsletter-assets", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletter-assets");
      expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
      expect(JSON.parse(init?.body as string)).toEqual({
        url: "https://cdn.shipmail.to/newsletter-images/org_123/hero.png",
        filename: "hero.png",
      });
      return Response.json(mockNewsletterAsset);
    });

    const asset = await client.newsletters.assets.registerFromUrl({
      url: "https://cdn.shipmail.to/newsletter-images/org_123/hero.png",
      filename: "hero.png",
    });
    expect(asset.id).toBe("nwsasset_123");
  });

  test("update sends PATCH /newsletters/:id", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("PATCH");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters/nws_123");
      expect(JSON.parse(init?.body as string)).toEqual({
        subject: "Updated",
        styling_mode: "plain",
      });
      return Response.json({ ...mockNewsletter, subject: "Updated" });
    });

    const newsletter = await client.newsletters.update("nws_123", {
      subject: "Updated",
      styling_mode: "plain",
    });
    expect(newsletter.subject).toBe("Updated");
  });

  test("preflight sends POST /newsletters/:id/preflight", async () => {
    const response: NewsletterPreflight = {
      object: "newsletter_preflight",
      newsletter_id: "nws_123",
      status: "passed",
      items: [],
      url_breakdown: emptyUrlBreakdown,
    };
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters/nws_123/preflight");
      return Response.json(response);
    });

    const result = await client.newsletters.preflight("nws_123");
    expect(result.status).toBe("passed");
  });

  test("preview sends POST /newsletters/:id/preview", async () => {
    const response: NewsletterPreview = {
      object: "newsletter_preview",
      newsletter_id: "nws_123",
      html: "<p>Hello</p>",
      archive_html: "<p>Hello</p>",
      text: "Hello",
      warnings: [],
      url_breakdown: emptyUrlBreakdown,
    };
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters/nws_123/preview");
      return Response.json(response);
    });

    const result = await client.newsletters.preview("nws_123");
    expect(result.text).toBe("Hello");
  });

  test("sendTest sends POST /newsletters/:id/test-send", async () => {
    const response: NewsletterTestSend = {
      object: "newsletter_test_send",
      id: "nwstest_123",
      newsletter_id: "nws_123",
      message_id: "msg_123",
      recipient_email: "owner@example.com",
      status: "sent",
      last_error: null,
      sent_at: "2026-07-01T00:00:00Z",
      created_at: "2026-07-01T00:00:00Z",
    };
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters/nws_123/test-send");
      expect(JSON.parse(init?.body as string)).toEqual({ recipient_email: "owner@example.com" });
      return Response.json(response);
    });

    const result = await client.newsletters.sendTest("nws_123", {
      recipient_email: "owner@example.com",
    });
    expect(result.status).toBe("sent");
  });

  test("schedule sends POST /newsletters/:id/schedule", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/newsletters/nws_123/schedule");
      expect(JSON.parse(init?.body as string)).toEqual({
        scheduled_at: "2026-08-01T09:00:00Z",
      });
      return Response.json({ ...mockNewsletter, status: "scheduled" });
    });

    const newsletter = await client.newsletters.schedule("nws_123", {
      scheduled_at: "2026-08-01T09:00:00Z",
    });
    expect(newsletter.status).toBe("scheduled");
  });

  test("schedule returns in_review while the content check holds the newsletter", async () => {
    const client = createClient(() => Response.json({ ...mockNewsletter, status: "in_review" }));

    const newsletter = await client.newsletters.schedule("nws_123", {
      scheduled_at: "2026-08-01T09:00:00Z",
    });
    const status: NewsletterStatus = newsletter.status;
    expect(status).toBe("in_review");
  });

  test("cancel and resume post to lifecycle endpoints", async () => {
    const paths: string[] = [];
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      paths.push(new URL(String(input)).pathname);
      return Response.json(mockNewsletter);
    });

    await client.newsletters.cancel("nws_123");
    await client.newsletters.resume("nws_123");
    expect(paths).toEqual(["/v1/newsletters/nws_123/cancel", "/v1/newsletters/nws_123/resume"]);
  });

  test("schedule passes a limit and sendToMore posts the next count", async () => {
    const bodies: unknown[] = [];
    const paths: string[] = [];
    const client = createClient((input, init) => {
      paths.push(new URL(String(input)).pathname);
      bodies.push(JSON.parse(init?.body as string));
      return Response.json({ ...mockNewsletter, status: "sending", send_limit: 500 });
    });

    await client.newsletters.schedule("nws_123", {
      scheduled_at: "2026-08-01T09:00:00Z",
      limit: 500,
    });
    await client.newsletters.sendToMore("nws_123", { count: 1000 });
    await client.newsletters.sendToMore("nws_123");
    expect(paths).toEqual([
      "/v1/newsletters/nws_123/schedule",
      "/v1/newsletters/nws_123/send-more",
      "/v1/newsletters/nws_123/send-more",
    ]);
    expect(bodies).toEqual([
      { scheduled_at: "2026-08-01T09:00:00Z", limit: 500 },
      { count: 1000 },
      {},
    ]);
  });
});
