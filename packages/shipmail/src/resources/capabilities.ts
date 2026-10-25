import { ApiResource } from "../resource.js";
import type { CapabilitiesResponse } from "../types/capabilities.js";
import type { MethodOptions } from "../types/common.js";

export class Capabilities extends ApiResource {
  get(options?: MethodOptions): Promise<CapabilitiesResponse> {
    return this.client.request<CapabilitiesResponse>({
      method: "GET",
      path: "/capabilities",
      methodOptions: options,
    });
  }
}
