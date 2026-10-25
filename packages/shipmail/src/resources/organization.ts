import { ApiResource } from "../resource.js";
import type { MethodOptions } from "../types/common.js";
import type { OrganizationAccess } from "../types/organization.js";

export class Organization extends ApiResource {
  /**
   * Whether the credential's organization can create mailboxes now, with its plan, trial and
   * mailbox capacity. Poll it after the owner pays: access appears once Shipmail has recorded the
   * payment.
   */
  access(options?: MethodOptions): Promise<OrganizationAccess> {
    return this.client.request<OrganizationAccess>({
      method: "GET",
      path: "/organization/access",
      methodOptions: options,
    });
  }
}
