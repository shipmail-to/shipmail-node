import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { BookingPage } from "../../types/booking-page.js";
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

const mockPage: BookingPage = {
  object: "booking_page",
  id: "bkp_1",
  mailbox: "orders@papertrail-studio.test",
  slug: "intro",
  url: "https://shipmail.to/book/acme/intro",
  name: "Intro call",
  description: null,
  duration_minutes: 30,
  availability_days: [1, 2, 3, 4, 5],
  window_start_minutes: 540,
  window_end_minutes: 1020,
  timezone: "America/New_York",
  lock_timezone: false,
  buffer_minutes: 0,
  minimum_notice_minutes: 0,
  max_advance_days: 30,
  conferencing_provider: "zoom",
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("BookingPages", () => {
  test("create sends POST /booking-pages with body", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/booking-pages");
      expect(JSON.parse(init?.body as string)).toMatchObject({
        slug: "intro",
        conferencing_provider: "google_meet",
        lock_timezone: true,
      });
      return Response.json(mockPage);
    });

    const page = await client.bookingPages.create({
      name: "Intro call",
      mailbox: "orders@papertrail-studio.test",
      slug: "intro",
      duration_minutes: 30,
      availability_days: [1, 2, 3, 4, 5],
      window_start_minutes: 540,
      window_end_minutes: 1020,
      timezone: "America/New_York",
      lock_timezone: true,
      conferencing_provider: "google_meet",
    });
    expect(page.id).toBe("bkp_1");
    expect(page.conferencing_provider).toBe("zoom");
  });

  test("list sends GET /booking-pages", async () => {
    const response: PaginatedResponse<BookingPage> = {
      data: [mockPage],
      pagination: { next_cursor: null, has_more: false },
    };
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe("/v1/booking-pages");
      return Response.json(response);
    });
    const result = await client.bookingPages.list();
    expect(result.data[0]?.id).toBe("bkp_1");
  });

  test("update sends PATCH /booking-pages/:id", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("PATCH");
      expect(new URL(String(input)).pathname).toBe("/v1/booking-pages/bkp_1");
      expect(JSON.parse(init?.body as string)).toEqual({ conferencing_provider: null });
      return Response.json({ ...mockPage, conferencing_provider: null });
    });
    const page = await client.bookingPages.update("bkp_1", { conferencing_provider: null });
    expect(page.conferencing_provider).toBeNull();
  });

  test("slots sends GET /booking-pages/:id/slots with the window", async () => {
    const client = createClient((input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("GET");
      expect(url.pathname).toBe("/v1/booking-pages/bkp_1/slots");
      expect(url.searchParams.get("from")).toBe("2026-11-09T00:00:00Z");
      expect(url.searchParams.get("to")).toBe("2026-11-16T00:00:00Z");
      return Response.json({
        object: "booking_page_slots",
        booking_page_id: "bkp_1",
        timezone: "Europe/Lisbon",
        duration_minutes: 30,
        from: "2026-11-09T00:00:00.000Z",
        to: "2026-11-16T00:00:00.000Z",
        slots: [{ start: "2026-11-09T09:00:00.000Z", end: "2026-11-09T09:30:00.000Z" }],
      });
    });
    const result = await client.bookingPages.slots("bkp_1", {
      from: "2026-11-09T00:00:00Z",
      to: "2026-11-16T00:00:00Z",
    });
    expect(result.timezone).toBe("Europe/Lisbon");
    expect(result.slots[0]?.end).toBe("2026-11-09T09:30:00.000Z");
  });

  test("delete sends DELETE /booking-pages/:id and returns void", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("DELETE");
      expect(new URL(String(input)).pathname).toBe("/v1/booking-pages/bkp_1");
      return new Response(null, { status: 204 });
    });
    expect(await client.bookingPages.delete("bkp_1")).toBeUndefined();
  });
});
