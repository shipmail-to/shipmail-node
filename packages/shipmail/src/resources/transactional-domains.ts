import { ApiResource } from "../resource.js";
import type { MethodOptions } from "../types/common.js";
import type {
  CreateTransactionalDomainParams,
  TransactionalDomain,
  TransactionalDomainList,
} from "../types/transactional.js";

export class TransactionalDomains extends ApiResource {
  list(options?: MethodOptions): Promise<TransactionalDomainList> {
    return this.client.request<TransactionalDomainList>({
      method: "GET",
      path: "/transactional-domains",
      methodOptions: options,
    });
  }

  // Calling it again with the same values resumes a setup that stopped part way.
  create(
    params: CreateTransactionalDomainParams,
    options?: MethodOptions,
  ): Promise<TransactionalDomain> {
    return this.client.request<TransactionalDomain>({
      method: "POST",
      path: "/transactional-domains",
      body: params,
      methodOptions: options,
    });
  }

  get(id: string, options?: MethodOptions): Promise<TransactionalDomain> {
    return this.client.request<TransactionalDomain>({
      method: "GET",
      path: `/transactional-domains/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  verify(id: string, options?: MethodOptions): Promise<TransactionalDomain> {
    return this.client.request<TransactionalDomain>({
      method: "POST",
      path: `/transactional-domains/${encodeURIComponent(id)}/verify`,
      methodOptions: options,
    });
  }

  delete(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/transactional-domains/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }
}
