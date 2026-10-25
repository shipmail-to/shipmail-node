import { ApiResource } from "../resource.js";
import type { MethodOptions } from "../types/common.js";
import type {
  CreateReplyScanParams,
  ListReplyScanResultsParams,
  ReplyScan,
  ReplyScanResults,
} from "../types/reply-scan.js";

export class ReplyScans extends ApiResource {
  create(params: CreateReplyScanParams, options?: MethodOptions): Promise<ReplyScan> {
    return this.client.request<ReplyScan>({
      method: "POST",
      path: "/reply-scans",
      body: params,
      methodOptions: options,
    });
  }

  get(id: string, options?: MethodOptions): Promise<ReplyScan> {
    return this.client.request<ReplyScan>({
      method: "GET",
      path: `/reply-scans/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  listResults(
    id: string,
    params?: ListReplyScanResultsParams,
    options?: MethodOptions,
  ): Promise<ReplyScanResults> {
    return this.client.request<ReplyScanResults>({
      method: "GET",
      path: `/reply-scans/${encodeURIComponent(id)}/results`,
      query: { cursor: params?.cursor, limit: params?.limit },
      methodOptions: options,
    });
  }
}
