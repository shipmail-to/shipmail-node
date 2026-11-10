import { ApiResource } from "../resource.js";
import type {
  Automation,
  AutomationRun,
  AutomationTest,
  CreateAutomationParams,
  ListAutomationsResponse,
  TestAutomationParams,
  UpdateAutomationParams,
} from "../types/automation.js";
import type { MethodOptions } from "../types/common.js";

export class Automations extends ApiResource {
  list(options?: MethodOptions): Promise<ListAutomationsResponse> {
    return this.client.request<ListAutomationsResponse>({
      method: "GET",
      path: "/automations",
      methodOptions: options,
    });
  }

  create(params: CreateAutomationParams, options?: MethodOptions): Promise<Automation> {
    return this.client.request<Automation>({
      method: "POST",
      path: "/automations",
      body: params,
      methodOptions: options,
    });
  }

  get(id: string, options?: MethodOptions): Promise<Automation> {
    return this.client.request<Automation>({
      method: "GET",
      path: `/automations/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  update(id: string, params: UpdateAutomationParams, options?: MethodOptions): Promise<Automation> {
    return this.client.request<Automation>({
      method: "PATCH",
      path: `/automations/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  /**
   * A dry run on one stored inbox message: which conditions match and which actions would run.
   * Needs `automations:read` and `messages:read`. A semantic condition calls the classifier only
   * when every other condition matched, and that call counts against the AI budget.
   */
  test(id: string, params: TestAutomationParams, options?: MethodOptions): Promise<AutomationTest> {
    return this.client.request<AutomationTest>({
      method: "POST",
      path: `/automations/${encodeURIComponent(id)}/test`,
      body: params,
      methodOptions: options,
    });
  }

  run(id: string, options?: MethodOptions): Promise<AutomationRun> {
    return this.client.request<AutomationRun>({
      method: "POST",
      path: `/automations/${encodeURIComponent(id)}/run`,
      methodOptions: options,
    });
  }
}
