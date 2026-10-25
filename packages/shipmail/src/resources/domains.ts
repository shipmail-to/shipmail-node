import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  CreateDomainParams,
  Domain,
  DomainDnsRecordSet,
  DomainHealth,
  DomainSearchResult,
  DomainVerificationResult,
  ListDomainsParams,
  RegisterDomainParams,
  SearchDomainsParams,
  UpdateDomainParams,
} from "../types/domain.js";

export class Domains extends ApiResource {
  create(params: CreateDomainParams, options?: MethodOptions): Promise<Domain> {
    return this.client.request<Domain>({
      method: "POST",
      path: "/domains",
      body: params,
      methodOptions: options,
    });
  }

  list(params?: ListDomainsParams, options?: MethodOptions): Promise<PaginatedResponse<Domain>> {
    return this.client.request<PaginatedResponse<Domain>>({
      method: "GET",
      path: "/domains",
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListDomainsParams, "cursor">): Page<Domain> {
    return new Page<Domain>(this.client, "/domains", {
      limit: params?.limit,
    });
  }

  get(id: string, options?: MethodOptions): Promise<Domain> {
    return this.client.request<Domain>({
      method: "GET",
      path: `/domains/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  getDnsRecords(id: string, options?: MethodOptions): Promise<DomainDnsRecordSet> {
    return this.client.request<DomainDnsRecordSet>({
      method: "GET",
      path: `/domains/${encodeURIComponent(id)}/dns-records`,
      methodOptions: options,
    });
  }

  getHealth(id: string, options?: MethodOptions): Promise<DomainHealth> {
    return this.client.request<DomainHealth>({
      method: "GET",
      path: `/domains/${encodeURIComponent(id)}/health`,
      methodOptions: options,
    });
  }

  update(id: string, params: UpdateDomainParams, options?: MethodOptions): Promise<Domain> {
    return this.client.request<Domain>({
      method: "PATCH",
      path: `/domains/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  delete(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/domains/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  verify(id: string, options?: MethodOptions): Promise<DomainVerificationResult> {
    return this.client.request<DomainVerificationResult>({
      method: "POST",
      path: `/domains/${encodeURIComponent(id)}/verification`,
      methodOptions: options,
    });
  }

  search(
    params: SearchDomainsParams,
    options?: MethodOptions,
  ): Promise<{ readonly results: readonly DomainSearchResult[] }> {
    return this.client.request<{ readonly results: readonly DomainSearchResult[] }>({
      method: "POST",
      path: "/domains/search",
      body: params,
      methodOptions: options,
    });
  }

  register(params: RegisterDomainParams, options?: MethodOptions): Promise<Domain> {
    return this.client.request<Domain>({
      method: "POST",
      path: "/domains/register",
      body: params,
      methodOptions: options,
    });
  }
}
