import { ApiResource } from "../resource.js";
import type { MethodOptions, StatusResponse } from "../types/common.js";

export class Status extends ApiResource {
  get(options?: MethodOptions): Promise<StatusResponse> {
    return this.client.request<StatusResponse>({
      method: "GET",
      path: "/status",
      methodOptions: options,
    });
  }
}
