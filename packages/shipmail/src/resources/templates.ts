import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  CreateTemplateParams,
  ListTemplatesParams,
  ListTemplateVersionsParams,
  RenderedTemplate,
  RenderTemplateParams,
  Template,
  TemplateVersion,
  UpdateTemplateParams,
} from "../types/template.js";

export class Templates extends ApiResource {
  create(params: CreateTemplateParams, options?: MethodOptions): Promise<Template> {
    return this.client.request<Template>({
      method: "POST",
      path: "/templates",
      body: params,
      methodOptions: options,
    });
  }

  list(
    params?: ListTemplatesParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<Template>> {
    return this.client.request<PaginatedResponse<Template>>({
      method: "GET",
      path: "/templates",
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListTemplatesParams, "cursor">): Page<Template> {
    return new Page<Template>(this.client, "/templates", {
      limit: params?.limit,
    });
  }

  get(id: string, options?: MethodOptions): Promise<Template> {
    return this.client.request<Template>({
      method: "GET",
      path: `/templates/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  update(id: string, params: UpdateTemplateParams, options?: MethodOptions): Promise<Template> {
    return this.client.request<Template>({
      method: "PATCH",
      path: `/templates/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  delete(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/templates/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  // Publishes the draft as the next version, which sends then use.
  publish(id: string, options?: MethodOptions): Promise<Template> {
    return this.client.request<Template>({
      method: "POST",
      path: `/templates/${encodeURIComponent(id)}/publish`,
      methodOptions: options,
    });
  }

  render(
    id: string,
    params: RenderTemplateParams = {},
    options?: MethodOptions,
  ): Promise<RenderedTemplate> {
    return this.client.request<RenderedTemplate>({
      method: "POST",
      path: `/templates/${encodeURIComponent(id)}/render`,
      body: params,
      methodOptions: options,
    });
  }

  listVersions(
    id: string,
    params?: ListTemplateVersionsParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<TemplateVersion>> {
    return this.client.request<PaginatedResponse<TemplateVersion>>({
      method: "GET",
      path: `/templates/${encodeURIComponent(id)}/versions`,
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  listVersionsAutoPaginating(
    id: string,
    params?: Omit<ListTemplateVersionsParams, "cursor">,
  ): Page<TemplateVersion> {
    return new Page<TemplateVersion>(this.client, `/templates/${encodeURIComponent(id)}/versions`, {
      limit: params?.limit,
    });
  }

  getVersion(id: string, version: number, options?: MethodOptions): Promise<TemplateVersion> {
    return this.client.request<TemplateVersion>({
      method: "GET",
      path: `/templates/${encodeURIComponent(id)}/versions/${version}`,
      methodOptions: options,
    });
  }

  // Copies the version into the draft. Publish to send it again.
  restoreVersion(id: string, version: number, options?: MethodOptions): Promise<Template> {
    return this.client.request<Template>({
      method: "POST",
      path: `/templates/${encodeURIComponent(id)}/versions/${version}/restore`,
      methodOptions: options,
    });
  }
}
