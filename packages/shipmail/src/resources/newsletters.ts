import type { ShipmailClient } from "../client.js";
import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  CreateNewsletterFromChangelogParams,
  CreateNewsletterParams,
  ListNewsletterAssetsParams,
  ListNewsletterDomainsParams,
  ListNewsletterSenderIdentitiesParams,
  ListNewslettersParams,
  Newsletter,
  NewsletterAsset,
  NewsletterAssetListResponse,
  NewsletterAssetUpload,
  NewsletterDomain,
  NewsletterPreflight,
  NewsletterPreview,
  NewsletterSenderIdentity,
  NewsletterTestSend,
  PrepareNewsletterAssetUploadParams,
  RegisterNewsletterAssetFromUrlParams,
  ScheduleNewsletterParams,
  SendNewsletterTestParams,
  SendNewsletterToMoreParams,
  UpdateNewsletterParams,
  UploadNewsletterAssetParams,
} from "../types/newsletter.js";

function path(id: string): string {
  return `/newsletters/${encodeURIComponent(id)}`;
}

class NewsletterDomains extends ApiResource {
  list(
    params?: ListNewsletterDomainsParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<NewsletterDomain>> {
    return this.client.request<PaginatedResponse<NewsletterDomain>>({
      method: "GET",
      path: "/newsletter-domains",
      query: { cursor: params?.cursor, limit: params?.limit },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListNewsletterDomainsParams, "cursor">): Page<NewsletterDomain> {
    return new Page<NewsletterDomain>(this.client, "/newsletter-domains", { limit: params?.limit });
  }
}

class NewsletterSenderIdentities extends ApiResource {
  list(
    params?: ListNewsletterSenderIdentitiesParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<NewsletterSenderIdentity>> {
    return this.client.request<PaginatedResponse<NewsletterSenderIdentity>>({
      method: "GET",
      path: "/newsletter-sender-identities",
      query: { cursor: params?.cursor, limit: params?.limit },
      methodOptions: options,
    });
  }

  listAutoPaginating(
    params?: Omit<ListNewsletterSenderIdentitiesParams, "cursor">,
  ): Page<NewsletterSenderIdentity> {
    return new Page<NewsletterSenderIdentity>(this.client, "/newsletter-sender-identities", {
      limit: params?.limit,
    });
  }
}

class NewsletterAssets extends ApiResource {
  list(
    params?: ListNewsletterAssetsParams,
    options?: MethodOptions,
  ): Promise<NewsletterAssetListResponse> {
    return this.client.request<NewsletterAssetListResponse>({
      method: "GET",
      path: "/newsletter-assets",
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
        kind: params?.kind,
        q: params?.q,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListNewsletterAssetsParams, "cursor">): Page<NewsletterAsset> {
    return new Page<NewsletterAsset>(this.client, "/newsletter-assets", {
      limit: params?.limit,
      kind: params?.kind,
      q: params?.q,
    });
  }

  upload(params: UploadNewsletterAssetParams, options?: MethodOptions): Promise<NewsletterAsset> {
    return this.client.request<NewsletterAsset>({
      method: "POST",
      path: "/newsletter-assets",
      query: { filename: params.filename },
      rawBody: params.data,
      contentType: params.content_type,
      methodOptions: options,
    });
  }

  prepareUpload(
    params: PrepareNewsletterAssetUploadParams,
    options?: MethodOptions,
  ): Promise<NewsletterAssetUpload> {
    return this.client.request<NewsletterAssetUpload>({
      method: "POST",
      path: "/newsletter-assets/upload-tokens",
      body: params,
      methodOptions: options,
    });
  }

  registerFromUrl(
    params: RegisterNewsletterAssetFromUrlParams,
    options?: MethodOptions,
  ): Promise<NewsletterAsset> {
    return this.client.request<NewsletterAsset>({
      method: "POST",
      path: "/newsletter-assets",
      body: params,
      methodOptions: options,
    });
  }
}

export class Newsletters extends ApiResource {
  readonly domains: NewsletterDomains;
  readonly senderIdentities: NewsletterSenderIdentities;
  readonly assets: NewsletterAssets;

  constructor(client: ShipmailClient) {
    super(client);
    this.domains = new NewsletterDomains(client);
    this.senderIdentities = new NewsletterSenderIdentities(client);
    this.assets = new NewsletterAssets(client);
  }

  create(params: CreateNewsletterParams, options?: MethodOptions): Promise<Newsletter> {
    return this.client.request<Newsletter>({
      method: "POST",
      path: "/newsletters",
      body: params,
      methodOptions: options,
    });
  }

  createFromChangelog(
    params: CreateNewsletterFromChangelogParams,
    options?: MethodOptions,
  ): Promise<Newsletter> {
    return this.client.request<Newsletter>({
      method: "POST",
      path: "/newsletters/from-changelog",
      body: params,
      methodOptions: options,
    });
  }

  list(
    params?: ListNewslettersParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<Newsletter>> {
    return this.client.request<PaginatedResponse<Newsletter>>({
      method: "GET",
      path: "/newsletters",
      query: { cursor: params?.cursor, limit: params?.limit },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListNewslettersParams, "cursor">): Page<Newsletter> {
    return new Page<Newsletter>(this.client, "/newsletters", { limit: params?.limit });
  }

  get(id: string, options?: MethodOptions): Promise<Newsletter> {
    return this.client.request<Newsletter>({
      method: "GET",
      path: path(id),
      methodOptions: options,
    });
  }

  update(id: string, params: UpdateNewsletterParams, options?: MethodOptions): Promise<Newsletter> {
    return this.client.request<Newsletter>({
      method: "PATCH",
      path: path(id),
      body: params,
      methodOptions: options,
    });
  }

  preflight(id: string, options?: MethodOptions): Promise<NewsletterPreflight> {
    return this.client.request<NewsletterPreflight>({
      method: "POST",
      path: `${path(id)}/preflight`,
      methodOptions: options,
    });
  }

  preview(id: string, options?: MethodOptions): Promise<NewsletterPreview> {
    return this.client.request<NewsletterPreview>({
      method: "POST",
      path: `${path(id)}/preview`,
      methodOptions: options,
    });
  }

  sendTest(
    id: string,
    params: SendNewsletterTestParams,
    options?: MethodOptions,
  ): Promise<NewsletterTestSend> {
    return this.client.request<NewsletterTestSend>({
      method: "POST",
      path: `${path(id)}/test-send`,
      body: params,
      methodOptions: options,
    });
  }

  schedule(
    id: string,
    params: ScheduleNewsletterParams,
    options?: MethodOptions,
  ): Promise<Newsletter> {
    return this.client.request<Newsletter>({
      method: "POST",
      path: `${path(id)}/schedule`,
      body: params,
      methodOptions: options,
    });
  }

  cancel(id: string, options?: MethodOptions): Promise<Newsletter> {
    return this.client.request<Newsletter>({
      method: "POST",
      path: `${path(id)}/cancel`,
      methodOptions: options,
    });
  }

  resume(id: string, options?: MethodOptions): Promise<Newsletter> {
    return this.client.request<Newsletter>({
      method: "POST",
      path: `${path(id)}/resume`,
      methodOptions: options,
    });
  }

  /** Sends a newsletter scheduled with a limit to the next held subscribers, or to all of them. */
  sendToMore(
    id: string,
    params: SendNewsletterToMoreParams = {},
    options?: MethodOptions,
  ): Promise<Newsletter> {
    return this.client.request<Newsletter>({
      method: "POST",
      path: `${path(id)}/send-more`,
      body: params,
      methodOptions: options,
    });
  }
}
