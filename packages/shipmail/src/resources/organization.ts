import { ApiResource } from "../resource.js";
import type { MethodOptions } from "../types/common.js";
import type {
  OrganizationAccess,
  OrganizationAiSettings,
  OrganizationSettings,
  UpdateOrganizationAiSettingsParams,
  UpdateOrganizationParams,
} from "../types/organization.js";

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

  /** The organization's name and default time zone. Requires `organization:read`. */
  get(options?: MethodOptions): Promise<OrganizationSettings> {
    return this.client.request<OrganizationSettings>({
      method: "GET",
      path: "/organization",
      methodOptions: options,
    });
  }

  /**
   * Set or clear the default time zone. Requires `organization:write`, and the person behind the
   * credential must be an Owner or Admin.
   */
  update(params: UpdateOrganizationParams, options?: MethodOptions): Promise<OrganizationSettings> {
    return this.client.request<OrganizationSettings>({
      method: "PATCH",
      path: "/organization",
      body: params,
      methodOptions: options,
    });
  }

  /** The organization's AI switches and whether each is in effect. Requires `organization:read`. */
  getAiSettings(options?: MethodOptions): Promise<OrganizationAiSettings> {
    return this.client.request<OrganizationAiSettings>({
      method: "GET",
      path: "/organization/ai-settings",
      methodOptions: options,
    });
  }

  /**
   * Turn AI models on or off; automatic sending is read-only. Requires `organization:write`, and the person
   * behind the credential must be an Owner or Admin.
   */
  updateAiSettings(
    params: UpdateOrganizationAiSettingsParams,
    options?: MethodOptions,
  ): Promise<OrganizationAiSettings> {
    return this.client.request<OrganizationAiSettings>({
      method: "PATCH",
      path: "/organization/ai-settings",
      body: params,
      methodOptions: options,
    });
  }
}
