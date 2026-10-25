import type { ShipmailClient } from "../client.js";
import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type {
  CalendarAvailability,
  CalendarAvailabilityParams,
  CalendarEvent,
  CalendarEventMutationResult,
  CreateCalendarEventParams,
  DeleteCalendarEventParams,
  GetCalendarEventParams,
  ListCalendarEventsParams,
  UpdateCalendarEventParams,
} from "../types/calendar.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";

class CalendarEvents extends ApiResource {
  create(
    params: CreateCalendarEventParams,
    options?: MethodOptions,
  ): Promise<CalendarEventMutationResult> {
    return this.client.request<CalendarEventMutationResult>({
      method: "POST",
      path: "/calendar/events",
      body: params,
      methodOptions: options,
    });
  }

  list(
    params: ListCalendarEventsParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<CalendarEvent>> {
    return this.client.request<PaginatedResponse<CalendarEvent>>({
      method: "GET",
      path: "/calendar/events",
      query: {
        mailbox: params.mailbox,
        from: params.from,
        to: params.to,
        expand: params.expand,
        calendar_id: params.calendar_id,
        cursor: params.cursor,
        limit: params.limit,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params: Omit<ListCalendarEventsParams, "cursor">): Page<CalendarEvent> {
    return new Page<CalendarEvent>(this.client, "/calendar/events", {
      mailbox: params.mailbox,
      from: params.from,
      to: params.to,
      expand: params.expand,
      calendar_id: params.calendar_id,
      limit: params.limit,
    });
  }

  get(id: string, params: GetCalendarEventParams, options?: MethodOptions): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>({
      method: "GET",
      path: `/calendar/events/${encodeURIComponent(id)}`,
      query: { mailbox: params.mailbox },
      methodOptions: options,
    });
  }

  update(
    id: string,
    params: UpdateCalendarEventParams,
    options?: MethodOptions,
  ): Promise<CalendarEventMutationResult> {
    return this.client.request<CalendarEventMutationResult>({
      method: "PATCH",
      path: `/calendar/events/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  delete(id: string, params: DeleteCalendarEventParams, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/calendar/events/${encodeURIComponent(id)}`,
      query: { mailbox: params.mailbox },
      methodOptions: options,
    });
  }
}

export class Calendar extends ApiResource {
  readonly events: CalendarEvents;

  constructor(client: ShipmailClient) {
    super(client);
    this.events = new CalendarEvents(client);
  }

  availability(
    params: CalendarAvailabilityParams,
    options?: MethodOptions,
  ): Promise<CalendarAvailability> {
    return this.client.request<CalendarAvailability>({
      method: "GET",
      path: "/calendar/availability",
      query: {
        mailbox: params.mailbox,
        from: params.from,
        to: params.to,
        duration: params.duration,
        interval: params.interval,
        timezone: params.timezone,
        days: params.days ? params.days.join(",") : undefined,
        window_start: params.window_start,
        window_end: params.window_end,
        buffer: params.buffer,
        minimum_notice: params.minimum_notice,
      },
      methodOptions: options,
    });
  }
}
