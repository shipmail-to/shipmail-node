import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { CalendarAvailability, CalendarEvent } from "../../types/calendar.js";
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

const ADDRESS = "orders@papertrail-studio.test";
const OPAQUE_EVENT_ID = "evt:opaque.123";

const mockEvent: CalendarEvent = {
  object: "calendar_event",
  id: "evt_1",
  revision: "a".repeat(64),
  mailbox: ADDRESS,
  calendar_id: "cal_1",
  uid: "uid-1",
  title: "Sync",
  invitation_language: "fr",
  description: null,
  location: null,
  video_url: null,
  all_day: false,
  start: "2026-08-01T14:00:00Z",
  end: "2026-08-01T14:30:00Z",
  timezone: "Europe/Paris",
  duration: "PT30M",
  status: "confirmed",
  free_busy_status: "busy",
  privacy: null,
  color: null,
  recurrence: null,
  recurrence_id: null,
  reminders: [],
  organizer: { email: ADDRESS, name: "Orders" },
  attendees: [{ email: "guest@example.com", name: "Guest", status: "needs-action" }],
  created_at: null,
  updated_at: null,
};
const mockMutationEvent = {
  ...mockEvent,
  invitation_outcomes: [],
  invitation_failures: [],
};

describe("Calendar.events", () => {
  test("create sends POST /calendar/events with body", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/calendar/events");
      expect(JSON.parse(init?.body as string)).toEqual({
        mailbox: ADDRESS,
        operation_key: "calendar-create-0001",
        send_invitations: false,
        title: "Sync",
        invitation_language: "fr",
        start: "2026-08-01T14:00:00",
        attendees: [{ email: "guest@example.com", name: "Guest" }],
      });
      return Response.json(mockMutationEvent);
    });

    const event = await client.calendar.events.create({
      mailbox: ADDRESS,
      operation_key: "calendar-create-0001",
      send_invitations: false,
      title: "Sync",
      invitation_language: "fr",
      start: "2026-08-01T14:00:00",
      attendees: [{ email: "guest@example.com", name: "Guest" }],
    });
    expect(event.id).toBe("evt_1");
    expect(event.invitation_outcomes).toEqual([]);
  });

  test("list forwards mailbox, from, to as query params", async () => {
    const response: PaginatedResponse<CalendarEvent> = {
      data: [mockEvent],
      pagination: { next_cursor: null, has_more: false },
    };
    const client = createClient((input) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/v1/calendar/events");
      expect(url.searchParams.get("mailbox")).toBe(ADDRESS);
      expect(url.searchParams.get("from")).toBe("2026-08-01T00:00:00Z");
      expect(url.searchParams.get("to")).toBe("2026-08-08T00:00:00Z");
      return Response.json(response);
    });

    const result = await client.calendar.events.list({
      mailbox: ADDRESS,
      from: "2026-08-01T00:00:00Z",
      to: "2026-08-08T00:00:00Z",
    });
    expect(result.data[0]?.id).toBe("evt_1");
  });

  test("get forwards the mailbox query param", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      const url = new URL(String(input));
      expect(url.pathname).toBe("/v1/calendar/events/evt%3Aopaque.123");
      expect(url.searchParams.get("mailbox")).toBe(ADDRESS);
      return Response.json(mockEvent);
    });
    const event = await client.calendar.events.get(OPAQUE_EVENT_ID, { mailbox: ADDRESS });
    expect(event.id).toBe("evt_1");
  });

  test("update sends PATCH with the clearing null body", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("PATCH");
      expect(new URL(String(input)).pathname).toBe("/v1/calendar/events/evt%3Aopaque.123");
      expect(JSON.parse(init?.body as string)).toEqual({
        mailbox: ADDRESS,
        operation_key: "calendar-update-0001",
        expected_revision: "a".repeat(64),
        send_guest_updates: false,
        invitation_language: "es",
        location: null,
      });
      return Response.json(mockMutationEvent);
    });
    await client.calendar.events.update(OPAQUE_EVENT_ID, {
      mailbox: ADDRESS,
      operation_key: "calendar-update-0001",
      expected_revision: "a".repeat(64),
      send_guest_updates: false,
      invitation_language: "es",
      location: null,
    });
  });

  test("delete sends DELETE with the mailbox query and returns void", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("DELETE");
      const url = new URL(String(input));
      expect(url.pathname).toBe("/v1/calendar/events/evt%3Aopaque.123");
      expect(url.searchParams.get("mailbox")).toBe(ADDRESS);
      return new Response(null, { status: 204 });
    });
    expect(
      await client.calendar.events.delete(OPAQUE_EVENT_ID, { mailbox: ADDRESS }),
    ).toBeUndefined();
  });
});

describe("Calendar.availability", () => {
  test("joins days into a comma list and forwards params", async () => {
    const availability: CalendarAvailability = {
      object: "calendar_availability",
      mailbox: ADDRESS,
      from: "2026-08-03T00:00:00Z",
      to: "2026-08-04T00:00:00Z",
      duration_minutes: 30,
      timezone: "America/New_York",
      slots: [],
    };
    const client = createClient((input) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/v1/calendar/availability");
      expect(url.searchParams.get("mailbox")).toBe(ADDRESS);
      expect(url.searchParams.get("days")).toBe("1,3,5");
      expect(url.searchParams.get("duration")).toBe("30");
      return Response.json(availability);
    });

    const result = await client.calendar.availability({
      mailbox: ADDRESS,
      from: "2026-08-03T00:00:00Z",
      to: "2026-08-04T00:00:00Z",
      duration: 30,
      timezone: "America/New_York",
      days: [1, 3, 5],
    });
    expect(result.object).toBe("calendar_availability");
  });
});
