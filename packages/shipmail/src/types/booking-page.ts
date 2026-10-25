import type { PaginationParams } from "./common.js";

export const CONFERENCING_PROVIDER_IDS = ["zoom", "google_meet"] as const;
export type ConferencingProviderId = (typeof CONFERENCING_PROVIDER_IDS)[number];

export type BookingPage = {
  readonly object: "booking_page";
  readonly id: string;
  readonly mailbox: string;
  readonly slug: string;
  readonly url: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly duration_minutes: number;
  readonly availability_days: readonly number[];
  readonly window_start_minutes: number;
  readonly window_end_minutes: number;
  readonly timezone: string;
  readonly buffer_minutes: number;
  readonly minimum_notice_minutes: number;
  readonly max_advance_days: number;
  readonly conferencing_provider: ConferencingProviderId | null;
  readonly active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export type ListBookingPagesParams = PaginationParams;

export type CreateBookingPageParams = {
  readonly name: string;
  readonly mailbox: string;
  readonly slug: string;
  readonly duration_minutes: number;
  readonly availability_days: readonly number[];
  readonly window_start_minutes: number;
  readonly window_end_minutes: number;
  readonly timezone: string;
  readonly description?: string | null | undefined;
  readonly buffer_minutes?: number | undefined;
  readonly minimum_notice_minutes?: number | undefined;
  readonly max_advance_days?: number | undefined;
  readonly conferencing_provider?: ConferencingProviderId | null | undefined;
  readonly active?: boolean | undefined;
};

export type UpdateBookingPageParams = {
  readonly name?: string | undefined;
  readonly mailbox?: string | undefined;
  readonly slug?: string | undefined;
  readonly duration_minutes?: number | undefined;
  readonly availability_days?: readonly number[] | undefined;
  readonly window_start_minutes?: number | undefined;
  readonly window_end_minutes?: number | undefined;
  readonly timezone?: string | undefined;
  readonly description?: string | null | undefined;
  readonly buffer_minutes?: number | undefined;
  readonly minimum_notice_minutes?: number | undefined;
  readonly max_advance_days?: number | undefined;
  readonly conferencing_provider?: ConferencingProviderId | null | undefined;
  readonly active?: boolean | undefined;
};
