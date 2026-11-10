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
  NewsletterRecipient,
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
  view_in_browser: true,
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
  dns_records: [
    {
      key: "dkim",
      type: "TXT",
      host: "shipmail._domainkey.updates.example.com",
      value: "v=DKIM1; k=rsa; p=MIIBIjAN",
      priority: null,
      ttl: 300,
      description: "Signs newsletter emails with DKIM so inboxes trust them.",
    },
  ],
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

  test("update sends PATCH /newsletters/:id with view_in_browser", async () => {
    const client = createClient((_input, init) => {
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(init?.body as string)).toEqual({ view_in_browser: false });
      return Response.json({ ...mockNewsletter, view_in_browser: false });
    });

    const newsletter = await client.newsletters.update("nws_123", { view_in_browser: false });
    expect(newsletter.view_in_browser).toBe(false);
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

  test("domains.get and senderIdentities.get read one item", async () => {
    const paths: string[] = [];
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      const pathname = new URL(String(input)).pathname;
      paths.push(pathname);
      return Response.json(
        pathname.startsWith("/v1/newsletter-domains/")
          ? mockNewsletterDomain
          : mockNewsletterSenderIdentity,
      );
    });

    const domain = await client.newsletters.domains.get("nwsdom_123");
    const identity = await client.newsletters.senderIdentities.get("nwsid_123");
    expect(domain.id).toBe("nwsdom_123");
    expect(identity.id).toBe("nwsid_123");
    expect(paths).toEqual([
      "/v1/newsletter-domains/nwsdom_123",
      "/v1/newsletter-sender-identities/nwsid_123",
    ]);
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

  test("domains.create, verify and delete reach the setup endpoints", async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    const client = createClient((input, init) => {
      calls.push({
        method: init?.method ?? "GET",
        path: new URL(String(input)).pathname,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
      return init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json(mockNewsletterDomain);
    });

    const created = await client.newsletters.domains.create({
      root_domain: "example.com",
      subdomain: "news",
      reply_to_address: "hello@example.com",
    });
    const verified = await client.newsletters.domains.verify("nwsdom_123");
    await client.newsletters.domains.delete("nwsdom_123");

    expect(created.dns_records[0]?.key).toBe("dkim");
    expect(verified.id).toBe("nwsdom_123");
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/v1/newsletter-domains",
        body: {
          root_domain: "example.com",
          subdomain: "news",
          reply_to_address: "hello@example.com",
        },
      },
      { method: "POST", path: "/v1/newsletter-domains/nwsdom_123/verify", body: null },
      { method: "DELETE", path: "/v1/newsletter-domains/nwsdom_123", body: null },
    ]);
  });

  test("senderIdentities.create, update and delete reach the identity endpoints", async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    const client = createClient((input, init) => {
      calls.push({
        method: init?.method ?? "GET",
        path: new URL(String(input)).pathname,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
      return init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json(mockNewsletterSenderIdentity);
    });

    await client.newsletters.senderIdentities.create({
      newsletter_domain_id: "nwsdom_123",
      from_name: "Acme",
      business_name: "Acme Ltd.",
    });
    await client.newsletters.senderIdentities.update("nwsid_123", { make_default: true });
    await client.newsletters.senderIdentities.delete("nwsid_123");

    expect(calls).toEqual([
      {
        method: "POST",
        path: "/v1/newsletter-sender-identities",
        body: { newsletter_domain_id: "nwsdom_123", from_name: "Acme", business_name: "Acme Ltd." },
      },
      {
        method: "PATCH",
        path: "/v1/newsletter-sender-identities/nwsid_123",
        body: { make_default: true },
      },
      { method: "DELETE", path: "/v1/newsletter-sender-identities/nwsid_123", body: null },
    ]);
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
      subject: "What shipped in July",
      headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
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
    expect(result.subject).toBe("What shipped in July");
  });

  test("preview sends preview_as for one subscriber", async () => {
    const client = createClient((_input, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        preview_as: { type: "subscriber", subscriber_id: "audmem_1" },
      });
      return Response.json({
        object: "newsletter_preview",
        newsletter_id: "nws_123",
        subject: "Hi Ada",
        headers: {},
        html: "<p>Hi Ada</p>",
        archive_html: "<p>Hi</p>",
        text: "Hi Ada",
        warnings: [],
        url_breakdown: emptyUrlBreakdown,
      });
    });

    const result = await client.newsletters.preview("nws_123", {
      preview_as: { type: "subscriber", subscriber_id: "audmem_1" },
    });
    expect(result.subject).toBe("Hi Ada");
  });

  test("preview still takes the method options second, as releases before preview_as did", async () => {
    let body: BodyInit | null | undefined;
    let headers: Headers | undefined;
    const client = createClient((_input, init) => {
      body = init?.body;
      headers = new Headers(init?.headers);
      return Response.json({
        object: "newsletter_preview",
        newsletter_id: "nws_123",
        subject: "Hello",
        headers: {},
        html: "<p>Hello</p>",
        archive_html: "<p>Hello</p>",
        text: "Hello",
        warnings: [],
        url_breakdown: emptyUrlBreakdown,
      });
    });

    await client.newsletters.preview("nws_123", { headers: { "X-Trace": "legacy" } });
    expect(headers?.get("X-Trace")).toBe("legacy");
    expect(body === undefined || body === null || String(body) === "{}").toBe(true);

    await client.newsletters.preview(
      "nws_123",
      { preview_as: { type: "sample" } },
      { headers: { "X-Trace": "current" } },
    );
    expect(headers?.get("X-Trace")).toBe("current");
    expect(JSON.parse(String(body))).toEqual({ preview_as: { type: "sample" } });
  });

  const mockRecipient: NewsletterRecipient = {
    object: "newsletter_recipient",
    id: "nwsrcp_1",
    newsletter_id: "nws_123",
    email_address: "reader@example.com",
    status: "skipped",
    reason: "opted_out",
    subscriber_id: "audmem_1",
    sent_at: null,
    delivered_at: null,
    bounced_at: null,
    complained_at: null,
    unsubscribed_at: null,
    created_at: "2026-07-01T00:00:00Z",
  };

  test("recipients.list sends GET /newsletters/:id/recipients with filters", async () => {
    const client = createClient((input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("GET");
      expect(url.pathname).toBe("/v1/newsletters/nws_123/recipients");
      expect(url.searchParams.get("status")).toBe("skipped");
      expect(url.searchParams.get("reason")).toBe("opted_out");
      expect(url.searchParams.get("limit")).toBe("10");
      return Response.json({
        data: [mockRecipient],
        pagination: { next_cursor: null, has_more: false, limit: 10 },
      });
    });

    const result = await client.newsletters.recipients.list("nws_123", {
      status: "skipped",
      reason: "opted_out",
      limit: 10,
    });
    expect(result.data[0]?.reason).toBe("opted_out");
  });

  test("recipients.listAutoPaginating follows the cursor", async () => {
    const cursors: (string | null)[] = [];
    const client = createClient((input) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/v1/newsletters/nws_123/recipients");
      const cursor = url.searchParams.get("cursor");
      cursors.push(cursor);
      return Response.json({
        data: [mockRecipient],
        pagination: {
          next_cursor: cursor ? null : "next",
          has_more: cursor === null,
          limit: 1,
        },
      });
    });

    const items: NewsletterRecipient[] = [];
    for await (const item of client.newsletters.recipients.listAutoPaginating("nws_123", {
      limit: 1,
    })) {
      items.push(item);
    }
    expect(cursors).toEqual([null, "next"]);
    expect(items).toHaveLength(2);
  });

  test("recipients.getByEmail sends GET /newsletters/:id/recipients/by-email/:email", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe(
        `/v1/newsletters/nws_123/recipients/by-email/${encodeURIComponent("reader@example.com")}`,
      );
      return Response.json(mockRecipient);
    });

    const result = await client.newsletters.recipients.getByEmail("nws_123", "reader@example.com");
    expect(result.id).toBe("nwsrcp_1");
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
