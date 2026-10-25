import type { PaginationParams } from "./common.js";

export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled";
export type CalendarFreeBusyStatus = "free" | "busy";
export type CalendarEventPrivacy = "public" | "private" | "secret";
export type CalendarInvitationLanguage = "en" | "fr" | "es";
export type RecurrenceFrequency =
  | "yearly"
  | "monthly"
  | "weekly"
  | "daily"
  | "hourly"
  | "minutely"
  | "secondly";
export type Weekday = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";

export type RecurrenceNDay = {
  readonly day: Weekday;
  readonly nth_of_period?: number | undefined;
};

export type Recurrence = {
  readonly frequency: RecurrenceFrequency;
  readonly interval?: number | undefined;
  readonly count?: number | undefined;
  readonly until?: string | undefined;
  readonly by_day?: readonly RecurrenceNDay[] | undefined;
};

export type Reminder = {
  readonly minutes_before: number;
};

export type CalendarAttendeeInput = {
  readonly email: string;
  readonly name?: string | undefined;
};

export type CalendarPerson = {
  readonly email: string;
  readonly name: string | null;
};

export type CalendarAttendee = CalendarPerson & {
  readonly status: "needs-action" | "accepted" | "declined" | "tentative";
};

export type CalendarInvitationOutcome = {
  readonly recipient: string;
  readonly status: "sent" | "failed" | "unknown";
};

export type CalendarEvent = {
  readonly object: "calendar_event";
  readonly id: string;
  /** Content revision used as expected_revision for safe updates. */
  readonly revision: string;
  readonly mailbox: string;
  readonly calendar_id: string | null;
  readonly uid: string | null;
  readonly title: string | null;
  readonly invitation_language: CalendarInvitationLanguage;
  readonly description: string | null;
  readonly location: string | null;
  readonly video_url: string | null;
  readonly all_day: boolean;
  readonly start: string;
  readonly end: string;
  readonly timezone: string | null;
  readonly duration: string | null;
  readonly status: CalendarEventStatus | null;
  readonly free_busy_status: CalendarFreeBusyStatus | null;
  readonly privacy: CalendarEventPrivacy | null;
  readonly color: string | null;
  readonly recurrence: Recurrence | null;
  readonly recurrence_id: string | null;
  readonly reminders: readonly Reminder[];
  readonly organizer: CalendarPerson | null;
  readonly attendees: readonly CalendarAttendee[];
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

export type CalendarEventMutationResult = CalendarEvent & {
  readonly invitation_outcomes: readonly CalendarInvitationOutcome[];
  /** Compatibility list containing failed and unknown recipients. */
  readonly invitation_failures: readonly string[];
};

export type ListCalendarEventsParams = PaginationParams & {
  readonly mailbox: string;
  readonly from: string;
  readonly to: string;
  readonly expand?: boolean | undefined;
  readonly calendar_id?: string | undefined;
};

export type GetCalendarEventParams = {
  readonly mailbox: string;
};

export type DeleteCalendarEventParams = {
  readonly mailbox: string;
};

export type CreateCalendarEventParams = {
  readonly mailbox: string;
  /** Stable retry identity for this exact create payload. */
  readonly operation_key?: string | undefined;
  /** Whether attendees should receive invitations. Defaults to true. */
  readonly send_invitations?: boolean | undefined;
  readonly calendar_id?: string | undefined;
  readonly title: string;
  readonly invitation_language?: CalendarInvitationLanguage | undefined;
  readonly start: string;
  readonly description?: string | undefined;
  readonly timezone?: string | undefined;
  readonly duration?: string | undefined;
  readonly all_day?: boolean | undefined;
  readonly location?: string | undefined;
  readonly video_url?: string | undefined;
  readonly color?: string | undefined;
  readonly status?: CalendarEventStatus | undefined;
  readonly free_busy_status?: CalendarFreeBusyStatus | undefined;
  readonly privacy?: CalendarEventPrivacy | undefined;
  readonly recurrence?: Recurrence | undefined;
  readonly reminders?: readonly Reminder[] | undefined;
  readonly attendees?: readonly CalendarAttendeeInput[] | undefined;
};

export type UpdateCalendarEventParams = {
  readonly mailbox: string;
  /** Stable retry identity for this exact update payload. */
  readonly operation_key?: string | undefined;
  /** Revision originally read by the editor; rejects stale guest-visible writes. */
  readonly expected_revision?: string | undefined;
  /** Whether attendees should receive scheduling updates. Defaults to true. */
  readonly send_guest_updates?: boolean | undefined;
  readonly title?: string | undefined;
  readonly invitation_language?: CalendarInvitationLanguage | undefined;
  readonly description?: string | null | undefined;
  readonly start?: string | undefined;
  readonly timezone?: string | null | undefined;
  readonly duration?: string | undefined;
  readonly all_day?: boolean | undefined;
  readonly location?: string | null | undefined;
  readonly video_url?: string | null | undefined;
  readonly color?: string | undefined;
  readonly status?: CalendarEventStatus | undefined;
  readonly free_busy_status?: CalendarFreeBusyStatus | undefined;
  readonly privacy?: CalendarEventPrivacy | undefined;
  readonly recurrence?: Recurrence | null | undefined;
  readonly reminders?: readonly Reminder[] | null | undefined;
  readonly attendees?: readonly CalendarAttendeeInput[] | undefined;
};

export type CalendarAvailabilitySlot = {
  readonly start: string;
  readonly end: string;
};

export type CalendarAvailability = {
  readonly object: "calendar_availability";
  readonly mailbox: string;
  readonly from: string;
  readonly to: string;
  readonly duration_minutes: number;
  readonly timezone: string;
  readonly slots: readonly CalendarAvailabilitySlot[];
};

export type CalendarAvailabilityParams = {
  readonly mailbox: string;
  readonly from: string;
  readonly to: string;
  readonly duration?: number | undefined;
  readonly interval?: number | undefined;
  readonly timezone?: string | undefined;
  readonly days?: readonly number[] | undefined;
  readonly window_start?: number | undefined;
  readonly window_end?: number | undefined;
  readonly buffer?: number | undefined;
  readonly minimum_notice?: number | undefined;
};
