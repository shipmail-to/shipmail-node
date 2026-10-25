import { ConnectionError, mapErrorFromResponse, RateLimitError, ShipmailError } from "./errors.js";
import { Audiences } from "./resources/audiences.js";
import { Automations } from "./resources/automations.js";
import { BookingLinks } from "./resources/booking-links.js";
import { BookingPages } from "./resources/booking-pages.js";
import { Calendar } from "./resources/calendar.js";
import { Capabilities } from "./resources/capabilities.js";
import { Domains } from "./resources/domains.js";
import { Mailboxes } from "./resources/mailboxes.js";
import { Members } from "./resources/members.js";
import { Messages } from "./resources/messages.js";
import { Newsletters } from "./resources/newsletters.js";
import { Organization } from "./resources/organization.js";
import { ReplyScans } from "./resources/reply-scans.js";
import { ScheduledMessages } from "./resources/scheduled-messages.js";
import { Status } from "./resources/status.js";
import { Suppressions } from "./resources/suppressions.js";
import { Threads } from "./resources/threads.js";
import { Webhooks } from "./resources/webhooks.js";
import type { ApiErrorBody, MethodOptions, ShipmailConfig } from "./types/common.js";
import { VERSION } from "./version.js";

const DEFAULT_BASE_URL = "https://shipmail.to/api/v1";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT = 30_000;
const MAX_RETRY_AFTER_MS = 60_000;

function parseRetryAfter(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  if (/^[+-]?[\d.]+$/.test(value.trim())) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function calculateBackoff(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined && Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return retryAfterMs;
  }
  const base = Math.min(2 ** attempt * 500, 8000);
  const jitter = Math.random() * base * 0.5;
  return base + jitter;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj["error"] !== "object" || obj["error"] === null) return false;
  const error = obj["error"] as Record<string, unknown>;
  return typeof error["type"] === "string" && typeof error["message"] === "string";
}

function rawBodyToBlobPart(rawBody: ArrayBuffer | Uint8Array): BlobPart {
  if (rawBody instanceof ArrayBuffer) return rawBody;
  const buffer = new ArrayBuffer(rawBody.byteLength);
  new Uint8Array(buffer).set(rawBody);
  return buffer;
}

export type RequestOptions = {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown | undefined;
  readonly query?: Record<string, string | number | boolean | undefined> | undefined;
  readonly rawBody?: ArrayBuffer | Uint8Array | undefined;
  readonly contentType?: string | undefined;
  readonly methodOptions?: MethodOptions | undefined;
};

/**
 * Client for the Shipmail API. Handles authentication, retries, and resource access.
 */
