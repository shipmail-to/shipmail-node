import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  CreateCustomerParams,
  Customer,
  CustomerField,
  ListCustomersParams,
  ServiceLevel,
  UpdateCustomerParams,
  UpsertCustomerParams,
} from "../types/customer.js";

export class Customers extends ApiResource {
  create(params: CreateCustomerParams, options?: MethodOptions): Promise<Customer> {
    return this.client.request<Customer>({
      method: "POST",
      path: "/customers",
      body: params,
      methodOptions: options,
    });
  }

  get(id: string, options?: MethodOptions): Promise<Customer> {
    return this.client.request<Customer>({
      method: "GET",
      path: `/customers/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  list(
    params?: ListCustomersParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<Customer>> {
    return this.client.request<PaginatedResponse<Customer>>({
      method: "GET",
      path: "/customers",
      query: { ...params },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListCustomersParams, "cursor">): Page<Customer> {
    return new Page<Customer>(this.client, "/customers", { ...params });
  }

  update(id: string, params: UpdateCustomerParams, options?: MethodOptions): Promise<Customer> {
    return this.client.request<Customer>({
      method: "PATCH",
      path: `/customers/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  remove(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/customers/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  // Creates or updates the customer a CRM or billing system knows by `source` and `externalId`.
  // An address or domain owned by another customer is refused with `identifier_conflict`.
  upsertByExternalId(
    source: string,
    externalId: string,
    params: UpsertCustomerParams,
    options?: MethodOptions,
  ): Promise<Customer> {
    return this.client.request<Customer>({
      method: "PUT",
      path: `/customers/external/${encodeURIComponent(source)}/${encodeURIComponent(externalId)}`,
      body: params,
      methodOptions: options,
    });
  }

  listServiceLevels(options?: MethodOptions): Promise<{ readonly data: readonly ServiceLevel[] }> {
    return this.client.request<{ readonly data: readonly ServiceLevel[] }>({
      method: "GET",
      path: "/service-levels",
      methodOptions: options,
    });
  }

  listFields(options?: MethodOptions): Promise<{ readonly data: readonly CustomerField[] }> {
    return this.client.request<{ readonly data: readonly CustomerField[] }>({
      method: "GET",
      path: "/customer-fields",
      methodOptions: options,
    });
  }
}
