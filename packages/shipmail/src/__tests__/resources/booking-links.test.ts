import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { BookingLink } from "../../types/booking-link.js";
import type { PaginatedResponse } from "../../types/common.js";

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

const mockLink: BookingLink = {
  object: "booking_link",
  id: "bkp_link",
  mailbox: "orders@papertrail-studio.test",
  slug: "o--abc123",
  url: "https://shipmail.to/book/papertrail-studio.test/o--abc123",
  name: "Call with Sam",
  description: null,
  duration_minutes: 30,
  timezone: "Europe/Lisbon",
  offered_ranges: [{ start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T12:00:00.000Z" }],
  source_page_id: null,
  buffer_minutes: 0,
  minimum_notice_minutes: 0,
  conferencing_provider: null,
  max_bookings: 1,
  bookings_count: 0,
  expires_at: null,
  status: "open",
  created_at: "2026-10-21T10:00:00.000Z",
};

describe("BookingLinks", () => {
  test("create sends POST /booking-links with body", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/booking-links");
      expect(JSON.parse(init?.body as string)).toMatchObject({
        offered_ranges: mockLink.offered_ranges,
        max_bookings: null,
      });
      return Response.json(mockLink, { status: 201 });
    });

    const link = await client.bookingLinks.create({
      name: "Call with Sam",
      mailbox: "orders@papertrail-studio.test",
      duration_minutes: 30,
      timezone: "Europe/Lisbon",
      offered_ranges: [{ start: "2026-11-02T09:00:00.000Z", end: "2026-11-02T12:00:00.000Z" }],
      max_bookings: null,
    });

    expect(link.object).toBe("booking_link");
  });

  test("list sends GET /booking-links with pagination and status", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      const url = new URL(String(input));
      expect(url.pathname).toBe("/v1/booking-links");
      expect(url.searchParams.get("limit")).toBe("10");
      expect(url.searchParams.get("status")).toBe("open");
      const body: PaginatedResponse<BookingLink> = {
        data: [mockLink],
        pagination: { next_cursor: null, has_more: false, limit: 10 },
      };
      return Response.json(body);
    });

    const result = await client.bookingLinks.list({ limit: 10, status: "open" });
    expect(result.data).toHaveLength(1);
  });

  test("get sends GET /booking-links/:id", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe("/v1/booking-links/bkp_link");
      return Response.json(mockLink);
    });

    const link = await client.bookingLinks.get("bkp_link");
    expect(link.id).toBe("bkp_link");
  });

  test("update sends PATCH /booking-links/:id", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("PATCH");
      expect(new URL(String(input)).pathname).toBe("/v1/booking-links/bkp_link");
      expect(JSON.parse(init?.body as string)).toEqual({ max_bookings: 3 });
      return Response.json({ ...mockLink, max_bookings: 3 });
    });

    const link = await client.bookingLinks.update("bkp_link", { max_bookings: 3 });
    expect(link.max_bookings).toBe(3);
  });

  test("revoke sends POST /booking-links/:id/revoke", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/booking-links/bkp_link/revoke");
      return Response.json({ ...mockLink, status: "revoked" });
    });

    const link = await client.bookingLinks.revoke("bkp_link");
    expect(link.status).toBe("revoked");
  });
});