export class ShipmailClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly timeout: number;
  private readonly fetchFn: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;

  readonly audiences: Audiences;
  readonly automations: Automations;
  readonly bookingLinks: BookingLinks;
  readonly bookingPages: BookingPages;
  readonly capabilities: Capabilities;
  readonly calendar: Calendar;
  readonly domains: Domains;
  readonly mailboxes: Mailboxes;
  readonly members: Members;
  readonly messages: Messages;
  readonly newsletters: Newsletters;
  readonly organization: Organization;
  readonly replyScans: ReplyScans;
  readonly scheduledMessages: ScheduledMessages;
  readonly suppressions: Suppressions;
  readonly threads: Threads;
  readonly webhooks: Webhooks;
  readonly status: Status;

  /**
   * Create a new Shipmail client.
   * @param config - API key string or full configuration object.
   */
  constructor(config: string | ShipmailConfig) {
    if (typeof config === "string") {
      this.apiKey = config;
      this.baseUrl = DEFAULT_BASE_URL;
      this.maxRetries = DEFAULT_MAX_RETRIES;
      this.timeout = DEFAULT_TIMEOUT;
      this.fetchFn = globalThis.fetch;
      this.defaultHeaders = {};
    } else {
      this.apiKey = config.apiKey;
      this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
      this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
      this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
      this.fetchFn = config.fetch ?? globalThis.fetch;
      this.defaultHeaders = config.defaultHeaders ? { ...config.defaultHeaders } : {};
    }

    if (!Number.isSafeInteger(this.maxRetries) || this.maxRetries < 0) {
      throw new RangeError("maxRetries must be a non-negative safe integer");
    }

    this.audiences = new Audiences(this);
    this.automations = new Automations(this);
    this.bookingLinks = new BookingLinks(this);
    this.bookingPages = new BookingPages(this);
    this.capabilities = new Capabilities(this);
    this.calendar = new Calendar(this);
    this.domains = new Domains(this);
    this.mailboxes = new Mailboxes(this);
    this.members = new Members(this);
    this.messages = new Messages(this);
    this.newsletters = new Newsletters(this);
    this.organization = new Organization(this);
    this.replyScans = new ReplyScans(this);
    this.scheduledMessages = new ScheduledMessages(this);
    this.suppressions = new Suppressions(this);
    this.threads = new Threads(this);
    this.webhooks = new Webhooks(this);
    this.status = new Status(this);
  }

  async request<T>(options: RequestOptions): Promise<T> {
    return this.requestWithParser(options, "application/json", async (response) => {
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    });
  }

  async requestBytes(options: RequestOptions): Promise<Uint8Array> {
    return this.requestWithParser(options, "application/octet-stream", async (response) => {
      return new Uint8Array(await response.arrayBuffer());
    });
  }

  private async requestWithParser<T>(
    options: RequestOptions,
    accept: string,
    parseSuccess: (response: Response) => Promise<T>,
  ): Promise<T> {
    const url = this.buildUrl(options.path, options.query);
    let lastError: ShipmailError | undefined;
    const methodOpts = options.methodOptions;
    const retryHeaders = new Headers({ ...this.defaultHeaders, ...methodOpts?.headers });
    const method = options.method.toUpperCase();
    const idempotencyKey = methodOpts?.idempotencyKey || retryHeaders.get("Idempotency-Key");
    const canRetry =
      ["GET", "HEAD", "OPTIONS"].includes(method) ||
      (["POST", "PATCH", "PUT"].includes(method) && Boolean(idempotencyKey?.trim()));
    let retryAfterMs: number | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = calculateBackoff(attempt - 1, retryAfterMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      let response: Response;
      try {
        const headers: Record<string, string> = {
          ...this.defaultHeaders,
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": `shipmail-node/${VERSION}`,
          Accept: accept,
          ...methodOpts?.headers,
        };

        if (methodOpts?.idempotencyKey) {
          headers["Idempotency-Key"] = methodOpts.idempotencyKey;
        }

        let body: BodyInit | null = null;
        if (options.rawBody !== undefined) {
          headers["Content-Type"] = options.contentType ?? "application/octet-stream";
          body = new Blob([rawBodyToBlobPart(options.rawBody)]);
        } else if (options.body !== undefined) {
          headers["Content-Type"] = "application/json";
          body = JSON.stringify(options.body);
        }

        const effectiveTimeout = methodOpts?.timeout ?? this.timeout;

        response = await this.fetchFn(url, {
          method: options.method,
          headers,
          body,
          signal: methodOpts?.signal ?? AbortSignal.timeout(effectiveTimeout),
        });
      } catch (err) {
        lastError = new ConnectionError(err instanceof Error ? err.message : "Request failed");
        if (canRetry && !methodOpts?.signal?.aborted && attempt < this.maxRetries) {
          retryAfterMs = undefined;
          continue;
        }
        throw lastError;
      }

      if (response.ok) {
        return parseSuccess(response);
      }

      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = null;
      }

      if (isApiErrorBody(errorBody)) {
        lastError = mapErrorFromResponse(response.status, errorBody);
      } else {
        lastError = new ShipmailError(`Request failed with status ${response.status}`, {
          status: response.status,
          retryable: isRetryableStatus(response.status),
        });
      }

      retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
      if (retryAfterMs === undefined && lastError instanceof RateLimitError) {
        const seconds = lastError.retryAfter;
        if (typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0) {
          retryAfterMs = seconds * 1000;
        }
      }
      if (
        !canRetry ||
        !lastError.retryable ||
        attempt >= this.maxRetries ||
        (retryAfterMs !== undefined && retryAfterMs > MAX_RETRY_AFTER_MS)
      ) {
        throw lastError;
      }
    }

    throw lastError ?? new ShipmailError("Request failed after retries");
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
}
