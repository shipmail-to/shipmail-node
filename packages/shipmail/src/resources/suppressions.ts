import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  CreateSuppressionParams,
  ListSuppressionsParams,
  NewsletterOptOutLift,
  ResubscribeNewsletterOptOutParams,
  Suppression,
  SuppressionEntry,
  SuppressionRemoval,
} from "../types/suppression.js";

export class Suppressions extends ApiResource {
  // Adds a manual suppression. An existing active entry is returned, widened to `all` if asked.
  create(params: CreateSuppressionParams, options?: MethodOptions): Promise<Suppression> {
    return this.client.request<Suppression>({
      method: "POST",
      path: "/suppressions",
      body: params,
      methodOptions: options,
    });
  }

  // Lists suppressions and newsletter opt-outs together, newest first.
  list(
    params?: ListSuppressionsParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<SuppressionEntry>> {
    return this.client.request<PaginatedResponse<SuppressionEntry>>({
      method: "GET",
      path: "/suppressions",
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
        scope: params?.scope,
        reason: params?.reason,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListSuppressionsParams, "cursor">): Page<SuppressionEntry> {
    return new Page<SuppressionEntry>(this.client, "/suppressions", {
      limit: params?.limit,
      scope: params?.scope,
      reason: params?.reason,
    });
  }

  // Removes the address-health suppression, never a newsletter opt-out. Resolves to undefined when
  // nothing else blocks the address, or to a SuppressionRemoval when an opt-out remains. Throws
  // ConflictError (details code `consent_opt_out`) when the address only has an opt-out: lift it
  // with `resubscribe` instead.
  remove(email: string, options?: MethodOptions): Promise<SuppressionRemoval | undefined> {
    return this.client.request<SuppressionRemoval | undefined>({
      method: "DELETE",
      path: `/suppressions/${encodeURIComponent(email)}`,
      methodOptions: options,
    });
  }

  // Lifts the organization-wide newsletter opt-out of an address, which may be in no audience,
  // with fresh consent. Audience statuses do not change: resubscribe an unsubscribed subscriber in
  // their audience. Throws ConflictError while a suppression blocks newsletters to the address,
  // and NotFoundError when it has no opt-out.
  resubscribe(
    email: string,
    params: ResubscribeNewsletterOptOutParams,
    options?: MethodOptions,
  ): Promise<NewsletterOptOutLift> {
    return this.client.request<NewsletterOptOutLift>({
      method: "POST",
      path: `/newsletter-opt-outs/${encodeURIComponent(email)}/resubscribe`,
      body: params,
      methodOptions: options,
    });
  }
}
