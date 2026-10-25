import type { ConferencingProviderId } from "./booking-page.js";
import type { PaginationParams } from "./common.js";

export const BOOKING_LINK_STATUSES = ["open", "booked", "expired", "revoked"] as const;
export type BookingLinkStatus = (typeof BOOKING_LINK_STATUSES)[number];

export type BookingLinkRange = {
  readonly start: string;
  readonly end: string;
};

export type BookingLink = {
  readonly object: "booking_link";
  readonly id: string;
  readonly mailbox: string;
  readonly slug: string;
  readonly url: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly duration_minutes: number;
  readonly timezone: string;
  readonly offered_ranges: readonly BookingLinkRange[] | null;
  readonly source_page_id: string | null;
  readonly buffer_minutes: number;
  readonly minimum_notice_minutes: number;
  readonly conferencing_provider: ConferencingProviderId | null;
  readonly max_bookings: number | null;
  readonly bookings_count: number;
  readonly expires_at: string | null;
  readonly status: BookingLinkStatus;
  readonly created_at: string;
};

export type ListBookingLinksParams = PaginationParams & {
  readonly status?: BookingLinkStatus | undefined;
};

export type CreateBookingLinkParams = {
  readonly name: string;
  readonly mailbox: string;
  readonly duration_minutes: number;
  readonly timezone: string;
  readonly offered_ranges?: readonly BookingLinkRange[] | undefined;
  readonly source_page_id?: string | null | undefined;
  readonly description?: string | null | undefined;
  readonly buffer_minutes?: number | undefined;
  readonly minimum_notice_minutes?: number | undefined;
  readonly conferencing_provider?: ConferencingProviderId | null | undefined;
  readonly max_bookings?: number | null | undefined;
  readonly expires_at?: string | null | undefined;
};

export type UpdateBookingLinkParams = {
  readonly name?: string | undefined;
  readonly mailbox?: string | undefined;
  readonly duration_minutes?: number | undefined;
  readonly timezone?: string | undefined;
  readonly offered_ranges?: readonly BookingLinkRange[] | null | undefined;
  readonly source_page_id?: string | null | undefined;
  readonly description?: string | null | undefined;
  readonly buffer_minutes?: number | undefined;
  readonly minimum_notice_minutes?: number | undefined;
  readonly conferencing_provider?: ConferencingProviderId | null | undefined;
  readonly max_bookings?: number | null | undefined;
  readonly expires_at?: string | null | undefined;
};
