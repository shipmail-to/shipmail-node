import type { ShipmailClient } from "../client.js";
import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type {
  AddSubscriberParams,
  AddSubscribersBatchParams,
  AddSubscribersBatchResult,
  Audience,
  AudienceFeed,
  CreateAudienceParams,
  ListAudiencesParams,
  ListSubscribersParams,
  ResubscribeSubscriberParams,
  Subscriber,
  SubscriberResult,
  UpdateAudienceFeedParams,
  UpdateAudienceParams,
  UpdateSubscriberParams,
} from "../types/audience.js";
import type { MethodOptions, PaginatedResponse } from "../types/common.js";
import type {
  CreateWelcomeStepParams,
  DeletedWelcomeStep,
  UpdateWelcomeSequenceParams,
  UpdateWelcomeStepParams,
  WelcomeSequence,
  WelcomeStep,
} from "../types/welcome-sequence.js";

function base(audienceId: string): string {
  return `/audiences/${encodeURIComponent(audienceId)}/subscribers`;
}

function feedBase(audienceId: string): string {
  return `/audiences/${encodeURIComponent(audienceId)}/feed`;
}

class AudienceFeeds extends ApiResource {
  get(audienceId: string, options?: MethodOptions): Promise<AudienceFeed> {
    return this.client.request<AudienceFeed>({
      method: "GET",
      path: feedBase(audienceId),
      methodOptions: options,
    });
  }

  update(
    audienceId: string,
    params: UpdateAudienceFeedParams,
    options?: MethodOptions,
  ): Promise<AudienceFeed> {
    return this.client.request<AudienceFeed>({
      method: "PATCH",
      path: feedBase(audienceId),
      body: params,
      methodOptions: options,
    });
  }

  rotate(audienceId: string, options?: MethodOptions): Promise<AudienceFeed> {
    return this.client.request<AudienceFeed>({
      method: "POST",
      path: `${feedBase(audienceId)}/rotate`,
      methodOptions: options,
    });
  }

  revoke(audienceId: string, options?: MethodOptions): Promise<AudienceFeed> {
    return this.client.request<AudienceFeed>({
      method: "POST",
      path: `${feedBase(audienceId)}/revoke`,
      methodOptions: options,
    });
  }
}

function welcomeBase(audienceId: string): string {
  return `/audiences/${encodeURIComponent(audienceId)}/welcome-sequence`;
}

class WelcomeSequences extends ApiResource {
  get(audienceId: string, options?: MethodOptions): Promise<WelcomeSequence> {
    return this.client.request<WelcomeSequence>({
      method: "GET",
      path: welcomeBase(audienceId),
      methodOptions: options,
    });
  }

  update(
    audienceId: string,
    params: UpdateWelcomeSequenceParams,
    options?: MethodOptions,
  ): Promise<WelcomeSequence> {
    return this.client.request<WelcomeSequence>({
      method: "PATCH",
      path: welcomeBase(audienceId),
      body: params,
      methodOptions: options,
    });
  }

  createStep(
    audienceId: string,
    params: CreateWelcomeStepParams,
    options?: MethodOptions,
  ): Promise<WelcomeStep> {
    return this.client.request<WelcomeStep>({
      method: "POST",
      path: `${welcomeBase(audienceId)}/steps`,
      body: params,
      methodOptions: options,
    });
  }

  updateStep(
    audienceId: string,
    stepId: string,
    params: UpdateWelcomeStepParams,
    options?: MethodOptions,
  ): Promise<WelcomeStep> {
    return this.client.request<WelcomeStep>({
      method: "PATCH",
      path: `${welcomeBase(audienceId)}/steps/${encodeURIComponent(stepId)}`,
      body: params,
      methodOptions: options,
    });
  }

  deleteStep(
    audienceId: string,
    stepId: string,
    options?: MethodOptions,
  ): Promise<DeletedWelcomeStep> {
    return this.client.request<DeletedWelcomeStep>({
      method: "DELETE",
      path: `${welcomeBase(audienceId)}/steps/${encodeURIComponent(stepId)}`,
      methodOptions: options,
    });
  }
}

class Subscribers extends ApiResource {
  add(
    audienceId: string,
    params: AddSubscriberParams,
    options?: MethodOptions,
  ): Promise<SubscriberResult> {
    return this.client.request<SubscriberResult>({
      method: "POST",
      path: base(audienceId),
      body: params,
      methodOptions: options,
    });
  }

  addBatch(
    audienceId: string,
    params: AddSubscribersBatchParams,
    options?: MethodOptions,
  ): Promise<AddSubscribersBatchResult> {
    return this.client.request<AddSubscribersBatchResult>({
      method: "POST",
      path: `${base(audienceId)}/batch`,
      body: params,
      methodOptions: options,
    });
  }

  list(
    audienceId: string,
    params?: ListSubscribersParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<Subscriber>> {
    return this.client.request<PaginatedResponse<Subscriber>>({
      method: "GET",
      path: base(audienceId),
      query: {
        cursor: params?.cursor,
        limit: params?.limit,
        status: params?.status,
        email: params?.email,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(
    audienceId: string,
    params?: Omit<ListSubscribersParams, "cursor">,
  ): Page<Subscriber> {
    return new Page<Subscriber>(this.client, base(audienceId), {
      limit: params?.limit,
      status: params?.status,
      email: params?.email,
    });
  }

  get(audienceId: string, subscriberId: string, options?: MethodOptions): Promise<Subscriber> {
    return this.client.request<Subscriber>({
      method: "GET",
      path: `${base(audienceId)}/${encodeURIComponent(subscriberId)}`,
      methodOptions: options,
    });
  }

  getByEmail(audienceId: string, email: string, options?: MethodOptions): Promise<Subscriber> {
    return this.client.request<Subscriber>({
      method: "GET",
      path: `${base(audienceId)}/by-email/${encodeURIComponent(email)}`,
      methodOptions: options,
    });
  }

  update(
    audienceId: string,
    subscriberId: string,
    params: UpdateSubscriberParams,
    options?: MethodOptions,
  ): Promise<Subscriber> {
    return this.client.request<Subscriber>({
      method: "PATCH",
      path: `${base(audienceId)}/${encodeURIComponent(subscriberId)}`,
      body: params,
      methodOptions: options,
    });
  }

  unsubscribe(
    audienceId: string,
    subscriberId: string,
    options?: MethodOptions,
  ): Promise<Subscriber> {
    return this.client.request<Subscriber>({
      method: "POST",
      path: `${base(audienceId)}/${encodeURIComponent(subscriberId)}/unsubscribe`,
      methodOptions: options,
    });
  }

  resubscribe(
    audienceId: string,
    subscriberId: string,
    params: ResubscribeSubscriberParams,
    options?: MethodOptions,
  ): Promise<Subscriber> {
    return this.client.request<Subscriber>({
      method: "POST",
      path: `${base(audienceId)}/${encodeURIComponent(subscriberId)}/resubscribe`,
      body: params,
      methodOptions: options,
    });
  }

  remove(audienceId: string, subscriberId: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `${base(audienceId)}/${encodeURIComponent(subscriberId)}`,
      methodOptions: options,
    });
  }
}

export class Audiences extends ApiResource {
  readonly feeds: AudienceFeeds;
  readonly subscribers: Subscribers;
  readonly welcomeSequence: WelcomeSequences;

  constructor(client: ShipmailClient) {
    super(client);
    this.feeds = new AudienceFeeds(client);
    this.subscribers = new Subscribers(client);
    this.welcomeSequence = new WelcomeSequences(client);
  }

  create(params: CreateAudienceParams, options?: MethodOptions): Promise<Audience> {
    return this.client.request<Audience>({
      method: "POST",
      path: "/audiences",
      body: params,
      methodOptions: options,
    });
  }

  list(
    params?: ListAudiencesParams,
    options?: MethodOptions,
  ): Promise<PaginatedResponse<Audience>> {
    return this.client.request<PaginatedResponse<Audience>>({
      method: "GET",
      path: "/audiences",
      query: { cursor: params?.cursor, limit: params?.limit },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListAudiencesParams, "cursor">): Page<Audience> {
    return new Page<Audience>(this.client, "/audiences", { limit: params?.limit });
  }

  get(id: string, options?: MethodOptions): Promise<Audience> {
    return this.client.request<Audience>({
      method: "GET",
      path: `/audiences/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  update(id: string, params: UpdateAudienceParams, options?: MethodOptions): Promise<Audience> {
    return this.client.request<Audience>({
      method: "PATCH",
      path: `/audiences/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  delete(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/audiences/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }
}
