#!/usr/bin/env node

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { env as processEnv, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import {
  type AutomationDefinition,
  type AutomationStatus,
  BOOKING_LINK_STATUSES,
  type BookingLinkRange,
  type CalendarAvailabilityParams,
  CONFERENCING_PROVIDER_IDS,
  type ConferencingProviderId,
  type CreateBookingLinkParams,
  type CreateBookingPageParams,
  type CreateCalendarEventParams,
  type CreateMailboxAppPasswordParams,
  type CreateNewsletterParams,
  type CreateTemplateParams,
  type DomainHealth,
  type DomainHealthProvider,
  type EmailRecipientInput,
  type InviteMemberParams,
  type ListCalendarEventsParams,
  type ListDeliveriesParams,
  type ListSubscribersParams,
  type NewsletterAssetContentType,
  type NewsletterAssetUpload,
  type NewsletterBlock,
  ReconciliationRequiredError,
  type Reminder,
  type ReplyToMessageParams,
  type SendMessageParams,
  ShipmailClient,
  type ShipmailConfig,
  ShipmailError,
  type UpdateAudienceFeedParams,
  type UpdateAutomationParams,
  type UpdateBookingLinkParams,
  type UpdateBookingPageParams,
  type UpdateCalendarEventParams,
  type UpdateMailboxDeliveryRoutingParams,
  type UpdateNewsletterParams,
  type UpdateScheduledMessageParams,
  type UpdateTemplateParams,
  type UpdateWebhookParams,
  type UpdateWelcomeStepParams,
  ValidationError,
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from "shipmail";

import {
  type CredentialStore,
  defaultCredentialStore,
  runCommand,
  type StoredLogin,
} from "./credentials";
import {
  login,
  LOGIN_TIMEOUT_MS,
  OAuthError,
  openInBrowser,
  refreshLogin,
  revokeToken,
} from "./oauth";
import { VERSION as CLI_VERSION } from "./version";

type Output = {
  write(chunk: string): void;
};

type CliEnv = Record<string, string | undefined>;

type RunCliOptions = {
  readonly env?: CliEnv | undefined;
  readonly stdout?: Output | undefined;
  readonly stderr?: Output | undefined;
  readonly fetch?: typeof fetch | undefined;
  readonly credentialStore?: CredentialStore | undefined;
  readonly openBrowser?: ((url: string) => void) | undefined;
  readonly loginTimeoutMs?: number | undefined;
};

type Credential =
  | { readonly kind: "api-key"; readonly token: string }
  | { readonly kind: "oauth"; readonly token: string; readonly organizationId: string | undefined };

type ParsedArgs = {
  readonly positional: readonly string[];
  readonly options: Readonly<Record<string, string | boolean | readonly string[]>>;
};

const DEFAULT_BASE_URL = "https://shipmail.to/api/v1";
const ALLOWED_BASE_URL_HOSTS: readonly string[] = ["shipmail.to"];
const RAW_REQUEST_TIMEOUT_MS = 30_000;
const NEWSLETTER_BLOCK_TYPES: readonly string[] = [
  "heading",
  "paragraph",
  "list",
  "callout",
  "button",
  "image",
  "video",
  "columns",
  "link_list",
  "quote",
  "divider",
  "spacer",
  "code",
  "custom_html",
] satisfies readonly NewsletterBlock["type"][];
const WEBHOOK_EVENT_TYPE_SET = new Set<string>(WEBHOOK_EVENT_TYPES);

class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

class CliHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Request failed with status ${status}`);
    this.name = "CliHttpError";
  }
}

function parseCliArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const options: Record<string, string | boolean | string[]> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === undefined) break;
    if (token === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (!token.startsWith("--") || token === "--") {
      positional.push(token);
      continue;
    }

    const raw = token.slice(2);
    const inlineIndex = raw.indexOf("=");
    const key = inlineIndex >= 0 ? raw.slice(0, inlineIndex) : raw;
    const inlineValue = inlineIndex >= 0 ? raw.slice(inlineIndex + 1) : undefined;
    const next = argv[i + 1];
    let value: string | boolean;

    if (inlineValue !== undefined) {
      value = inlineValue;
    } else if (next !== undefined && !next.startsWith("--")) {
      value = next;
      i += 1;
    } else {
      value = true;
    }

    const existing = options[key];
    if (existing === undefined) {
      options[key] = value;
    } else if (Array.isArray(existing)) {
      options[key] = [...existing, String(value)];
    } else {
      options[key] = [String(existing), String(value)];
    }
  }

  return { positional, options };
}

function optionValue(
  options: ParsedArgs["options"],
  key: string,
): string | boolean | readonly string[] | undefined {
  return options[key];
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value);
}

function getString(options: ParsedArgs["options"], key: string): string | undefined {
  const value = optionValue(options, key);
  if (value === undefined) return undefined;
  if (isStringArray(value)) return value.at(-1);
  if (typeof value === "boolean") return value ? "true" : "false";
  return value;
}

function getRequiredString(options: ParsedArgs["options"], key: string): string {
  const value = getString(options, key);
  if (!value) throw new CliUsageError(`Missing --${key}.`);
  return value;
}

function getNumber(options: ParsedArgs["options"], key: string): number | undefined {
  const value = getString(options, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new CliUsageError(`--${key} must be an integer.`);
  return parsed;
}

function getBoolean(options: ParsedArgs["options"], key: string): boolean | undefined {
  const value = optionValue(options, key);
  if (value === undefined) return undefined;
  const raw = isStringArray(value) ? value.at(-1) : value;
  if (raw === true) return true;
  if (raw === false) return false;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  throw new CliUsageError(`--${key} must be true or false.`);
}

function splitValues(value: string | boolean): readonly string[] {
  if (typeof value === "boolean") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getStringList(options: ParsedArgs["options"], key: string): readonly string[] {
  const value = optionValue(options, key);
  if (value === undefined) return [];
  if (isStringArray(value)) return value.flatMap(splitValues);
  return splitValues(value);
}

// Repeatable key=value flags. Unlike getStringList, values keep their commas.
function getKeyValues(
  options: ParsedArgs["options"],
  key: string,
): Record<string, string> | undefined {
  const value = optionValue(options, key);
  if (value === undefined) return undefined;
  const entries = isStringArray(value) ? value : [value];
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const index = typeof entry === "string" ? entry.indexOf("=") : -1;
    if (typeof entry !== "string" || index <= 0) {
      throw new CliUsageError(`--${key} must use key=value format.`);
    }
    result[entry.slice(0, index).trim()] = entry.slice(index + 1);
  }
  return result;
}

function validateBaseUrl(rawValue: string, allowInsecure: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new CliUsageError(`Base URL is not a valid URL: ${rawValue}`);
  }
  const normalized = parsed.toString().replace(/\/+$/, "");
  if (allowInsecure) return normalized;
  if (parsed.protocol !== "https:") {
    throw new CliUsageError(
      "Base URL must use https. Set SHIPMAIL_ALLOW_INSECURE_BASE_URL=1 for development.",
    );
  }
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_BASE_URL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    throw new CliUsageError(
      `Base URL host "${host}" is not allowed. Set SHIPMAIL_ALLOW_INSECURE_BASE_URL=1 for development.`,
    );
  }
  return normalized;
}

function apiKey(parsed: ParsedArgs, env: CliEnv): string | undefined {
  return getString(parsed.options, "api-key") ?? env["SHIPMAIL_API_KEY"];
}

function baseUrl(parsed: ParsedArgs, env: CliEnv): string {
  const raw = getString(parsed.options, "base-url") ?? env["SHIPMAIL_BASE_URL"];
  if (!raw) return DEFAULT_BASE_URL;
  return validateBaseUrl(raw, env["SHIPMAIL_ALLOW_INSECURE_BASE_URL"] === "1");
}

const REFRESH_MARGIN_MS = 60_000;

function cliEnv(options: RunCliOptions): CliEnv {
  return options.env ?? processEnv;
}

async function credentialStore(options: RunCliOptions): Promise<CredentialStore> {
  if (options.credentialStore) return options.credentialStore;
  const errOut = options.stderr ?? stderr;
  return defaultCredentialStore({
    env: cliEnv(options),
    platform: process.platform,
    run: runCommand,
    notice: (message) => errOut.write(`${message}\n`),
  });
}

function isFresh(login: StoredLogin): boolean {
  return login.expiresAt - Date.now() > REFRESH_MARGIN_MS;
}

// Every refresh issues a new access token, so the access token identifies a login's generation.
function sameGeneration(a: StoredLogin, b: StoredLogin): boolean {
  return a.accessToken === b.accessToken && a.refreshToken === b.refreshToken;
}

// A refresh rotates the refresh token, so refreshes run under the store's lock: a second process
// waits, then finds the login the first one saved instead of spending the rotated token.
async function freshLogin(
  stored: StoredLogin,
  store: CredentialStore,
  fetchFn: typeof fetch,
): Promise<StoredLogin> {
  if (isFresh(stored)) return stored;
  return store.withLock(async () => {
    const current = await store.read(stored.baseUrl);
    if (!current) throw new Error("You were signed out. Run shipmail login.");
    if (isFresh(current)) return current;
    try {
      const refreshed = await refreshLogin(current, fetchFn);
      // Save only over the login that was refreshed. If another process replaced it meanwhile (a
      // new shipmail login, for example), this command finishes with its own tokens and leaves the
      // newer login alone, so a slow refresh can never bring back an older account.
      const latest = await store.read(stored.baseUrl);
      if (latest && sameGeneration(latest, current)) await store.write(refreshed);
      return refreshed;
    } catch (err) {
      if (!(err instanceof OAuthError) || err.code !== "invalid_grant") throw err;
      const latest = await store.read(stored.baseUrl);
      if (latest && !sameGeneration(latest, current)) {
        if (isFresh(latest)) return latest;
        throw new Error(
          "Your Shipmail login changed while it was refreshing. Run the command again.",
          { cause: err },
        );
      }
      if (latest) await store.delete(stored.baseUrl);
      throw new Error("Your Shipmail login has expired or was revoked. Run shipmail login.", {
        cause: err,
      });
    }
  });
}

// --api-key, then SHIPMAIL_API_KEY, then the login saved by shipmail login.
async function resolveCredential(parsed: ParsedArgs, options: RunCliOptions): Promise<Credential> {
  const env = cliEnv(options);
  const key = apiKey(parsed, env);
  if (key) return { kind: "api-key", token: key };

  const store = await credentialStore(options);
  const stored = await store.read(baseUrl(parsed, env));
  if (!stored) {
    throw new CliUsageError(
      "Not signed in. Run shipmail login, set SHIPMAIL_API_KEY, or pass --api-key sm_live_...",
    );
  }
  const current = await freshLogin(stored, store, options.fetch ?? fetch);
  return {
    kind: "oauth",
    token: current.accessToken,
    organizationId:
      getString(parsed.options, "organization") ??
      env["SHIPMAIL_ORGANIZATION"] ??
      current.organizationId,
  };
}

// The organization header applies to OAuth logins only. An API key belongs to one organization.
function organizationHeader(credential: Credential): Record<string, string> {
  return credential.kind === "oauth" && credential.organizationId
    ? { "X-Shipmail-Organization": credential.organizationId }
    : {};
}

async function createClient(parsed: ParsedArgs, options: RunCliOptions): Promise<ShipmailClient> {
  const env = cliEnv(options);
  const credential = await resolveCredential(parsed, options);
  const config: ShipmailConfig = {
    apiKey: credential.token,
    baseUrl: baseUrl(parsed, env),
    defaultHeaders: organizationHeader(credential),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  };
  return new ShipmailClient(config);
}

async function runLogin(parsed: ParsedArgs, options: RunCliOptions, out: Output): Promise<void> {
  const env = cliEnv(options);
  const errOut = options.stderr ?? stderr;
  const base = baseUrl(parsed, env);
  const noBrowser = getBoolean(parsed.options, "no-browser") ?? false;
  const stored = await login({
    baseUrl: base,
    fetch: options.fetch ?? fetch,
    store: await credentialStore(options),
    openBrowser: noBrowser ? null : (options.openBrowser ?? openInBrowser),
    print: (line) => errOut.write(`${line}\n`),
    timeoutMs: options.loginTimeoutMs ?? LOGIN_TIMEOUT_MS,
    organizationId: getString(parsed.options, "organization"),
  });
  const organization = stored.organizationId
    ? ` Default organization: ${stored.organizationId}.`
    : "";
  out.write(`Signed in to ${new URL(base).origin}.${organization}\n`);
}

async function runLogout(parsed: ParsedArgs, options: RunCliOptions, out: Output): Promise<void> {
  const env = cliEnv(options);
  const errOut = options.stderr ?? stderr;
  const base = baseUrl(parsed, env);
  const origin = new URL(base).origin;
  const store = await credentialStore(options);
  const signedOut = await store.withLock(async () => {
    const stored = await store.read(base);
    if (!stored) return false;
    if (stored.revocationEndpoint && stored.refreshToken) {
      try {
        await revokeToken(
          stored.revocationEndpoint,
          stored.clientId,
          stored.refreshToken,
          options.fetch ?? fetch,
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        errOut.write(`Could not revoke the login at the server: ${reason}\n`);
      }
    }
    const latest = await store.read(base);
    if (latest && !sameGeneration(latest, stored)) {
      throw new Error("A new login was saved while signing out. Run shipmail logout again.");
    }
    try {
      await store.delete(base);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`${reason} The login is still saved on this computer.`, { cause: err });
    }
    return true;
  });
  out.write(signedOut ? `Signed out of ${origin}.\n` : `Not signed in to ${origin}.\n`);
}

function writeJson(out: Output, value: unknown): void {
  out.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function readJsonInput(value: string | undefined): Promise<unknown> {
  if (value === undefined) return undefined;
  const raw = value.startsWith("@") ? await readFile(value.slice(1), "utf8") : value;
  try {
    return JSON.parse(raw);
  } catch {
    throw new CliUsageError("Value must be valid JSON or @path/to/file.json.");
  }
}

async function readTextInput(value: string | undefined): Promise<string | undefined> {
  if (value === undefined) return undefined;
  if (value.startsWith("@")) return readFile(value.slice(1), "utf8");
  return value;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Checks the shape the CLI can see; the API validates each block's fields.
function isNewsletterBlock(value: unknown): value is NewsletterBlock {
  return (
    isJsonObject(value) &&
    typeof value["type"] === "string" &&
    NEWSLETTER_BLOCK_TYPES.includes(value["type"])
  );
}

// Checks the envelope; the API validates the trigger, conditions and actions.
function isAutomationDefinition(value: unknown): value is AutomationDefinition {
  if (!isJsonObject(value) || !isJsonObject(value["trigger"]) || !isJsonObject(value["scope"])) {
    return false;
  }
  return (
    typeof value["trigger"]["type"] === "string" &&
    Array.isArray(value["conditions"]) &&
    Array.isArray(value["actions"]) &&
    (value["mode"] === "draft" || value["mode"] === "send") &&
    Array.isArray(value["scope"]["mailbox_ids"]) &&
    Array.isArray(value["scope"]["calendar_addresses"])
  );
}

function isMessageMetadata(value: unknown): value is NonNullable<SendMessageParams["metadata"]> {
  return (
    isJsonObject(value) &&
    Object.values(value).every(
      (item) =>
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    )
  );
}

async function readNewsletterBlocks(
  value: string | undefined,
): Promise<readonly NewsletterBlock[]> {
  const parsed = await readJsonInput(value);
  if (!Array.isArray(parsed)) {
    throw new CliUsageError("--blocks must be a JSON array of newsletter blocks.");
  }
  if (parsed.length === 0) {
    throw new CliUsageError("--blocks must include at least one block.");
  }
  if (!parsed.every(isNewsletterBlock)) {
    throw new CliUsageError(
      `Every --blocks item must be an object whose type is one of: ${NEWSLETTER_BLOCK_TYPES.join(", ")}.`,
    );
  }
  return parsed;
}

// --markdown takes text or @file, like --body-html.
async function readNewsletterMarkdown(options: ParsedArgs["options"]): Promise<string | undefined> {
  const input = getString(options, "markdown");
  if (input === undefined) return undefined;
  const markdown = await readTextInput(input);
  if (getString(options, "blocks") !== undefined || getString(options, "body-html") !== undefined) {
    throw new CliUsageError("Use only one of --blocks, --body-html, or --markdown.");
  }
  return markdown;
}

function parseArchiveVisibility(
  options: ParsedArgs["options"],
): CreateNewsletterParams["archive_visibility"] | undefined {
  const value = getString(options, "archive-visibility");
  if (value === undefined) return undefined;
  if (value === "private" || value === "public") return value;
  throw new CliUsageError("--archive-visibility must be private or public.");
}

function parsePublishTarget(
  options: ParsedArgs["options"],
): CreateNewsletterParams["publish_target"] | undefined {
  const value = getString(options, "publish-target");
  if (value === undefined) return undefined;
  if (value === "email_and_website" || value === "email" || value === "website") return value;
  throw new CliUsageError("--publish-target must be email_and_website, email or website.");
}

function parseStylingMode(
  options: ParsedArgs["options"],
): CreateNewsletterParams["styling_mode"] | undefined {
  const value = getString(options, "styling-mode");
  if (value === undefined) return undefined;
  if (value === "styled" || value === "plain") return value;
  throw new CliUsageError("--styling-mode must be styled or plain.");
}

async function automationDefinition(value: string | undefined): Promise<AutomationDefinition> {
  const parsed = await readJsonInput(value);
  if (!isAutomationDefinition(parsed)) {
    throw new CliUsageError(
      "--definition must be a JSON object with trigger, conditions, actions, mode (draft or send) and scope { mailbox_ids, calendar_addresses }.",
    );
  }
  return parsed;
}

function automationStatus(options: ParsedArgs["options"]): AutomationStatus | undefined {
  const value = getString(options, "status");
  if (value === undefined) return undefined;
  if (value === "active" || value === "paused" || value === "disabled") return value;
  throw new CliUsageError("--status must be active, paused, or disabled.");
}

async function newsletterCreateParams(
  options: ParsedArgs["options"],
): Promise<CreateNewsletterParams> {
  const audience_id = getRequiredString(options, "audience-id");
  const sender_identity_id = getRequiredString(options, "sender-identity-id");
  const name = getRequiredString(options, "name");
  const subject = getRequiredString(options, "subject");

  const blocksInput = getString(options, "blocks");
  const bodyHtmlInput = getString(options, "body-html");
  const bodyTextInput = getString(options, "body-text");

  const blocks = blocksInput ? await readNewsletterBlocks(blocksInput) : undefined;
  const body_html = bodyHtmlInput ? await readTextInput(bodyHtmlInput) : undefined;
  const body_text = bodyTextInput ? await readTextInput(bodyTextInput) : undefined;
  const content_markdown = await readNewsletterMarkdown(options);

  if (!blocks?.length && !body_html?.trim() && !body_text?.trim() && !content_markdown?.trim()) {
    throw new CliUsageError(
      "Provide at least one of --blocks, --body-html, --body-text, or --markdown.",
    );
  }

  const send_window_hours = getNumber(options, "send-window-hours");
  const archive_visibility = parseArchiveVisibility(options);
  const publish_target = parsePublishTarget(options);
  const feed_entry_url = getString(options, "feed-entry-url");
  const styling_mode = parseStylingMode(options);
  const track_engagement = getBoolean(options, "track-engagement");
  const add_utm_tags = getBoolean(options, "add-utm-tags");
  const preview_text = getString(options, "preview-text");
  const subjectTest = subjectTestParams(options);

  return {
    audience_id,
    sender_identity_id,
    name,
    subject,
    ...(preview_text !== undefined ? { preview_text } : {}),
    ...(blocks ? { blocks } : {}),
    ...(content_markdown !== undefined ? { content_markdown } : {}),
    ...(body_html !== undefined ? { body_html } : {}),
    ...(body_text !== undefined ? { body_text } : {}),
    ...(send_window_hours !== undefined ? { send_window_hours } : {}),
    ...(archive_visibility !== undefined ? { archive_visibility } : {}),
    ...(publish_target !== undefined ? { publish_target } : {}),
    ...(feed_entry_url !== undefined ? { feed_entry_url } : {}),
    ...(styling_mode !== undefined ? { styling_mode } : {}),
    ...(track_engagement !== undefined ? { track_engagement } : {}),
    ...(add_utm_tags !== undefined ? { add_utm_tags } : {}),
    ...subjectTest,
  };
}

// --subject-b "..." tests a second subject; --clear-subject-b ends the test.
function subjectTestParams(options: ParsedArgs["options"]): {
  readonly subject_b?: string | null;
  readonly subject_test_percent?: number;
  readonly subject_test_hours?: number;
} {
  const subject_b = getString(options, "subject-b");
  const clear = getBoolean(options, "clear-subject-b") === true;
  if (subject_b !== undefined && clear) {
    throw new CliUsageError("Use either --subject-b or --clear-subject-b.");
  }
  const subject_test_percent = getNumber(options, "subject-test-percent");
  const subject_test_hours = getNumber(options, "subject-test-hours");
  return {
    ...(subject_b !== undefined ? { subject_b } : {}),
    ...(clear ? { subject_b: null } : {}),
    ...(subject_test_percent !== undefined ? { subject_test_percent } : {}),
    ...(subject_test_hours !== undefined ? { subject_test_hours } : {}),
  };
}

async function newsletterUpdateParams(
  options: ParsedArgs["options"],
): Promise<UpdateNewsletterParams> {
  const audience_id = getString(options, "audience-id");
  const sender_identity_id = getString(options, "sender-identity-id");
  const name = getString(options, "name");
  const subject = getString(options, "subject");
  const preview_text = getString(options, "preview-text");
  const send_window_hours = getNumber(options, "send-window-hours");
  const archive_visibility = parseArchiveVisibility(options);
  const publish_target = parsePublishTarget(options);
  const feed_entry_url = getString(options, "feed-entry-url");
  const styling_mode = parseStylingMode(options);
  const track_engagement = getBoolean(options, "track-engagement");
  const add_utm_tags = getBoolean(options, "add-utm-tags");

  const blocksInput = getString(options, "blocks");
  const bodyHtmlInput = getString(options, "body-html");
  const bodyTextInput = getString(options, "body-text");

  const blocks = blocksInput ? await readNewsletterBlocks(blocksInput) : undefined;
  const body_html = bodyHtmlInput ? await readTextInput(bodyHtmlInput) : undefined;
  const body_text = bodyTextInput ? await readTextInput(bodyTextInput) : undefined;
  const content_markdown = await readNewsletterMarkdown(options);

  const params: UpdateNewsletterParams = {
    ...(audience_id ? { audience_id } : {}),
    ...(sender_identity_id ? { sender_identity_id } : {}),
    ...(name ? { name } : {}),
    ...(subject ? { subject } : {}),
    ...(preview_text !== undefined ? { preview_text } : {}),
    ...(blocks ? { blocks } : {}),
    ...(content_markdown !== undefined ? { content_markdown } : {}),
    ...(body_html !== undefined ? { body_html } : {}),
    ...(body_text !== undefined ? { body_text } : {}),
    ...(send_window_hours !== undefined ? { send_window_hours } : {}),
    ...(archive_visibility !== undefined ? { archive_visibility } : {}),
    ...(publish_target !== undefined ? { publish_target } : {}),
    ...(feed_entry_url !== undefined ? { feed_entry_url } : {}),
    ...(styling_mode !== undefined ? { styling_mode } : {}),
    ...(track_engagement !== undefined ? { track_engagement } : {}),
    ...(add_utm_tags !== undefined ? { add_utm_tags } : {}),
    ...subjectTestParams(options),
  };

  if (Object.keys(params).length === 0) {
    throw new CliUsageError("Provide at least one field to update.");
  }

  return params;
}

function apiPath(rawPath: string | undefined): string {
  if (!rawPath) throw new CliUsageError("Missing API path.");
  if (!rawPath.startsWith("/")) throw new CliUsageError("API path must start with '/'.");
  return rawPath;
}

function parseHeaders(values: readonly string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const value of values) {
    const index = value.indexOf(":");
    if (index <= 0) throw new CliUsageError("--header must use 'Name: value' format.");
    headers[value.slice(0, index).trim()] = value.slice(index + 1).trim();
  }
  return headers;
}

async function rawApiRequest(
  parsed: ParsedArgs,
  runOptions: RunCliOptions,
  method: string,
  path: string,
  body: unknown,
  authRequired: boolean,
): Promise<Response> {
  const env = runOptions.env ?? processEnv;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...parseHeaders(getStringList(parsed.options, "header")),
  };

  if (authRequired) {
    const credential = await resolveCredential(parsed, runOptions);
    headers["Authorization"] = `Bearer ${credential.token}`;
    Object.assign(headers, organizationHeader(credential));
  } else {
    const key = apiKey(parsed, env);
    if (key) headers["Authorization"] = `Bearer ${key}`;
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await (runOptions.fetch ?? fetch)(`${baseUrl(parsed, env)}${path}`, {
    method,
    headers,
    body: requestBody,
    signal: AbortSignal.timeout(RAW_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const errorBody = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");
    throw new CliHttpError(response.status, errorBody);
  }

  return response;
}

async function writeRawResponse(
  parsed: ParsedArgs,
  io: { stdout: Output },
  response: Response,
): Promise<void> {
  const outputPath = getString(parsed.options, "output");
  if (outputPath) {
    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    io.stdout.write(`${outputPath}\n`);
    return;
  }

  if (response.status === 204) {
    writeJson(io.stdout, { ok: true, status: response.status });
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    writeJson(io.stdout, await response.json());
    return;
  }

  io.stdout.write(`${await response.text()}\n`);
}

function usage(): string {
  return `shipmail-cli v${CLI_VERSION}

Usage:
  shipmail login [--no-browser] [--organization org_...]
  shipmail logout
  shipmail status
  shipmail capabilities
  shipmail organization access
  shipmail api <METHOD> <PATH> [--data JSON|@file] [--output file]
  shipmail automations list
  shipmail automations create --name "Daily brief" --definition JSON|@file [--idempotency-key key]
  shipmail automations get <id>
  shipmail automations update <id> [--name "..."] [--definition JSON|@file] [--status active|paused|disabled] [--idempotency-key key]
  shipmail automations run <id> [--idempotency-key key]
  shipmail domains list [--limit 25] [--cursor cur]
  shipmail domains search <keyword>
  shipmail domains create <name>
  shipmail domains get <id>
  shipmail domains dns-records <id>
  shipmail domains health <id> [--json]
  shipmail domains verify <id>
  shipmail domains delete <id>
  shipmail mailboxes list [--domain-id dom] [--limit 25] [--cursor cur]
  shipmail mailboxes create --domain-id dom --address hello (--password value | --password-file path | --generate-password) [--display-name "Hello"]
  shipmail mailboxes get <id>
  shipmail mailboxes update <id> [--display-name "Ops"] [--agent-security-hold true|false]
  shipmail mailboxes suspend <id>
  shipmail mailboxes resume <id>
  shipmail mailboxes export <id>
  shipmail mailboxes export-status <id> <export-id>
  shipmail mailboxes import-resume <id> <import-id>
  shipmail mailboxes import-restore <id> <import-id> --file-id impf_...
  shipmail mailboxes app-passwords list <id>
  shipmail mailboxes app-passwords create <id> --name "Desktop mail" [--expires-at 2026-10-01T00:00:00Z] [--allowed-cidr 203.0.113.0/24]
  shipmail mailboxes app-passwords revoke <id> <app-password-id>
  shipmail mailboxes folders <id>
  shipmail mailboxes identities <id>
  shipmail mailboxes rules <id>
  shipmail mailboxes forwarding <id>
  shipmail mailboxes forwarding-add <id> --destination owner@example.com [--sender newsletter@example.com] [--recipient support@example.com]
  shipmail mailboxes forwarding-remove <id> <forwarding-id>
  shipmail mailboxes delivery-routing <id>
  shipmail mailboxes delivery-routing-set <id> --mode keep|fixed|round-robin [--destination-mailbox-id mbx_...] [--fallback-mailbox-id mbx_...]
  shipmail mailboxes prepare-attachment-upload <id> <file> [--filename name] [--content-type type]
  shipmail mailboxes stage-attachment <id> <file> [--filename name] [--content-type type]
  shipmail mailboxes sandbox-inbound <id> --from sender@example.com --subject "Test" (--text "Hello" | --html "<p>Hello</p>") [--to support@example.com]
  shipmail members list [--limit 25] [--cursor cur]
  shipmail members get <id>
  shipmail members invitations list
  shipmail members invite <email> --role admin|member [--all-mailboxes] [--mailbox <mailbox-id> ...] [--newsletter-editor] [--idempotency-key key]
  shipmail members invitations cancel <invitation-id>
  shipmail members mailboxes grant <member-id> <mailbox-id>
  shipmail members mailboxes revoke <member-id> <mailbox-id>
  shipmail inbox list <mailbox-id> [--folder-role inbox] [--search text] [--from text] [--to text] [--subject text] [--has-attachment [true|false]] [--after ISO] [--before ISO] [--limit 25] [--cursor cur]
  shipmail inbox message <mailbox-id> <message-id>
  shipmail inbox security-review <mailbox-id> <message-id> --reason "Reviewed" --expected-content-sha256 HASH
  shipmail inbox threads <mailbox-id> [--attention-state needs_reply] [--after ISO] [--before ISO] [--limit 25] [--cursor cur]
  shipmail inbox thread <mailbox-id> <thread-id>
  shipmail inbox thread-attention <mailbox-id> <thread-id> --done true --expected-version 3
  shipmail inbox draft <mailbox-id> <thread-id> --expected-version 3 (--text "Hello" | --html "<p>Hello</p>") [--reply-mode reply_all]
  shipmail inbox compose-draft <mailbox-id> --to user@example.com [--cc ...] [--bcc ...] [--subject "Hi"] (--text "Hello" | --html "<p>Hello</p>") [--idempotency-key key]  (saves a new message to Drafts; never sends)
  shipmail inbox drafts <mailbox-id> <thread-id>
  shipmail inbox get-draft <mailbox-id> <thread-id> <draft-id>
  shipmail inbox update-draft <mailbox-id> <thread-id> <draft-id> (--text "Hello" | --html "<p>Hello</p>")  (the new body replaces the old one)
  shipmail inbox delete-draft <mailbox-id> <thread-id> <draft-id>
  shipmail inbox send-draft <mailbox-id> <thread-id> <draft-id> [--expected-content-sha256 hash]
  shipmail inbox reply-message <mailbox-id> <message-id> --to user@example.com [--cc ...] [--bcc ...] (--text "Hello" | --html "<p>Hello</p>") [--track-reply true|false]
  shipmail inbox reply-thread <mailbox-id> <thread-id> --to user@example.com [--cc ...] [--bcc ...] (--text "Hello" | --html "<p>Hello</p>") [--track-reply true|false]
  shipmail inbox update <mailbox-id> <message-id> [--read true] [--starred false]
  shipmail inbox move <mailbox-id> <message-id> (--target-role archive | --target-folder-id fld)
  shipmail messages send (--mailbox-id mbx | --from 'Acme Support <hello@example.com>') --to user@example.com --subject "Hi" --text "Hello" [--track-reply true|false] [--sandbox-outcome delivered|bounced|complained] [--client-reference crm-123] [--metadata JSON|@file] [--source-rfc-message-id '<crm-123@example.com>'] [--header 'X-CRM-ID: 123']
  shipmail messages send (--mailbox-id mbx | --from hello@example.com) --to user@example.com --template tpl_... [--template-version 2] [--var name=Ada ...]
  shipmail messages list (--mailbox-id mbx | --client-reference crm-123) [--limit 25] [--cursor cur]
  shipmail messages analytics [--updated-after ISO] [--updated-before ISO] [--limit 100] [--cursor cur]
  shipmail messages get <message-id>
  shipmail messages reply <message-id> --to user@example.com [--cc ...] [--bcc ...] (--text "Hello" | --html "<p>Hello</p>") [--track-reply true|false] [--client-reference crm-reply-123]
  shipmail scheduled-messages list [--include-held] [--search text] [--limit 100]
  shipmail scheduled-messages get <message-id>
  shipmail scheduled-messages update <message-id> --to user@example.com --subject "Hi" --scheduled-at ISO (--text "Hello" | --html "<p>Hello</p>") [--staged-attachment-id sat_...]
  shipmail scheduled-messages cancel <message-id>
  shipmail reply-scans create --mailbox-id mbx --after ISO [--before ISO]
  shipmail reply-scans status <scan-id>
  shipmail reply-scans results <scan-id> [--limit 25] [--cursor cur]
  shipmail webhooks list
  shipmail webhooks create --url https://example.com/hook --events message.received,message.bounced [--authorization "Bearer key"] [--standard-webhooks-secret whsec_...] [--include-reply-text] [--authenticated-senders-only] [--allowed-sender jane@customer.com --allowed-sender customer.com]
  shipmail webhooks update <webhook-id> [--url https://example.com/hook] [--events message.received] [--description text] [--active true|false] [--authorization "Bearer key" | --clear-authorization] [--standard-webhooks-secret whsec_... | --clear-standard-webhooks-secret] [--include-reply-text true|false] [--authenticated-senders-only true|false] [--allowed-sender customer.com ... | --clear-allowed-senders]
  shipmail webhooks replay-delivery <webhook-id> <delivery-id> [--idempotency-key key]
  shipmail suppressions add <email> [--scope all|marketing]
  shipmail suppressions list [--scope all|marketing] [--limit 25] [--cursor cur]
  shipmail suppressions remove <email>
  shipmail templates list [--limit 25] [--cursor cur]
  shipmail templates create --name "Welcome" --subject "Welcome, {{name}}" (--html "<p>Hi {{name}}</p>" | --text "Hi {{name}}") [--fallback name=there ...] [--publish]
  shipmail templates get <template-id>
  shipmail templates update <template-id> [--name "..."] [--subject "..."] [--html "..." | --clear-html] [--text "..." | --clear-text] [--fallback key=value ... | --clear-fallbacks]
  shipmail templates delete <template-id>
  shipmail templates publish <template-id>
  shipmail templates render <template-id> [--var name=Ada ...] [--template-version 2]
  shipmail templates versions <template-id> [--limit 25] [--cursor cur]
  shipmail templates version <template-id> <version>
  shipmail templates restore <template-id> <version>
  shipmail newsletters create \\
    --audience-id aud_123 \\
    --sender-identity-id nwsid_456 \\
    --name "July changelog" \\
    --subject "What shipped in July" \\
    --blocks @blocks.json | --markdown @issue.md \\
    [--feed-entry-url https://example.com/post] [--styling-mode styled|plain] [--track-engagement true|false] [--add-utm-tags true|false] [--publish-target email_and_website|email|website]
  shipmail newsletters update nws_789 --subject "Updated subject" [--blocks @blocks-v2.json | --markdown @issue.md] [--feed-entry-url https://example.com/post] [--styling-mode styled|plain] [--track-engagement true|false] [--add-utm-tags true|false] [--subject-b "Second subject" | --clear-subject-b] [--subject-test-percent 1..25] [--subject-test-hours 1..72]
  shipmail newsletters preview <id>
  shipmail newsletters preflight <id>
  shipmail newsletters test-send <id> --recipient-email owner@example.com
  shipmail newsletters schedule <id> --scheduled-at 2026-08-01T09:00:00.000Z [--limit 500]
  shipmail newsletters send-more <id> [--count 1000]
  shipmail newsletters cancel <id>
  shipmail newsletters resume <id>
  shipmail newsletter-assets list [--kind image|video] [--q text] [--limit 25] [--cursor cur]
  shipmail newsletter-assets upload <file> [--filename name] [--content-type type] [--thumbnail poster.jpg]
  shipmail newsletter-assets register-url <url> [--filename name] [--thumbnail-url url]
  shipmail newsletter-sender-identities list [--limit 25] [--cursor cur]
  shipmail newsletter-domains list [--limit 25] [--cursor cur]
  shipmail audiences list [--limit 25] [--cursor cur]
  shipmail audiences create <name> --consent-source "Signup form" [--description "..."]
  shipmail audiences get <id>
  shipmail audiences update <id> [--name "..."] [--description "..."] [--cleanup true|false] [--cleanup-ignored-issues 2..100] [--cleanup-inactive-days 30..3650]
  shipmail audiences delete <id>
  shipmail audiences feed get <audience-id>
  shipmail audiences feed update <audience-id> [--enabled true|false] [--title "..."] [--subtitle "..."] [--site-url https://...] [--canonical-url https://...] [--author-name "..."] [--icon-url https://...] [--entry-limit 10..100] [--idempotency-key key]
  shipmail audiences feed rotate <audience-id> [--idempotency-key key]
  shipmail audiences feed revoke <audience-id> [--idempotency-key key]
  shipmail audiences welcome get <audience-id>
  shipmail audiences welcome enable|disable <audience-id> [--idempotency-key key]
  shipmail audiences welcome add-step <audience-id> --subject "Welcome" (--markdown @welcome.md | --blocks @blocks.json) [--wait-minutes 0] [--preview-text "..."] [--sender-identity-id nwsid_456]
  shipmail audiences welcome update-step <audience-id> <step-id> [--subject "..."] [--markdown @welcome.md | --blocks @blocks.json] [--wait-minutes 1440]
  shipmail audiences welcome remove-step <audience-id> <step-id>
  shipmail audiences subscribers add <audience-id> <email> [--name "Jane"] [--consent-source "..."]
  shipmail audiences subscribers list <audience-id> [--status subscribed] [--email jane@x.com] [--limit 25]
  shipmail audiences subscribers get <audience-id> <subscriber-id>
  shipmail audiences subscribers by-email <audience-id> <email>
  shipmail audiences subscribers update <audience-id> <subscriber-id> [--name "..."]
  shipmail audiences subscribers unsubscribe <audience-id> <subscriber-id>
  shipmail audiences subscribers resubscribe <audience-id> <subscriber-id> --consent-source "Signup form"
  shipmail audiences subscribers remove <audience-id> <subscriber-id>
  shipmail calendar events list --mailbox hello@example.com --from 2026-08-01T00:00:00Z --to 2026-08-08T00:00:00Z [--expand true] [--limit 100]
  shipmail calendar events create --mailbox hello@example.com --title "Sync" --start 2026-08-01T14:00:00 [--timezone Europe/Paris] [--duration PT30M] [--invitation-language en|fr|es] [--attendees JSON|@file] [--reminders JSON|@file] [--operation-key key] [--send-invitations true|false]
  shipmail calendar events get <event-id> --mailbox hello@example.com
  shipmail calendar events update <event-id> --mailbox hello@example.com [--title "..."] [--start ...] [--invitation-language en|fr|es] [--operation-key key] [--expected-revision sha256] [--send-guest-updates true|false]
  shipmail calendar events delete <event-id> --mailbox hello@example.com
  shipmail calendar availability --mailbox hello@example.com --from 2026-08-03T00:00:00Z --to 2026-08-04T00:00:00Z [--duration 30] [--days 1,2,3,4,5] [--window-start 540] [--window-end 1020]
  shipmail booking-pages list [--limit 25] [--cursor cur]
  shipmail booking-pages create --name "Intro" --mailbox hello@example.com --slug intro --duration-minutes 30 --availability-days 1,2,3,4,5 --window-start-minutes 540 --window-end-minutes 1020 --timezone America/New_York [--conferencing-provider zoom|google_meet]
  shipmail booking-pages get <id>
  shipmail booking-pages update <id> [--name "..."] [--conferencing-provider zoom|google_meet|none] [--active false]
  shipmail booking-pages delete <id>
  shipmail booking-links list [--status open|booked|expired|revoked] [--limit 25] [--cursor cur]
  shipmail booking-links create --name "Call with Sam" --mailbox hello@example.com --duration-minutes 30 --timezone Europe/Lisbon --range 2026-11-02T09:00:00Z/2026-11-02T12:00:00Z [--range ...] [--source-page bkp_...] [--max-bookings 1|unlimited] [--expires-at 2026-11-10T00:00:00Z]
  shipmail booking-links get <id>
  shipmail booking-links update <id> [--name "..."] [--range start/end|none] [--max-bookings n|unlimited] [--expires-at iso|none] [--source-page id|none]
  shipmail booking-links revoke <id>

Booking page conferencing:
  --conferencing-provider <zoom|google_meet>  Create a meeting for every booking.
  --conferencing-provider none                Stop creating meeting links on update.

One-off booking links:
  --range <start>/<end>          A time the link offers, as two ISO instants. Repeat it, or
                                 separate ranges with commas. Without ranges, --source-page
                                 offers that booking page's weekly hours.
  --range none                   On update, drop the ranges and offer the source page's hours.
  --max-bookings <n|unlimited>   The link stops after this many bookings. Defaults to 1.
  --expires-at <iso|none>        The link stops taking bookings at this time.
  --source-page <id|none>        The booking page to copy weekly hours from.
  Revoking a link stops it at once and cannot be undone. Other flags: --description,
  --buffer-minutes, --minimum-notice-minutes, --conferencing-provider, --mailbox.

Templates:
  {{key}} in the subject, html or text is a variable. --html and --text take the value or @file.
  --fallback key=value     Default for a variable. Repeat it. A variable without one is required
                           at send time. On update, the given fallbacks replace all of them.
  --publish                On create, also publish the draft as version 1.
  update changes the draft; publish makes it the next version, which sends use. restore copies a
  version into the draft without publishing it. render previews the draft, or --template-version.
  messages send --template <id> sends the published version, or --template-version. --var
  key=value sets a variable (repeat it; values are text). --subject, --html and --text are refused
  with --template.

Conversation IDs:
  <thread-id> accepts a conversation ID (thd_...) or the mail-server thread ID. Store the
  conversation_id every response carries. thread_id is deprecated and unchanged.

Member access output:
  role is owner, admin, or member. mailbox_access.scope is all or selected. mailbox_ids is empty
  for all; selected IDs may be limited to mailboxes the API key can reach.

Member invitations and mailbox sharing:
  Needs the members:write permission, which is never granted by default. The invitee receives an
  email and creates their own account; no credential is returned. Without --all-mailboxes the
  invitation shares only the --mailbox IDs. --newsletter-editor applies to the member role only.

Newsletter styling:
  --styling-mode <styled|plain>  styled applies Shipmail's email theme. plain sends your HTML without injected styles, width, or centering, so the reader's email client styles it.

Newsletter publish target:
  --publish-target <email_and_website|email|website>  Where the newsletter goes. email_and_website (default) sends it, and its archive visibility decides whether it also appears on the website and feed. email never appears on the web. website is published on the audience's newsletter website and feed at the scheduled time without any email; the website must be on.

Newsletter tracking:
  --track-engagement <true|false>  Track opens and clicks for this newsletter. Off by default. Changes only while the newsletter is a draft or scheduled for later.
  --add-utm-tags <true|false>  Add utm_source, utm_medium and utm_campaign to the newsletter's links in the email and the feed. Off by default. Changes only while the newsletter is a draft or scheduled for later.

Newsletter subject test:
  --subject-b <text>  Test a second subject. Each subject goes to --subject-test-percent of the subscribers (default 10); after --subject-test-hours (default 4) the one with more human clicks goes to the rest. Needs --track-engagement true.
  --clear-subject-b   Remove the second subject.

Engaged first:
  --limit <n>  On schedule, send only to the n most engaged subscribers. Send the rest with send-more, which takes --count or sends to everyone left.

List cleanup:
  --cleanup <true|false>  A cold subscriber gets one last-chance email instead of a newsletter, and becomes dormant if they do not click keep within 14 days.
  --cleanup-ignored-issues <n>  Tracked newsletters ignored in a row before a subscriber is cold (2 to 100, default 6).
  --cleanup-inactive-days <n>  Days without a sign of life before a subscriber is cold (30 to 3650, default 180).

Newsletter block prose:
  Paragraph, quote, callout, list-item, and column bodies accept bare text or sanitized inline HTML. Use <p> and <br> for line breaks.

Newsletter feeds:
  --feed-entry-url <url>  Link this newsletter's Atom feed title to an http(s) URL instead of its Shipmail archive.

Sign-in:
  Run shipmail login once to sign in through the browser instead of using an API key.
  Run shipmail login --help for details.

Global options:
  --api-key <key>       API key. Defaults to SHIPMAIL_API_KEY, then the shipmail login session.
  --organization <id>   Organization for a login that can reach several. Defaults to
                        SHIPMAIL_ORGANIZATION, then the one saved by shipmail login.
  --base-url <url>      API base URL. Defaults to SHIPMAIL_BASE_URL or ${DEFAULT_BASE_URL}.
  --header "K: V"       Extra header for the generic api command. Repeatable.

Environment:
  SHIPMAIL_API_KEY      API key for authenticated commands.
  SHIPMAIL_ORGANIZATION Organization ID sent with a shipmail login session.
  SHIPMAIL_BASE_URL     Optional API base URL. Must be https on shipmail.to.
  SHIPMAIL_ALLOW_INSECURE_BASE_URL=1
                        Permit a non-https or non-shipmail.to base URL (development only).
`;
}

function loginUsage(): string {
  return `Usage:
  shipmail login [--no-browser] [--organization org_...]
  shipmail logout

shipmail login opens Shipmail in your browser. Sign in, choose the organizations the CLI may
reach, and approve. The CLI then runs commands without an API key.

  --no-browser          Print the sign-in URL without opening a browser.
  --organization <id>   Save a default organization, for a login that can reach several.

The login is saved in the macOS Keychain, in the Secret Service through secret-tool on Linux,
or otherwise in $XDG_CONFIG_HOME/shipmail/credentials.json (~/.config/shipmail/ by default),
readable only by you. It refreshes itself. An API key from --api-key or SHIPMAIL_API_KEY takes
precedence over the login.

shipmail logout revokes the login at Shipmail and deletes it from this computer.
`;
}

function requirePositional(positional: readonly string[], index: number, label: string): string {
  const value = positional[index];
  if (!value) throw new CliUsageError(`Missing ${label}.`);
  return value;
}

function inboxTextFilters(options: ParsedArgs["options"]): {
  from?: string;
  to?: string;
  subject?: string;
} {
  const from = getString(options, "from");
  const to = getString(options, "to");
  const subject = getString(options, "subject");
  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(subject ? { subject } : {}),
  };
}

function inboxListParams(options: ParsedArgs["options"]): {
  folder_id?: string;
  folder_role?: "inbox" | "starred" | "sent" | "drafts" | "archive" | "junk" | "trash";
  search_text?: string;
  from?: string;
  to?: string;
  subject?: string;
  has_attachment?: boolean;
  cursor?: string;
  after?: string;
  before?: string;
  limit?: number;
  has_keyword?: "$flagged" | "$seen" | "$draft" | "$answered" | "$forwarded";
  not_keyword?: "$flagged" | "$seen" | "$draft" | "$answered" | "$forwarded";
} {
  const params: ReturnType<typeof inboxListParams> = {};
  const folderId = getString(options, "folder-id");
  const folderRole = getString(options, "folder-role");
  const searchText = getString(options, "search");
  const hasAttachment = getBoolean(options, "has-attachment");
  const cursor = getString(options, "cursor");
  const after = getString(options, "after");
  const before = getString(options, "before");
  const limit = getNumber(options, "limit");
  const hasKeyword = getString(options, "has-keyword");
  const notKeyword = getString(options, "not-keyword");
  if (folderId) params.folder_id = folderId;
  if (folderRole) params.folder_role = folderRole as NonNullable<typeof params.folder_role>;
  if (searchText) params.search_text = searchText;
  Object.assign(params, inboxTextFilters(options));
  if (hasAttachment !== undefined) params.has_attachment = hasAttachment;
  if (cursor) params.cursor = cursor;
  if (after) params.after = after;
  if (before) params.before = before;
  if (limit !== undefined) params.limit = limit;
  if (hasKeyword) params.has_keyword = hasKeyword as NonNullable<typeof params.has_keyword>;
  if (notKeyword) params.not_keyword = notKeyword as NonNullable<typeof params.not_keyword>;
  return params;
}

function messageRecipients(
  options: ParsedArgs["options"],
  key: string,
): readonly EmailRecipientInput[] {
  return getStringList(options, key);
}

function webhookEvents(options: ParsedArgs["options"]): readonly WebhookEventType[] {
  const events = getStringList(options, "events");
  if (events.length === 0) throw new CliUsageError("Provide at least one --events value.");

  const invalid = events.filter((event) => !WEBHOOK_EVENT_TYPE_SET.has(event));
  if (invalid.length > 0) {
    throw new CliUsageError(`Invalid webhook event type: ${invalid.join(", ")}.`);
  }

  return events as readonly WebhookEventType[];
}

function webhookWriteOnlyOption(
  options: ParsedArgs["options"],
  name: "authorization" | "standard-webhooks-secret",
): string | undefined {
  const value = optionValue(options, name);
  if (value === undefined) return undefined;
  if (typeof value === "boolean") throw new CliUsageError(`Missing value for --${name}.`);
  return getString(options, name);
}

function webhookWriteOnlyUpdate(
  options: ParsedArgs["options"],
  name: "authorization" | "standard-webhooks-secret",
): string | null | undefined {
  const value = webhookWriteOnlyOption(options, name);
  const clear = getBoolean(options, `clear-${name}`) === true;
  if (value !== undefined && clear) {
    throw new CliUsageError(`Use --${name} or --clear-${name}, not both.`);
  }
  return clear ? null : value;
}

// Repeat --allowed-sender for each address or domain.
function webhookAllowedSenders(options: ParsedArgs["options"]): readonly string[] | undefined {
  const value = optionValue(options, "allowed-sender");
  if (value === undefined) return undefined;
  if (typeof value === "boolean") throw new CliUsageError("Missing value for --allowed-sender.");
  return getStringList(options, "allowed-sender");
}

function webhookAllowedSendersUpdate(
  options: ParsedArgs["options"],
): readonly string[] | null | undefined {
  const senders = webhookAllowedSenders(options);
  const clear = getBoolean(options, "clear-allowed-senders") === true;
  if (senders !== undefined && clear) {
    throw new CliUsageError("Use --allowed-sender or --clear-allowed-senders, not both.");
  }
  return clear ? null : senders;
}

function webhookUpdateParams(options: ParsedArgs["options"]): UpdateWebhookParams {
  const authorization = webhookWriteOnlyUpdate(options, "authorization");
  const standardWebhooksSecret = webhookWriteOnlyUpdate(options, "standard-webhooks-secret");
  const url = getString(options, "url");
  const description = getString(options, "description");
  const active = getBoolean(options, "active");
  const includeReplyText = getBoolean(options, "include-reply-text");
  const authenticatedSendersOnly = getBoolean(options, "authenticated-senders-only");
  const allowedSenders = webhookAllowedSendersUpdate(options);
  const params: UpdateWebhookParams = {
    ...(url !== undefined ? { url } : {}),
    ...(optionValue(options, "events") !== undefined ? { events: webhookEvents(options) } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(authorization !== undefined ? { authorization } : {}),
    ...(standardWebhooksSecret !== undefined
      ? { standard_webhooks_secret: standardWebhooksSecret }
      : {}),
    ...(includeReplyText !== undefined ? { include_reply_text: includeReplyText } : {}),
    ...(authenticatedSendersOnly !== undefined
      ? { authenticated_senders_only: authenticatedSendersOnly }
      : {}),
    ...(allowedSenders !== undefined ? { allowed_senders: allowedSenders } : {}),
  };
  if (Object.keys(params).length === 0) {
    throw new CliUsageError("Nothing to update. Pass at least one webhook option.");
  }
  return params;
}

function webhookDeliveryParams(options: ParsedArgs["options"]): ListDeliveriesParams {
  const status = getString(options, "status");
  const eventType = getString(options, "event-type");

  return {
    cursor: getString(options, "cursor"),
    limit: getNumber(options, "limit"),
    ...(status ? { status } : {}),
    ...(eventType ? { event_type: eventType } : {}),
  };
}

function outboundMessageHeaders(
  options: ParsedArgs["options"],
): NonNullable<SendMessageParams["headers"]> {
  const headers = getStringList(options, "header");
  return headers.map((value) => {
    const index = value.indexOf(":");
    if (index <= 0) throw new CliUsageError("--header must use 'Name: value' format.");
    return { name: value.slice(0, index).trim(), value: value.slice(index + 1).trim() };
  });
}

async function messageMetadata(
  options: ParsedArgs["options"],
): Promise<SendMessageParams["metadata"]> {
  const raw = getString(options, "metadata");
  if (!raw) return undefined;
  const parsed = await readJsonInput(raw);
  if (!isMessageMetadata(parsed)) {
    throw new CliUsageError(
      "--metadata must be a JSON object of string, number, boolean or null values, or @path/to/file.json.",
    );
  }
  return parsed;
}

async function sendMessageParams(options: ParsedArgs["options"]): Promise<SendMessageParams> {
  const mailboxId = getString(options, "mailbox-id");
  const from = getString(options, "from");
  const to = messageRecipients(options, "to");
  const cc = messageRecipients(options, "cc");
  const bcc = messageRecipients(options, "bcc");
  const replyTo = getString(options, "reply-to");
  const headers = outboundMessageHeaders(options);
  const metadata = await messageMetadata(options);

  if (!mailboxId && !from) throw new CliUsageError("Provide --mailbox-id or --from.");
  if (to.length === 0) throw new CliUsageError("Provide at least one --to recipient.");

  const common = {
    ...(mailboxId ? { mailbox_id: mailboxId } : {}),
    ...(from ? { from } : {}),
    to,
    ...(cc.length > 0 ? { cc } : {}),
    ...(bcc.length > 0 ? { bcc } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(getString(options, "client-reference")
      ? { client_reference: getString(options, "client-reference") }
      : {}),
    ...(metadata ? { metadata } : {}),
    ...(getString(options, "source-rfc-message-id")
      ? { source_rfc_message_id: getString(options, "source-rfc-message-id") }
      : {}),
    ...(headers.length > 0 ? { headers } : {}),
    ...(getStringList(options, "staged-attachment-id").length > 0
      ? { staged_attachment_ids: getStringList(options, "staged-attachment-id") }
      : {}),
    ...(getString(options, "scheduled-at")
      ? { scheduled_at: getString(options, "scheduled-at") }
      : {}),
    ...(() => {
      const trackReply = getBoolean(options, "track-reply");
      return trackReply === undefined ? {} : { track_reply: trackReply };
    })(),
    ...(getString(options, "sandbox-outcome")
      ? {
          sandbox_outcome: getEnum(options, "sandbox-outcome", [
            "delivered",
            "bounced",
            "complained",
          ] as const),
        }
      : {}),
  };

  const templateId = getString(options, "template");
  const templateVersion = getNumber(options, "template-version");
  const variables = getKeyValues(options, "var");
  if (templateId) {
    for (const key of ["subject", "html", "text"] as const) {
      if (optionValue(options, key) !== undefined) {
        throw new CliUsageError(
          `--${key} cannot be used with --template: the template supplies the subject and body.`,
        );
      }
    }
    return {
      ...common,
      template: {
        id: templateId,
        ...(templateVersion !== undefined ? { version: templateVersion } : {}),
        ...(variables ? { variables } : {}),
      },
    };
  }
  if (templateVersion !== undefined || variables) {
    throw new CliUsageError("--template-version and --var need --template.");
  }

  const subject = getRequiredString(options, "subject");
  const text = getString(options, "text");
  const html = getString(options, "html");
  if (!text && !html) throw new CliUsageError("Provide --text or --html.");
  return {
    ...common,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  };
}

async function replyToMessageParams(options: ParsedArgs["options"]): Promise<ReplyToMessageParams> {
  const to = messageRecipients(options, "to");
  const cc = messageRecipients(options, "cc");
  const bcc = messageRecipients(options, "bcc");
  const text = getString(options, "text");
  const html = getString(options, "html");
  const headers = outboundMessageHeaders(options);
  const metadata = await messageMetadata(options);
  if (to.length === 0) throw new CliUsageError("Provide at least one --to recipient.");
  if (!text && !html) throw new CliUsageError("Provide --text or --html.");
  return {
    to,
    ...(cc.length > 0 ? { cc } : {}),
    ...(bcc.length > 0 ? { bcc } : {}),
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(getString(options, "client-reference")
      ? { client_reference: getString(options, "client-reference") }
      : {}),
    ...(metadata ? { metadata } : {}),
    ...(getString(options, "source-rfc-message-id")
      ? { source_rfc_message_id: getString(options, "source-rfc-message-id") }
      : {}),
    ...(headers.length > 0 ? { headers } : {}),
    ...(getString(options, "scheduled-at")
      ? { scheduled_at: getString(options, "scheduled-at") }
      : {}),
    ...(() => {
      const trackReply = getBoolean(options, "track-reply");
      return trackReply === undefined ? {} : { track_reply: trackReply };
    })(),
    ...(getString(options, "sandbox-outcome")
      ? {
          sandbox_outcome: getEnum(options, "sandbox-outcome", [
            "delivered",
            "bounced",
            "complained",
          ] as const),
        }
      : {}),
  };
}

const DOMAIN_HEALTH_PROVIDER_LABELS: Record<DomainHealthProvider, string> = {
  google: "Gmail",
  microsoft: "Outlook",
  yahoo: "Yahoo",
  apple: "iCloud",
  other: "Other",
};

function formatRecipients(count: number): string {
  return `${count} ${count === 1 ? "recipient" : "recipients"}`;
}

function formatDeliveryRate(rate: number | null): string {
  return rate === null ? "no results yet" : `${rate}% delivered`;
}

function writeDomainHealth(out: Output, health: DomainHealth): void {
  const { dns, blocklist, delivery } = health;
  const checks = [
    ["MX", dns.mx],
    ["SPF", dns.spf],
    ["DKIM", dns.dkim],
    ["DMARC", dns.dmarc],
  ] as const;
  const lines = [
    `${health.domain} (${health.domain_id})`,
    "",
    `DNS (checked ${dns.last_checked_at ?? "never"})`,
    ...checks.map(([name, ok]) => `  ${name.padEnd(6)}${ok ? "pass" : "fail"}`),
    "",
    `Spamhaus DBL: ${blocklist.listed ? `listed since ${blocklist.listed_since ?? "unknown"}` : "not listed"}`,
    "",
    `Delivery, last 30 days: ${formatDeliveryRate(delivery.delivery_rate)}`,
    `  ${formatRecipients(delivery.recipients)}: ${delivery.delivered} delivered, ${delivery.bounced} bounced, ${delivery.deferred} deferred, ${delivery.complained} complained`,
    ...delivery.providers.map(
      (p) =>
        `  ${DOMAIN_HEALTH_PROVIDER_LABELS[p.provider].padEnd(8)}${formatDeliveryRate(p.delivery_rate)}, ${formatRecipients(p.recipients)}, ${p.bounced} bounced, ${p.deferred} deferred, ${p.complained} complained`,
    ),
  ];
  out.write(`${lines.join("\n")}\n`);
}

async function runDomains(client: ShipmailClient, parsed: ParsedArgs, out: Output): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    writeJson(
      out,
      await client.domains.list({
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  if (subcommand === "search") {
    writeJson(
      out,
      await client.domains.search({ keyword: requirePositional(parsed.positional, 2, "keyword") }),
    );
    return;
  }
  if (subcommand === "create") {
    writeJson(
      out,
      await client.domains.create({ name: requirePositional(parsed.positional, 2, "domain name") }),
    );
    return;
  }
  if (subcommand === "get") {
    writeJson(out, await client.domains.get(requirePositional(parsed.positional, 2, "domain id")));
    return;
  }
  if (subcommand === "dns-records") {
    writeJson(
      out,
      await client.domains.getDnsRecords(requirePositional(parsed.positional, 2, "domain id")),
    );
    return;
  }
  if (subcommand === "health") {
    const health = await client.domains.getHealth(
      requirePositional(parsed.positional, 2, "domain id"),
    );
    if (getBoolean(parsed.options, "json") === true) writeJson(out, health);
    else writeDomainHealth(out, health);
    return;
  }
  if (subcommand === "verify") {
    writeJson(
      out,
      await client.domains.verify(requirePositional(parsed.positional, 2, "domain id")),
    );
    return;
  }
  if (subcommand === "delete") {
    const id = requirePositional(parsed.positional, 2, "domain id");
    await client.domains.delete(id);
    writeJson(out, { ok: true, id });
    return;
  }
  throw new CliUsageError("Unknown domains command.");
}

async function runMailboxes(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    writeJson(
      out,
      await client.mailboxes.list({
        domain_id: getString(parsed.options, "domain-id"),
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  if (subcommand === "create") {
    const displayName = getString(parsed.options, "display-name");
    const passwordValue = getString(parsed.options, "password");
    const passwordFile = getString(parsed.options, "password-file");
    const generatePassword = getBoolean(parsed.options, "generate-password") === true;
    if (
      [Boolean(passwordValue), Boolean(passwordFile), generatePassword].filter(Boolean).length > 1
    ) {
      throw new CliUsageError(
        "Pass only one of --password, --password-file, or --generate-password.",
      );
    }
    if (!passwordValue && !passwordFile && !generatePassword) {
      throw new CliUsageError("Missing --password, --password-file, or --generate-password.");
    }
    const password = passwordFile
      ? (await readFile(passwordFile, "utf8")).replace(/\r?\n$/, "")
      : passwordValue;
    const credentials = generatePassword
      ? { generate_password: true as const }
      : password
        ? { password }
        : undefined;
    if (!credentials) {
      throw new CliUsageError("Mailbox password must not be empty.");
    }
    writeJson(
      out,
      await client.mailboxes.create({
        domain_id: getRequiredString(parsed.options, "domain-id"),
        address: getRequiredString(parsed.options, "address"),
        ...credentials,
        ...(displayName ? { display_name: displayName } : {}),
      }),
    );
    return;
  }
  if (subcommand === "get") {
    writeJson(
      out,
      await client.mailboxes.get(requirePositional(parsed.positional, 2, "mailbox id")),
    );
    return;
  }
  if (subcommand === "update") {
    const displayName = getString(parsed.options, "display-name");
    const agentSecurityHold = getBoolean(parsed.options, "agent-security-hold");
    if (displayName === undefined && agentSecurityHold === undefined) {
      throw new CliUsageError("Provide --display-name or --agent-security-hold.");
    }
    writeJson(
      out,
      await client.mailboxes.update(requirePositional(parsed.positional, 2, "mailbox id"), {
        ...(displayName !== undefined ? { display_name: displayName } : {}),
        ...(agentSecurityHold !== undefined ? { agent_security_hold: agentSecurityHold } : {}),
      }),
    );
    return;
  }
  if (subcommand === "suspend") {
    writeJson(
      out,
      await client.mailboxes.suspend(requirePositional(parsed.positional, 2, "mailbox id")),
    );
    return;
  }
  if (subcommand === "resume") {
    writeJson(
      out,
      await client.mailboxes.resume(requirePositional(parsed.positional, 2, "mailbox id")),
    );
    return;
  }
  if (subcommand === "export") {
    writeJson(
      out,
      await client.mailboxes.createExport(requirePositional(parsed.positional, 2, "mailbox id")),
    );
    return;
  }
  if (subcommand === "export-status") {
    writeJson(
      out,
      await client.mailboxes.getExport(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "export id"),
      ),
    );
    return;
  }
  if (subcommand === "import-resume") {
    writeJson(
      out,
      await client.mailboxes.resumeImport(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "import id"),
      ),
    );
    return;
  }
  if (subcommand === "import-restore") {
    const fileIds = getStringList(parsed.options, "file-id");
    writeJson(
      out,
      await client.mailboxes.restoreImport(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "import id"),
        { file_ids: fileIds },
      ),
    );
    return;
  }
  if (subcommand === "app-passwords") {
    const command = requirePositional(parsed.positional, 2, "app-password command");
    const mailboxId = requirePositional(parsed.positional, 3, "mailbox id");
    if (command === "list") {
      writeJson(out, await client.mailboxes.listAppPasswords(mailboxId));
      return;
    }
    if (command === "create") {
      const expiresAt = getString(parsed.options, "expires-at");
      const allowedCidrs = getStringList(parsed.options, "allowed-cidr");
      const params: CreateMailboxAppPasswordParams = {
        name: getRequiredString(parsed.options, "name"),
        ...(expiresAt ? { expires_at: expiresAt } : {}),
        ...(allowedCidrs.length > 0 ? { allowed_cidrs: allowedCidrs } : {}),
      };
      writeJson(out, await client.mailboxes.createAppPassword(mailboxId, params));
      return;
    }
    if (command === "revoke") {
      const appPasswordId = requirePositional(parsed.positional, 4, "app password id");
      await client.mailboxes.revokeAppPassword(mailboxId, appPasswordId);
      writeJson(out, { ok: true, id: appPasswordId });
      return;
    }
    throw new CliUsageError("Unknown mailboxes app-passwords command.");
  }
  if (subcommand === "folders") {
    writeJson(
      out,
      await client.mailboxes.listFolders(requirePositional(parsed.positional, 2, "mailbox id")),
    );
    return;
  }
  if (subcommand === "identities") {
    writeJson(
      out,
      await client.mailboxes.listIdentities(requirePositional(parsed.positional, 2, "mailbox id")),
    );
    return;
  }
  if (subcommand === "rules") {
    writeJson(
      out,
      await client.mailboxes.getRules(requirePositional(parsed.positional, 2, "mailbox id")),
    );
    return;
  }
  if (subcommand === "forwarding") {
    writeJson(
      out,
      await client.mailboxes.listForwarding(requirePositional(parsed.positional, 2, "mailbox id")),
    );
    return;
  }
  if (subcommand === "forwarding-add") {
    writeJson(
      out,
      await client.mailboxes.createForwarding(
        requirePositional(parsed.positional, 2, "mailbox id"),
        {
          destination: getRequiredString(parsed.options, "destination"),
          sender: getString(parsed.options, "sender") ?? null,
          recipient: getString(parsed.options, "recipient") ?? null,
        },
      ),
    );
    return;
  }
  if (subcommand === "forwarding-remove") {
    const mailboxId = requirePositional(parsed.positional, 2, "mailbox id");
    const forwardingId = requirePositional(parsed.positional, 3, "forwarding id");
    await client.mailboxes.deleteForwarding(mailboxId, forwardingId);
    writeJson(out, { ok: true, id: forwardingId });
    return;
  }
  if (subcommand === "delivery-routing") {
    writeJson(
      out,
      await client.mailboxes.getDeliveryRouting(
        requirePositional(parsed.positional, 2, "mailbox id"),
      ),
    );
    return;
  }
  if (subcommand === "delivery-routing-set") {
    const mailboxId = requirePositional(parsed.positional, 2, "mailbox id");
    const mode = getRequiredString(parsed.options, "mode");
    const destinationMailboxIds = getStringList(parsed.options, "destination-mailbox-id");
    let params: UpdateMailboxDeliveryRoutingParams;
    if (mode === "keep") {
      if (destinationMailboxIds.length > 0 || getString(parsed.options, "fallback-mailbox-id")) {
        throw new CliUsageError(
          "--destination-mailbox-id and --fallback-mailbox-id cannot be used with --mode keep.",
        );
      }
      params = { mode: "keep" };
    } else if (mode === "fixed") {
      const [destinationMailboxId] = destinationMailboxIds;
      if (destinationMailboxIds.length !== 1 || destinationMailboxId === undefined) {
        throw new CliUsageError("--mode fixed requires exactly one --destination-mailbox-id.");
      }
      params = {
        mode: "fixed",
        destination_mailbox_id: destinationMailboxId,
        fallback_mailbox_id: getRequiredString(parsed.options, "fallback-mailbox-id"),
      };
    } else if (mode === "round-robin") {
      if (destinationMailboxIds.length < 2) {
        throw new CliUsageError(
          "--mode round-robin requires at least two --destination-mailbox-id values.",
        );
      }
      params = {
        mode: "round_robin",
        destination_mailbox_ids: destinationMailboxIds,
        fallback_mailbox_id: getRequiredString(parsed.options, "fallback-mailbox-id"),
      };
    } else {
      throw new CliUsageError("--mode must be keep, fixed, or round-robin.");
    }
    writeJson(out, await client.mailboxes.updateDeliveryRouting(mailboxId, params));
    return;
  }
  if (subcommand === "stage-attachment") {
    const mailboxId = requirePositional(parsed.positional, 2, "mailbox id");
    const filePath = requirePositional(parsed.positional, 3, "file");
    const data = await readFile(realpathSync(filePath));
    writeJson(
      out,
      await client.mailboxes.stageAttachment(mailboxId, {
        filename:
          getString(parsed.options, "filename") ?? filePath.split(/[\\/]/).at(-1) ?? "attachment",
        data,
        content_type: getString(parsed.options, "content-type"),
      }),
    );
    return;
  }
  if (subcommand === "prepare-attachment-upload") {
    const mailboxId = requirePositional(parsed.positional, 2, "mailbox id");
    const filePath = requirePositional(parsed.positional, 3, "file");
    const data = await readFile(realpathSync(filePath));
    writeJson(
      out,
      await client.mailboxes.prepareStagedAttachmentUpload(mailboxId, {
        filename:
          getString(parsed.options, "filename") ?? filePath.split(/[\\/]/).at(-1) ?? "attachment",
        content_type: getString(parsed.options, "content-type") ?? "application/octet-stream",
        size: data.byteLength,
        sha256: createHash("sha256").update(data).digest("hex"),
      }),
    );
    return;
  }
  if (subcommand === "sandbox-inbound") {
    const text = getString(parsed.options, "text");
    const html = getString(parsed.options, "html");
    if (!text && !html) throw new CliUsageError("Provide --text or --html.");
    const to = messageRecipients(parsed.options, "to");
    const cc = messageRecipients(parsed.options, "cc");
    const headers = outboundMessageHeaders(parsed.options);
    writeJson(
      out,
      await client.mailboxes.injectSandboxInbound(
        requirePositional(parsed.positional, 2, "mailbox id"),
        {
          from: getRequiredString(parsed.options, "from"),
          ...(to.length > 0 ? { to } : {}),
          ...(cc.length > 0 ? { cc } : {}),
          subject: getRequiredString(parsed.options, "subject"),
          ...(text ? { text } : {}),
          ...(html ? { html } : {}),
          ...(getString(parsed.options, "message-id")
            ? { message_id: getString(parsed.options, "message-id") }
            : {}),
          ...(getString(parsed.options, "in-reply-to")
            ? { in_reply_to: getString(parsed.options, "in-reply-to") }
            : {}),
          ...(getStringList(parsed.options, "reference").length > 0
            ? { references: getStringList(parsed.options, "reference") }
            : {}),
          ...(getString(parsed.options, "received-at")
            ? { received_at: getString(parsed.options, "received-at") }
            : {}),
          ...(headers.length > 0 ? { headers } : {}),
        },
      ),
    );
    return;
  }
  throw new CliUsageError("Unknown mailboxes command.");
}

async function runInbox(client: ShipmailClient, parsed: ParsedArgs, out: Output): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    writeJson(
      out,
      await client.mailboxes.listInboxMessages(
        requirePositional(parsed.positional, 2, "mailbox id"),
        inboxListParams(parsed.options),
      ),
    );
    return;
  }
  if (subcommand === "thread") {
    writeJson(
      out,
      await client.mailboxes.getInboxThread(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "thread id"),
      ),
    );
    return;
  }
  if (subcommand === "message") {
    writeJson(
      out,
      await client.mailboxes.getInboxMessage(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "message id"),
      ),
    );
    return;
  }
  if (subcommand === "security-review") {
    writeJson(
      out,
      await client.mailboxes.releaseInboxMessageSecurity(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "message id"),
        {
          decision: "release",
          reason: getRequiredString(parsed.options, "reason"),
          expected_content_sha256: getRequiredString(parsed.options, "expected-content-sha256"),
        },
      ),
    );
    return;
  }
  if (subcommand === "threads") {
    const attentionState = getString(parsed.options, "attention-state");
    const sortBy = getString(parsed.options, "sort-by");
    const order = getString(parsed.options, "order");
    writeJson(
      out,
      await client.mailboxes.listInboxThreads(
        requirePositional(parsed.positional, 2, "mailbox id"),
        {
          ...(attentionState
            ? {
                attention_state: attentionState as
                  | "needs_reply"
                  | "waiting_on_them"
                  | "done"
                  | "follow_up_due"
                  | "delivery_failed"
                  | "no_action",
              }
            : {}),
          ...(sortBy ? { sort_by: sortBy as "attention_since" | "last_message_at" } : {}),
          ...(order ? { order: order as "asc" | "desc" } : {}),
          ...(getString(parsed.options, "after")
            ? { after: getString(parsed.options, "after") }
            : {}),
          ...(getString(parsed.options, "before")
            ? { before: getString(parsed.options, "before") }
            : {}),
          ...(getString(parsed.options, "cursor")
            ? { cursor: getString(parsed.options, "cursor") }
            : {}),
          ...(getNumber(parsed.options, "limit") !== undefined
            ? { limit: getNumber(parsed.options, "limit") }
            : {}),
        },
      ),
    );
    return;
  }
  if (subcommand === "thread-attention") {
    const done = getBoolean(parsed.options, "done");
    const followUpAt = getString(parsed.options, "follow-up-at");
    const expectedVersion = getNumber(parsed.options, "expected-version");
    if ((done === undefined && followUpAt === undefined) || expectedVersion === undefined) {
      throw new CliUsageError("Provide --done or --follow-up-at, and provide --expected-version.");
    }
    writeJson(
      out,
      await client.mailboxes.updateInboxThreadAttention(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "thread id"),
        {
          ...(done === undefined ? {} : { done }),
          ...(followUpAt === undefined
            ? {}
            : { follow_up_at: followUpAt === "null" ? null : followUpAt }),
          expected_version: expectedVersion,
        },
      ),
    );
    return;
  }
  if (subcommand === "draft") {
    const expectedVersion = getNumber(parsed.options, "expected-version");
    if (expectedVersion === undefined) {
      throw new CliUsageError("Provide --expected-version.");
    }
    const text = await readTextInput(getString(parsed.options, "text"));
    const html = await readTextInput(getString(parsed.options, "html"));
    if (!text && !html) throw new CliUsageError("Provide --text or --html.");
    writeJson(
      out,
      await client.mailboxes.createInboxReplyDraft(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "thread id"),
        {
          expected_version: expectedVersion,
          ...(text ? { text } : {}),
          ...(html ? { html } : {}),
          ...(getString(parsed.options, "reply-mode")
            ? { reply_mode: getString(parsed.options, "reply-mode") as "reply" | "reply_all" }
            : {}),
        },
      ),
    );
    return;
  }
  if (subcommand === "compose-draft") {
    const to = messageRecipients(parsed.options, "to");
    const cc = messageRecipients(parsed.options, "cc");
    const bcc = messageRecipients(parsed.options, "bcc");
    const subject = getString(parsed.options, "subject");
    const text = await readTextInput(getString(parsed.options, "text"));
    const html = await readTextInput(getString(parsed.options, "html"));
    const idempotencyKey = getString(parsed.options, "idempotency-key");
    if (to.length === 0) throw new CliUsageError("Provide at least one --to recipient.");
    if (!text && !html) throw new CliUsageError("Provide --text or --html.");
    writeJson(
      out,
      await client.mailboxes.createInboxDraft(
        requirePositional(parsed.positional, 2, "mailbox id"),
        {
          to,
          ...(cc.length > 0 ? { cc } : {}),
          ...(bcc.length > 0 ? { bcc } : {}),
          ...(subject !== undefined ? { subject } : {}),
          ...(text ? { text } : {}),
          ...(html ? { html } : {}),
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      ),
    );
    return;
  }
  if (subcommand === "drafts") {
    writeJson(
      out,
      await client.mailboxes.listInboxReplyDrafts(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "thread id"),
      ),
    );
    return;
  }
  if (subcommand === "get-draft") {
    writeJson(
      out,
      await client.mailboxes.getInboxReplyDraft(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "thread id"),
        requirePositional(parsed.positional, 4, "draft id"),
      ),
    );
    return;
  }
  if (subcommand === "update-draft") {
    const text = await readTextInput(getString(parsed.options, "text"));
    const html = await readTextInput(getString(parsed.options, "html"));
    if (!text && !html) throw new CliUsageError("Provide --text or --html.");
    writeJson(
      out,
      await client.mailboxes.updateInboxReplyDraft(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "thread id"),
        requirePositional(parsed.positional, 4, "draft id"),
        {
          ...(text ? { text } : {}),
          ...(html ? { html } : {}),
        },
      ),
    );
    return;
  }
  if (subcommand === "delete-draft") {
    const draftId = requirePositional(parsed.positional, 4, "draft id");
    await client.mailboxes.deleteInboxReplyDraft(
      requirePositional(parsed.positional, 2, "mailbox id"),
      requirePositional(parsed.positional, 3, "thread id"),
      draftId,
    );
    writeJson(out, { ok: true, id: draftId });
    return;
  }
  if (subcommand === "send-draft") {
    const expectedContentSha256 = getString(parsed.options, "expected-content-sha256");
    writeJson(
      out,
      await client.mailboxes.sendInboxReplyDraft(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "thread id"),
        requirePositional(parsed.positional, 4, "draft id"),
        expectedContentSha256 ? { expectedContentSha256 } : undefined,
      ),
    );
    return;
  }
  if (subcommand === "reply-message") {
    writeJson(
      out,
      await client.mailboxes.replyToInboxMessage(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "message id"),
        await replyToMessageParams(parsed.options),
      ),
    );
    return;
  }
  if (subcommand === "reply-thread") {
    writeJson(
      out,
      await client.mailboxes.replyToInboxThread(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "thread id"),
        await replyToMessageParams(parsed.options),
      ),
    );
    return;
  }
  if (subcommand === "update") {
    const read = getBoolean(parsed.options, "read");
    const starred = getBoolean(parsed.options, "starred");
    if (read === undefined && starred === undefined) {
      throw new CliUsageError("Provide --read or --starred.");
    }
    writeJson(
      out,
      await client.mailboxes.updateInboxMessage(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "message id"),
        {
          ...(read !== undefined ? { read } : {}),
          ...(starred !== undefined ? { starred } : {}),
        },
      ),
    );
    return;
  }
  if (subcommand === "move") {
    const targetRole = getString(parsed.options, "target-role");
    const targetFolderId = getString(parsed.options, "target-folder-id");
    if (Boolean(targetRole) === Boolean(targetFolderId)) {
      throw new CliUsageError("Provide exactly one of --target-role or --target-folder-id.");
    }
    writeJson(
      out,
      await client.mailboxes.moveInboxMessage(
        requirePositional(parsed.positional, 2, "mailbox id"),
        requirePositional(parsed.positional, 3, "message id"),
        {
          ...(getString(parsed.options, "from-folder-id")
            ? { from_folder_id: getString(parsed.options, "from-folder-id") }
            : {}),
          ...(targetRole
            ? { target_role: targetRole as "inbox" | "archive" | "junk" | "trash" }
            : {}),
          ...(targetFolderId ? { target_folder_id: targetFolderId } : {}),
        },
      ),
    );
    return;
  }
  throw new CliUsageError("Unknown inbox command.");
}

async function runReplyScans(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "create") {
    const mailboxIds = getStringList(parsed.options, "mailbox-id");
    const after = getString(parsed.options, "after");
    if (mailboxIds.length === 0 || !after) {
      throw new CliUsageError("Provide --mailbox-id and --after.");
    }
    writeJson(
      out,
      await client.replyScans.create({
        mailbox_ids: [...mailboxIds],
        after,
        ...(getString(parsed.options, "before")
          ? { before: getString(parsed.options, "before") }
          : {}),
      }),
    );
    return;
  }
  const scanId = requirePositional(parsed.positional, 2, "scan id");
  if (subcommand === "status") {
    writeJson(out, await client.replyScans.get(scanId));
    return;
  }
  if (subcommand === "results") {
    writeJson(
      out,
      await client.replyScans.listResults(scanId, {
        ...(getString(parsed.options, "cursor")
          ? { cursor: getString(parsed.options, "cursor") }
          : {}),
        ...(getNumber(parsed.options, "limit") !== undefined
          ? { limit: getNumber(parsed.options, "limit") }
          : {}),
      }),
    );
    return;
  }
  throw new CliUsageError("Unknown reply-scans command.");
}

async function runMessages(client: ShipmailClient, parsed: ParsedArgs, out: Output): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "send") {
    writeJson(out, await client.messages.send(await sendMessageParams(parsed.options)));
    return;
  }
  if (subcommand === "list") {
    const mailboxId = getString(parsed.options, "mailbox-id");
    const clientReference = getString(parsed.options, "client-reference");
    const filter = mailboxId
      ? { mailbox_id: mailboxId, ...(clientReference ? { client_reference: clientReference } : {}) }
      : clientReference
        ? { client_reference: clientReference }
        : undefined;
    if (!filter) {
      throw new CliUsageError("Provide --mailbox-id or --client-reference.");
    }
    writeJson(
      out,
      await client.messages.list({
        ...filter,
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  if (subcommand === "analytics") {
    writeJson(
      out,
      await client.messages.listAnalytics({
        updated_after: getString(parsed.options, "updated-after"),
        updated_before: getString(parsed.options, "updated-before"),
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  if (subcommand === "reply") {
    writeJson(
      out,
      await client.messages.reply(
        requirePositional(parsed.positional, 2, "message id"),
        await replyToMessageParams(parsed.options),
      ),
    );
    return;
  }
  if (subcommand === "get") {
    writeJson(
      out,
      await client.messages.get(requirePositional(parsed.positional, 2, "message id")),
    );
    return;
  }
  throw new CliUsageError("Unknown messages command.");
}

async function runScheduledMessages(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    writeJson(
      out,
      await client.scheduledMessages.list({
        include_held: getBoolean(parsed.options, "include-held"),
        search: getString(parsed.options, "search"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  const messageId = requirePositional(parsed.positional, 2, "message id");
  if (subcommand === "get") {
    writeJson(out, await client.scheduledMessages.get(messageId));
    return;
  }
  if (subcommand === "cancel") {
    await client.scheduledMessages.cancel(messageId);
    writeJson(out, { ok: true, id: messageId });
    return;
  }
  if (subcommand === "update") {
    const to = messageRecipients(parsed.options, "to");
    const cc = messageRecipients(parsed.options, "cc");
    const bcc = messageRecipients(parsed.options, "bcc");
    const text = getString(parsed.options, "text");
    const html = getString(parsed.options, "html");
    if (to.length === 0) throw new CliUsageError("Provide at least one --to recipient.");
    if (!text && !html) throw new CliUsageError("Provide --text or --html.");
    const update: UpdateScheduledMessageParams = {
      to,
      ...(cc.length > 0 ? { cc } : {}),
      ...(bcc.length > 0 ? { bcc } : {}),
      subject: getRequiredString(parsed.options, "subject"),
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      ...(getStringList(parsed.options, "staged-attachment-id").length > 0
        ? { staged_attachment_ids: getStringList(parsed.options, "staged-attachment-id") }
        : {}),
      scheduled_at: getRequiredString(parsed.options, "scheduled-at"),
    };
    writeJson(out, await client.scheduledMessages.update(messageId, update));
    return;
  }
  throw new CliUsageError("Unknown scheduled-messages command.");
}

async function runWebhooks(client: ShipmailClient, parsed: ParsedArgs, out: Output): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    writeJson(
      out,
      await client.webhooks.list({
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  if (subcommand === "create") {
    const description = getString(parsed.options, "description");
    const authorization = webhookWriteOnlyOption(parsed.options, "authorization");
    const standardWebhooksSecret = webhookWriteOnlyOption(
      parsed.options,
      "standard-webhooks-secret",
    );
    const includeReplyText = getBoolean(parsed.options, "include-reply-text");
    const authenticatedSendersOnly = getBoolean(parsed.options, "authenticated-senders-only");
    const allowedSenders = webhookAllowedSenders(parsed.options);
    writeJson(
      out,
      await client.webhooks.create({
        url: getRequiredString(parsed.options, "url"),
        events: webhookEvents(parsed.options),
        ...(description ? { description } : {}),
        ...(authorization !== undefined ? { authorization } : {}),
        ...(standardWebhooksSecret !== undefined
          ? { standard_webhooks_secret: standardWebhooksSecret }
          : {}),
        ...(includeReplyText !== undefined ? { include_reply_text: includeReplyText } : {}),
        ...(authenticatedSendersOnly !== undefined
          ? { authenticated_senders_only: authenticatedSendersOnly }
          : {}),
        ...(allowedSenders !== undefined ? { allowed_senders: allowedSenders } : {}),
      }),
    );
    return;
  }
  if (subcommand === "update") {
    const webhookId = requirePositional(parsed.positional, 2, "webhook id");
    writeJson(out, await client.webhooks.update(webhookId, webhookUpdateParams(parsed.options)));
    return;
  }
  if (subcommand === "test") {
    writeJson(
      out,
      await client.webhooks.test(requirePositional(parsed.positional, 2, "webhook id")),
    );
    return;
  }
  if (subcommand === "deliveries") {
    writeJson(
      out,
      await client.webhooks.listDeliveries(
        requirePositional(parsed.positional, 2, "webhook id"),
        webhookDeliveryParams(parsed.options),
      ),
    );
    return;
  }
  if (subcommand === "replay-delivery") {
    const idempotencyKey = getString(parsed.options, "idempotency-key");
    writeJson(
      out,
      await client.webhooks.replayDelivery(
        requirePositional(parsed.positional, 2, "webhook id"),
        requirePositional(parsed.positional, 3, "delivery id"),
        idempotencyKey ? { idempotencyKey } : undefined,
      ),
    );
    return;
  }
  throw new CliUsageError("Unknown webhooks command.");
}

async function runMembers(client: ShipmailClient, parsed: ParsedArgs, out: Output): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    writeJson(
      out,
      await client.members.list({
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }

  if (subcommand === "invite") {
    const idempotencyKey = getString(parsed.options, "idempotency-key");
    writeJson(
      out,
      await client.members.invite(
        inviteMemberParams(parsed),
        idempotencyKey ? { idempotencyKey } : undefined,
      ),
    );
    return;
  }
  if (subcommand === "invitations") {
    const command = requirePositional(parsed.positional, 2, "invitations command");
    if (command === "list") {
      writeJson(out, await client.members.listInvitations());
      return;
    }
    if (command === "cancel") {
      const invitationId = requirePositional(parsed.positional, 3, "invitation id");
      await client.members.cancelInvitation(invitationId);
      writeJson(out, { ok: true, id: invitationId });
      return;
    }
    throw new CliUsageError("Unknown members invitations command.");
  }
  if (subcommand === "mailboxes") {
    const command = requirePositional(parsed.positional, 2, "mailboxes command");
    const memberId = requirePositional(parsed.positional, 3, "member id");
    const mailboxId = requirePositional(parsed.positional, 4, "mailbox id");
    if (command === "grant") {
      writeJson(out, await client.members.grantMailboxAccess(memberId, mailboxId));
      return;
    }
    if (command === "revoke") {
      writeJson(out, await client.members.revokeMailboxAccess(memberId, mailboxId));
      return;
    }
    throw new CliUsageError("Unknown members mailboxes command.");
  }

  const memberId = requirePositional(parsed.positional, 2, "member id");
  if (subcommand === "get") {
    writeJson(out, await client.members.get(memberId));
    return;
  }
  throw new CliUsageError("Unknown members command.");
}

const INVITATION_ROLES = ["admin", "member"] as const;

function inviteMemberParams(parsed: ParsedArgs): InviteMemberParams {
  const email = requirePositional(parsed.positional, 2, "email");
  const rawRole = getRequiredString(parsed.options, "role");
  const role = INVITATION_ROLES.find((candidate) => candidate === rawRole);
  if (!role) throw new CliUsageError("--role must be admin or member.");
  const allMailboxes = getBoolean(parsed.options, "all-mailboxes") === true;
  const mailboxIds = getStringList(parsed.options, "mailbox");
  if (allMailboxes && mailboxIds.length > 0) {
    throw new CliUsageError("Use either --all-mailboxes or --mailbox, not both.");
  }
  const newsletterEditor = getBoolean(parsed.options, "newsletter-editor") === true;
  if (newsletterEditor && role !== "member") {
    throw new CliUsageError("--newsletter-editor applies to the member role only.");
  }
  return {
    email,
    role,
    ...(allMailboxes ? { mailbox_access: "all" } : {}),
    ...(mailboxIds.length > 0 ? { mailbox_ids: mailboxIds } : {}),
    ...(newsletterEditor ? { newsletter_role: "editor" } : {}),
  };
}

const SUPPRESSION_SCOPES = ["all", "marketing"] as const;

async function runSuppressions(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "add") {
    const scope = getEnum(parsed.options, "scope", SUPPRESSION_SCOPES);
    writeJson(
      out,
      await client.suppressions.create({
        email: requirePositional(parsed.positional, 2, "email"),
        ...(scope ? { scope } : {}),
      }),
    );
    return;
  }
  if (subcommand === "list") {
    writeJson(
      out,
      await client.suppressions.list({
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
        scope: getEnum(parsed.options, "scope", SUPPRESSION_SCOPES),
      }),
    );
    return;
  }
  if (subcommand === "remove") {
    const email = requirePositional(parsed.positional, 2, "email");
    await client.suppressions.remove(email);
    writeJson(out, { ok: true, email });
    return;
  }
  throw new CliUsageError("Unknown suppressions command.");
}

async function templateCreateParams(options: ParsedArgs["options"]): Promise<CreateTemplateParams> {
  const html = await readTextInput(getString(options, "html"));
  const text = await readTextInput(getString(options, "text"));
  const fallbacks = getKeyValues(options, "fallback");
  const publish = getBoolean(options, "publish");
  if (!html && !text) throw new CliUsageError("Provide --html or --text.");
  return {
    name: getRequiredString(options, "name"),
    subject: getRequiredString(options, "subject"),
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(fallbacks ? { fallbacks } : {}),
    ...(publish !== undefined ? { publish } : {}),
  };
}

async function templateBodyUpdate(
  options: ParsedArgs["options"],
  key: "html" | "text",
): Promise<string | null | undefined> {
  const value = await readTextInput(getString(options, key));
  const clear = getBoolean(options, `clear-${key}`) === true;
  if (value !== undefined && clear) {
    throw new CliUsageError(`Use either --${key} or --clear-${key}, not both.`);
  }
  return clear ? null : value;
}

async function templateUpdateParams(options: ParsedArgs["options"]): Promise<UpdateTemplateParams> {
  const name = getString(options, "name");
  const subject = getString(options, "subject");
  const html = await templateBodyUpdate(options, "html");
  const text = await templateBodyUpdate(options, "text");
  const fallbacks = getKeyValues(options, "fallback");
  const clearFallbacks = getBoolean(options, "clear-fallbacks") === true;
  if (fallbacks && clearFallbacks) {
    throw new CliUsageError("Use either --fallback or --clear-fallbacks, not both.");
  }
  const params: UpdateTemplateParams = {
    ...(name !== undefined ? { name } : {}),
    ...(subject !== undefined ? { subject } : {}),
    ...(html !== undefined ? { html } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(fallbacks ? { fallbacks } : clearFallbacks ? { fallbacks: {} } : {}),
  };
  if (
    name === undefined &&
    subject === undefined &&
    html === undefined &&
    text === undefined &&
    params.fallbacks === undefined
  ) {
    throw new CliUsageError("Provide at least one field to change.");
  }
  return params;
}

function templateVersionPositional(positional: readonly string[]): number {
  const raw = requirePositional(positional, 3, "version");
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 1) {
    throw new CliUsageError("Version must be a positive integer.");
  }
  return version;
}

async function runTemplates(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    writeJson(
      out,
      await client.templates.list({
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  if (subcommand === "create") {
    writeJson(out, await client.templates.create(await templateCreateParams(parsed.options)));
    return;
  }
  const id = requirePositional(parsed.positional, 2, "template id");
  if (subcommand === "get") {
    writeJson(out, await client.templates.get(id));
    return;
  }
  if (subcommand === "update") {
    writeJson(out, await client.templates.update(id, await templateUpdateParams(parsed.options)));
    return;
  }
  if (subcommand === "delete") {
    await client.templates.delete(id);
    writeJson(out, { ok: true, id });
    return;
  }
  if (subcommand === "publish") {
    writeJson(out, await client.templates.publish(id));
    return;
  }
  if (subcommand === "render") {
    const variables = getKeyValues(parsed.options, "var");
    const version = getNumber(parsed.options, "template-version");
    writeJson(
      out,
      await client.templates.render(id, {
        ...(variables ? { variables } : {}),
        ...(version !== undefined ? { version } : {}),
      }),
    );
    return;
  }
  if (subcommand === "versions") {
    writeJson(
      out,
      await client.templates.listVersions(id, {
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  if (subcommand === "version") {
    writeJson(
      out,
      await client.templates.getVersion(id, templateVersionPositional(parsed.positional)),
    );
    return;
  }
  if (subcommand === "restore") {
    writeJson(
      out,
      await client.templates.restoreVersion(id, templateVersionPositional(parsed.positional)),
    );
    return;
  }
  throw new CliUsageError("Unknown templates command.");
}

const SUBSCRIBER_STATUS_VALUES = [
  "subscribed",
  "pending",
  "unsubscribed",
  "bounced",
  "complained",
  "suppressed",
  "transactional_only",
  "dormant",
] as const;

function subscriberListParams(options: ParsedArgs["options"]): ListSubscribersParams {
  const email = getString(options, "email");
  const statusRaw = getString(options, "status");
  const status = statusRaw ? SUBSCRIBER_STATUS_VALUES.find((s) => s === statusRaw) : undefined;
  if (statusRaw && !status) {
    throw new CliUsageError(`Invalid --status: ${statusRaw}.`);
  }
  return {
    cursor: getString(options, "cursor"),
    limit: getNumber(options, "limit"),
    ...(status ? { status } : {}),
    ...(email ? { email } : {}),
  };
}

async function runSubscribers(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const action = parsed.positional[2];
  const audienceId = requirePositional(parsed.positional, 3, "audience id");
  if (action === "list") {
    writeJson(
      out,
      await client.audiences.subscribers.list(audienceId, subscriberListParams(parsed.options)),
    );
    return;
  }
  if (action === "add") {
    const name = getString(parsed.options, "name");
    const consentSource = getString(parsed.options, "consent-source");
    const consentIp = getString(parsed.options, "consent-ip");
    writeJson(
      out,
      await client.audiences.subscribers.add(audienceId, {
        email_address: requirePositional(parsed.positional, 4, "email"),
        ...(name ? { display_name: name } : {}),
        ...(consentSource ? { consent_source: consentSource } : {}),
        ...(consentIp ? { consent_ip: consentIp } : {}),
      }),
    );
    return;
  }
  if (action === "get") {
    writeJson(
      out,
      await client.audiences.subscribers.get(
        audienceId,
        requirePositional(parsed.positional, 4, "subscriber id"),
      ),
    );
    return;
  }
  if (action === "by-email") {
    writeJson(
      out,
      await client.audiences.subscribers.getByEmail(
        audienceId,
        requirePositional(parsed.positional, 4, "email"),
      ),
    );
    return;
  }
  if (action === "update") {
    const subscriberId = requirePositional(parsed.positional, 4, "subscriber id");
    const name = getString(parsed.options, "name");
    writeJson(
      out,
      await client.audiences.subscribers.update(audienceId, subscriberId, {
        ...(name ? { display_name: name } : {}),
      }),
    );
    return;
  }
  if (action === "unsubscribe") {
    writeJson(
      out,
      await client.audiences.subscribers.unsubscribe(
        audienceId,
        requirePositional(parsed.positional, 4, "subscriber id"),
      ),
    );
    return;
  }
  if (action === "resubscribe") {
    writeJson(
      out,
      await client.audiences.subscribers.resubscribe(
        audienceId,
        requirePositional(parsed.positional, 4, "subscriber id"),
        { consent_source: getRequiredString(parsed.options, "consent-source") },
      ),
    );
    return;
  }
  if (action === "remove") {
    const subscriberId = requirePositional(parsed.positional, 4, "subscriber id");
    await client.audiences.subscribers.remove(audienceId, subscriberId);
    writeJson(out, { ok: true, id: subscriberId });
    return;
  }
  throw new CliUsageError("Unknown audiences subscribers command.");
}

function audienceFeedUpdateParams(options: ParsedArgs["options"]): UpdateAudienceFeedParams {
  const enabled = getBoolean(options, "enabled");
  const title = getString(options, "title");
  const subtitle = getString(options, "subtitle");
  const siteUrl = getString(options, "site-url");
  const canonicalUrl = getString(options, "canonical-url");
  const authorName = getString(options, "author-name");
  const iconUrl = getString(options, "icon-url");
  const entryLimit = getNumber(options, "entry-limit");
  if (entryLimit !== undefined && (entryLimit < 10 || entryLimit > 100)) {
    throw new CliUsageError("--entry-limit must be between 10 and 100.");
  }
  if (
    enabled === undefined &&
    title === undefined &&
    subtitle === undefined &&
    siteUrl === undefined &&
    canonicalUrl === undefined &&
    authorName === undefined &&
    iconUrl === undefined &&
    entryLimit === undefined
  ) {
    throw new CliUsageError("Provide at least one feed setting to update.");
  }
  return {
    ...(enabled !== undefined ? { enabled } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(subtitle !== undefined ? { subtitle } : {}),
    ...(siteUrl !== undefined ? { site_url: siteUrl } : {}),
    ...(canonicalUrl !== undefined ? { canonical_url: canonicalUrl } : {}),
    ...(authorName !== undefined ? { author_name: authorName } : {}),
    ...(iconUrl !== undefined ? { icon_url: iconUrl } : {}),
    ...(entryLimit !== undefined ? { entry_limit: entryLimit } : {}),
  };
}

async function runAudienceFeed(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const action = parsed.positional[2];
  const audienceId = requirePositional(parsed.positional, 3, "audience id");
  if (action === "get") {
    writeJson(out, await client.audiences.feeds.get(audienceId));
    return;
  }

  const idempotencyKey = getString(parsed.options, "idempotency-key");
  const methodOptions = idempotencyKey ? { idempotencyKey } : undefined;
  if (action === "update") {
    writeJson(
      out,
      await client.audiences.feeds.update(
        audienceId,
        audienceFeedUpdateParams(parsed.options),
        methodOptions,
      ),
    );
    return;
  }
  if (action === "rotate") {
    writeJson(out, await client.audiences.feeds.rotate(audienceId, methodOptions));
    return;
  }
  if (action === "revoke") {
    writeJson(out, await client.audiences.feeds.revoke(audienceId, methodOptions));
    return;
  }
  throw new CliUsageError("Unknown audiences feed command.");
}

async function welcomeStepParams(options: ParsedArgs["options"]): Promise<UpdateWelcomeStepParams> {
  const subject = getString(options, "subject");
  const previewText = getString(options, "preview-text");
  const waitMinutes = getNumber(options, "wait-minutes");
  const senderIdentityId = getString(options, "sender-identity-id");
  const stylingMode = parseStylingMode(options);
  const trackEngagement = getBoolean(options, "track-engagement");
  const addUtmTags = getBoolean(options, "add-utm-tags");
  const blocksInput = getString(options, "blocks");
  const blocks = blocksInput ? await readNewsletterBlocks(blocksInput) : undefined;
  const contentMarkdown = await readNewsletterMarkdown(options);
  if (waitMinutes !== undefined && (!Number.isInteger(waitMinutes) || waitMinutes < 0)) {
    throw new CliUsageError("--wait-minutes must be a whole number of minutes, 0 or more.");
  }
  return {
    ...(subject !== undefined ? { subject } : {}),
    ...(previewText !== undefined ? { preview_text: previewText } : {}),
    ...(blocks ? { blocks } : {}),
    ...(contentMarkdown !== undefined ? { content_markdown: contentMarkdown } : {}),
    ...(waitMinutes !== undefined ? { wait_minutes: waitMinutes } : {}),
    ...(senderIdentityId !== undefined ? { sender_identity_id: senderIdentityId } : {}),
    ...(stylingMode !== undefined ? { styling_mode: stylingMode } : {}),
    ...(trackEngagement !== undefined ? { track_engagement: trackEngagement } : {}),
    ...(addUtmTags !== undefined ? { add_utm_tags: addUtmTags } : {}),
  };
}

async function runAudienceWelcome(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const action = parsed.positional[2];
  const audienceId = requirePositional(parsed.positional, 3, "audience id");
  if (action === "get") {
    writeJson(out, await client.audiences.welcomeSequence.get(audienceId));
    return;
  }
  const idempotencyKey = getString(parsed.options, "idempotency-key");
  const methodOptions = idempotencyKey ? { idempotencyKey } : undefined;
  if (action === "enable" || action === "disable") {
    writeJson(
      out,
      await client.audiences.welcomeSequence.update(
        audienceId,
        { enabled: action === "enable" },
        methodOptions,
      ),
    );
    return;
  }
  if (action === "add-step") {
    const params = await welcomeStepParams(parsed.options);
    if (!params.subject) throw new CliUsageError("--subject is required.");
    if (!params.blocks?.length && !params.content_markdown?.trim()) {
      throw new CliUsageError("Provide --blocks or --markdown.");
    }
    writeJson(
      out,
      await client.audiences.welcomeSequence.createStep(
        audienceId,
        { ...params, subject: params.subject },
        methodOptions,
      ),
    );
    return;
  }
  const stepId = requirePositional(parsed.positional, 4, "step id");
  if (action === "update-step") {
    const params = await welcomeStepParams(parsed.options);
    if (Object.keys(params).length === 0) {
      throw new CliUsageError("Provide at least one field to update.");
    }
    writeJson(
      out,
      await client.audiences.welcomeSequence.updateStep(audienceId, stepId, params, methodOptions),
    );
    return;
  }
  if (action === "remove-step") {
    writeJson(
      out,
      await client.audiences.welcomeSequence.deleteStep(audienceId, stepId, methodOptions),
    );
    return;
  }
  throw new CliUsageError("Unknown audiences welcome command.");
}

async function runAudiences(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "subscribers") {
    await runSubscribers(client, parsed, out);
    return;
  }
  if (subcommand === "feed") {
    await runAudienceFeed(client, parsed, out);
    return;
  }
  if (subcommand === "welcome") {
    await runAudienceWelcome(client, parsed, out);
    return;
  }
  if (subcommand === "list") {
    writeJson(
      out,
      await client.audiences.list({
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  if (subcommand === "create") {
    const description = getString(parsed.options, "description");
    writeJson(
      out,
      await client.audiences.create({
        name: requirePositional(parsed.positional, 2, "audience name"),
        consent_source: getRequiredString(parsed.options, "consent-source"),
        ...(description ? { description } : {}),
      }),
    );
    return;
  }
  if (subcommand === "get") {
    writeJson(
      out,
      await client.audiences.get(requirePositional(parsed.positional, 2, "audience id")),
    );
    return;
  }
  if (subcommand === "update") {
    const id = requirePositional(parsed.positional, 2, "audience id");
    const name = getString(parsed.options, "name");
    const description = getString(parsed.options, "description");
    const cleanup_enabled = getBoolean(parsed.options, "cleanup");
    const cleanup_ignored_issues = getNumber(parsed.options, "cleanup-ignored-issues");
    const cleanup_inactive_days = getNumber(parsed.options, "cleanup-inactive-days");
    writeJson(
      out,
      await client.audiences.update(id, {
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        ...(cleanup_enabled !== undefined ? { cleanup_enabled } : {}),
        ...(cleanup_ignored_issues !== undefined ? { cleanup_ignored_issues } : {}),
        ...(cleanup_inactive_days !== undefined ? { cleanup_inactive_days } : {}),
      }),
    );
    return;
  }
  if (subcommand === "delete") {
    const id = requirePositional(parsed.positional, 2, "audience id");
    await client.audiences.delete(id);
    writeJson(out, { ok: true, id });
    return;
  }
  throw new CliUsageError("Unknown audiences command.");
}

async function runNewsletterDomains(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    writeJson(
      out,
      await client.newsletters.domains.list({
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  throw new CliUsageError("Unknown newsletter-domains command.");
}

async function runNewsletterSenderIdentities(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    writeJson(
      out,
      await client.newsletters.senderIdentities.list({
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
      }),
    );
    return;
  }
  throw new CliUsageError("Unknown newsletter-sender-identities command.");
}

async function runNewsletters(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "create") {
    writeJson(out, await client.newsletters.create(await newsletterCreateParams(parsed.options)));
    return;
  }
  if (subcommand === "update") {
    const id = requirePositional(parsed.positional, 2, "newsletter id");
    writeJson(
      out,
      await client.newsletters.update(id, await newsletterUpdateParams(parsed.options)),
    );
    return;
  }
  if (subcommand === "preview") {
    writeJson(
      out,
      await client.newsletters.preview(requirePositional(parsed.positional, 2, "newsletter id")),
    );
    return;
  }
  if (subcommand === "preflight") {
    writeJson(
      out,
      await client.newsletters.preflight(requirePositional(parsed.positional, 2, "newsletter id")),
    );
    return;
  }
  if (subcommand === "test-send") {
    writeJson(
      out,
      await client.newsletters.sendTest(requirePositional(parsed.positional, 2, "newsletter id"), {
        recipient_email: getRequiredString(parsed.options, "recipient-email"),
      }),
    );
    return;
  }
  if (subcommand === "schedule") {
    const limit = getNumber(parsed.options, "limit");
    writeJson(
      out,
      await client.newsletters.schedule(requirePositional(parsed.positional, 2, "newsletter id"), {
        scheduled_at: getRequiredString(parsed.options, "scheduled-at"),
        ...(limit !== undefined ? { limit } : {}),
      }),
    );
    return;
  }
  if (subcommand === "send-more") {
    const count = getNumber(parsed.options, "count");
    writeJson(
      out,
      await client.newsletters.sendToMore(
        requirePositional(parsed.positional, 2, "newsletter id"),
        count !== undefined ? { count } : {},
      ),
    );
    return;
  }
  if (subcommand === "cancel") {
    writeJson(
      out,
      await client.newsletters.cancel(requirePositional(parsed.positional, 2, "newsletter id")),
    );
    return;
  }
  if (subcommand === "resume") {
    writeJson(
      out,
      await client.newsletters.resume(requirePositional(parsed.positional, 2, "newsletter id")),
    );
    return;
  }
  throw new CliUsageError("Unknown newsletters command.");
}

async function runNewsletterAssets(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
  fetchImpl: typeof fetch,
): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "list") {
    const kind = getString(parsed.options, "kind");
    if (kind !== undefined && kind !== "image" && kind !== "video") {
      throw new CliUsageError("--kind must be image or video.");
    }
    writeJson(
      out,
      await client.newsletters.assets.list({
        cursor: getString(parsed.options, "cursor"),
        limit: getNumber(parsed.options, "limit"),
        kind,
        q: getString(parsed.options, "q"),
      }),
    );
    return;
  }
  if (subcommand === "upload") {
    const filePath = requirePositional(parsed.positional, 2, "file");
    const data = await readFile(realpathSync(filePath));
    const filename =
      getString(parsed.options, "filename") ?? filePath.split(/[\\/]/).at(-1) ?? "newsletter-asset";
    const contentType = newsletterAssetContentType(
      filePath,
      getString(parsed.options, "content-type"),
    );
    const thumbnail = contentType.startsWith("video/")
      ? await readNewsletterVideoThumbnail(parsed.options)
      : undefined;
    const prepared = await client.newsletters.assets.prepareUpload({
      filename,
      content_type: contentType,
      size: data.byteLength,
      sha256: createHash("sha256").update(data).digest("hex"),
    });

    await putPreparedNewsletterBytes(fetchImpl, prepared.upload_url, prepared.upload_headers, data);
    if (prepared.kind === "video") {
      if (!thumbnail) throw new CliUsageError("Video uploads require --thumbnail <jpeg-file>.");
      await putPreparedNewsletterBytes(
        fetchImpl,
        prepared.thumbnail_upload_url,
        prepared.thumbnail_upload_headers,
        thumbnail,
      );
    }

    const completion = await fetchImpl(prepared.complete_url, {
      method: prepared.complete_method,
      redirect: "error",
    });
    if (!completion.ok) {
      throw new CliHttpError(completion.status, { response: await completion.text() });
    }
    const asset: unknown = await completion.json();
    writeJson(out, asset);
    return;
  }
  if (subcommand === "register-url") {
    writeJson(
      out,
      await client.newsletters.assets.registerFromUrl({
        url: requirePositional(parsed.positional, 2, "url"),
        filename: getString(parsed.options, "filename"),
        thumbnail_url: getString(parsed.options, "thumbnail-url"),
      }),
    );
    return;
  }
  throw new CliUsageError("Unknown newsletter-assets command.");
}

function newsletterAssetContentType(
  filePath: string,
  declared: string | undefined,
): NewsletterAssetContentType {
  const value = declared?.trim().toLowerCase() ?? "";
  switch (value) {
    case "image/gif":
    case "image/jpeg":
    case "image/png":
    case "image/webp":
    case "video/mp4":
    case "video/quicktime":
    case "video/webm":
      return value;
    default:
      if (value) throw new CliUsageError("Unsupported newsletter asset content type.");
  }

  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith(".gif")) return "image/gif";
  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) return "image/jpeg";
  if (lowerPath.endsWith(".png")) return "image/png";
  if (lowerPath.endsWith(".webp")) return "image/webp";
  if (lowerPath.endsWith(".mp4")) return "video/mp4";
  if (lowerPath.endsWith(".mov")) return "video/quicktime";
  if (lowerPath.endsWith(".webm")) return "video/webm";
  throw new CliUsageError("Use --content-type for this newsletter asset file.");
}

async function readNewsletterVideoThumbnail(options: ParsedArgs["options"]): Promise<Uint8Array> {
  const thumbnailPath = getString(options, "thumbnail");
  if (!thumbnailPath) throw new CliUsageError("Video uploads require --thumbnail <jpeg-file>.");
  const bytes = await readFile(realpathSync(thumbnailPath));
  if (bytes.byteLength < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new CliUsageError("--thumbnail must be a JPEG file.");
  }
  return bytes;
}

function uploadBody(bytes: Uint8Array): ArrayBuffer {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return body;
}

async function putPreparedNewsletterBytes(
  fetchImpl: typeof fetch,
  url: string,
  headers: NewsletterAssetUpload["upload_headers"],
  bytes: Uint8Array,
): Promise<void> {
  const response = await fetchImpl(url, {
    method: "PUT",
    headers,
    body: uploadBody(bytes),
    redirect: "error",
  });
  if (!response.ok) {
    throw new CliHttpError(response.status, { response: await response.text() });
  }
}

const CALENDAR_EVENT_STATUSES = [
  "confirmed",
  "tentative",
  "cancelled",
] as const satisfies readonly NonNullable<CreateCalendarEventParams["status"]>[];
const CALENDAR_FREE_BUSY_STATUSES = ["free", "busy"] as const satisfies readonly NonNullable<
  CreateCalendarEventParams["free_busy_status"]
>[];
const CALENDAR_PRIVACIES = ["public", "private", "secret"] as const satisfies readonly NonNullable<
  CreateCalendarEventParams["privacy"]
>[];
const CALENDAR_INVITATION_LANGUAGES = ["en", "fr", "es"] as const satisfies readonly NonNullable<
  CreateCalendarEventParams["invitation_language"]
>[];

type CalendarEventCliFields = Pick<
  CreateCalendarEventParams,
  | "description"
  | "timezone"
  | "duration"
  | "all_day"
  | "location"
  | "video_url"
  | "color"
  | "status"
  | "free_busy_status"
  | "privacy"
  | "invitation_language"
  | "reminders"
  | "attendees"
>;

function requireNumber(options: ParsedArgs["options"], key: string): number {
  const value = getNumber(options, key);
  if (value === undefined) throw new CliUsageError(`Missing --${key}.`);
  return value;
}

function getIntList(options: ParsedArgs["options"], key: string): number[] {
  return getStringList(options, key).map((raw) => {
    const value = Number(raw);
    if (!Number.isInteger(value)) {
      throw new CliUsageError(`--${key} must be a comma-separated list of integers.`);
    }
    return value;
  });
}

function requireIntList(options: ParsedArgs["options"], key: string): number[] {
  const values = getIntList(options, key);
  if (values.length === 0) throw new CliUsageError(`Missing --${key}.`);
  return values;
}

function getEnum<T extends string>(
  options: ParsedArgs["options"],
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = getString(options, key);
  if (value === undefined) return undefined;
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new CliUsageError(`--${key} must be one of: ${allowed.join(", ")}.`);
  }
  return match;
}

function getConferencingProvider(
  options: ParsedArgs["options"],
): ConferencingProviderId | null | undefined {
  const value = getString(options, "conferencing-provider");
  if (value === undefined) return undefined;
  if (value === "none") return null;
  return getEnum(options, "conferencing-provider", CONFERENCING_PROVIDER_IDS);
}

function isReminderArray(value: unknown): value is readonly Reminder[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        !Array.isArray(item) &&
        Number.isInteger((item as { readonly minutes_before?: unknown }).minutes_before),
    )
  );
}

async function readRemindersInput(
  value: string | undefined,
): Promise<readonly Reminder[] | undefined> {
  const parsed = await readJsonInput(value);
  if (parsed === undefined) return undefined;
  if (!isReminderArray(parsed)) {
    throw new CliUsageError("--reminders must be a JSON array of { minutes_before } objects.");
  }
  return parsed;
}

function isAttendeeArray(value: unknown): value is readonly { email: string; name?: string }[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
      const email = Reflect.get(item, "email");
      const name = Reflect.get(item, "name");
      return typeof email === "string" && (name === undefined || typeof name === "string");
    })
  );
}

async function readAttendeesInput(
  value: string | undefined,
): Promise<readonly { email: string; name?: string }[] | undefined> {
  const parsed = await readJsonInput(value);
  if (parsed === undefined) return undefined;
  if (!isAttendeeArray(parsed)) {
    throw new CliUsageError("--attendees must be a JSON array of { email, name? } objects.");
  }
  return parsed;
}

async function calendarEventFields(
  options: ParsedArgs["options"],
): Promise<Partial<CalendarEventCliFields>> {
  const description = getString(options, "description");
  const timezone = getString(options, "timezone");
  const duration = getString(options, "duration");
  const allDay = getBoolean(options, "all-day");
  const location = getString(options, "location");
  const videoUrl = getString(options, "video-url");
  const color = getString(options, "color");
  const status = getEnum(options, "status", CALENDAR_EVENT_STATUSES);
  const freeBusyStatus = getEnum(options, "free-busy-status", CALENDAR_FREE_BUSY_STATUSES);
  const privacy = getEnum(options, "privacy", CALENDAR_PRIVACIES);
  const invitationLanguage = getEnum(options, "invitation-language", CALENDAR_INVITATION_LANGUAGES);
  const reminders = await readRemindersInput(getString(options, "reminders"));
  const attendees = await readAttendeesInput(getString(options, "attendees"));

  return {
    ...(description !== undefined ? { description } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(allDay !== undefined ? { all_day: allDay } : {}),
    ...(location !== undefined ? { location } : {}),
    ...(videoUrl !== undefined ? { video_url: videoUrl } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(freeBusyStatus !== undefined ? { free_busy_status: freeBusyStatus } : {}),
    ...(privacy !== undefined ? { privacy } : {}),
    ...(invitationLanguage !== undefined ? { invitation_language: invitationLanguage } : {}),
    ...(reminders !== undefined ? { reminders } : {}),
    ...(attendees !== undefined ? { attendees } : {}),
  };
}

async function runCalendarEvents(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[2];
  const options = parsed.options;
  if (subcommand === "list") {
    const params: ListCalendarEventsParams = {
      mailbox: getRequiredString(options, "mailbox"),
      from: getRequiredString(options, "from"),
      to: getRequiredString(options, "to"),
      expand: getBoolean(options, "expand"),
      calendar_id: getString(options, "calendar-id"),
      cursor: getString(options, "cursor"),
      limit: getNumber(options, "limit"),
    };
    writeJson(out, await client.calendar.events.list(params));
    return;
  }
  if (subcommand === "create") {
    const params: CreateCalendarEventParams = {
      mailbox: getRequiredString(options, "mailbox"),
      title: getRequiredString(options, "title"),
      start: getRequiredString(options, "start"),
      calendar_id: getString(options, "calendar-id"),
      operation_key: getString(options, "operation-key"),
      send_invitations: getBoolean(options, "send-invitations"),
      ...(await calendarEventFields(options)),
    };
    writeJson(out, await client.calendar.events.create(params));
    return;
  }
  if (subcommand === "get") {
    const id = requirePositional(parsed.positional, 3, "event id");
    writeJson(
      out,
      await client.calendar.events.get(id, { mailbox: getRequiredString(options, "mailbox") }),
    );
    return;
  }
  if (subcommand === "update") {
    const id = requirePositional(parsed.positional, 3, "event id");
    const params: UpdateCalendarEventParams = {
      mailbox: getRequiredString(options, "mailbox"),
      title: getString(options, "title"),
      start: getString(options, "start"),
      operation_key: getString(options, "operation-key"),
      expected_revision: getString(options, "expected-revision"),
      send_guest_updates: getBoolean(options, "send-guest-updates"),
      ...(await calendarEventFields(options)),
    };
    writeJson(out, await client.calendar.events.update(id, params));
    return;
  }
  if (subcommand === "delete") {
    const id = requirePositional(parsed.positional, 3, "event id");
    await client.calendar.events.delete(id, { mailbox: getRequiredString(options, "mailbox") });
    writeJson(out, { ok: true, id });
    return;
  }
  throw new CliUsageError("Unknown calendar events command.");
}

async function runCalendar(client: ShipmailClient, parsed: ParsedArgs, out: Output): Promise<void> {
  const subcommand = parsed.positional[1];
  if (subcommand === "events") {
    await runCalendarEvents(client, parsed, out);
    return;
  }
  if (subcommand === "availability") {
    const options = parsed.options;
    const days = getIntList(options, "days");
    const params: CalendarAvailabilityParams = {
      mailbox: getRequiredString(options, "mailbox"),
      from: getRequiredString(options, "from"),
      to: getRequiredString(options, "to"),
      duration: getNumber(options, "duration"),
      interval: getNumber(options, "interval"),
      timezone: getString(options, "timezone"),
      ...(days.length > 0 ? { days } : {}),
      window_start: getNumber(options, "window-start"),
      window_end: getNumber(options, "window-end"),
      buffer: getNumber(options, "buffer"),
      minimum_notice: getNumber(options, "minimum-notice"),
    };
    writeJson(out, await client.calendar.availability(params));
    return;
  }
  throw new CliUsageError("Unknown calendar command.");
}

function parseBookingLinkRanges(
  options: ParsedArgs["options"],
): readonly BookingLinkRange[] | null | undefined {
  const values = getStringList(options, "range");
  if (values.length === 0) return undefined;
  if (values.length === 1 && values[0] === "none") return null;
  return values.map((value) => {
    const [start, end, extra] = value.split("/");
    if (!start || !end || extra !== undefined) {
      throw new CliUsageError("--range must be <start>/<end>, two ISO 8601 instants.");
    }
    return { start, end };
  });
}

function getMaxBookings(options: ParsedArgs["options"]): number | null | undefined {
  if (getString(options, "max-bookings") === "unlimited") return null;
  return getNumber(options, "max-bookings");
}

function getNullableString(options: ParsedArgs["options"], key: string): string | null | undefined {
  const value = getString(options, key);
  return value === "none" ? null : value;
}

async function runBookingLinks(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  const options = parsed.options;
  if (subcommand === "list") {
    writeJson(
      out,
      await client.bookingLinks.list({
        cursor: getString(options, "cursor"),
        limit: getNumber(options, "limit"),
        status: getEnum(options, "status", BOOKING_LINK_STATUSES),
      }),
    );
    return;
  }
  if (subcommand === "create") {
    const ranges = parseBookingLinkRanges(options);
    if (ranges === null) throw new CliUsageError("--range none only applies to update.");
    const params: CreateBookingLinkParams = {
      name: getRequiredString(options, "name"),
      mailbox: getRequiredString(options, "mailbox"),
      duration_minutes: requireNumber(options, "duration-minutes"),
      timezone: getRequiredString(options, "timezone"),
      offered_ranges: ranges,
      source_page_id: getString(options, "source-page"),
      description: getString(options, "description"),
      buffer_minutes: getNumber(options, "buffer-minutes"),
      minimum_notice_minutes: getNumber(options, "minimum-notice-minutes"),
      conferencing_provider: getConferencingProvider(options),
      max_bookings: getMaxBookings(options),
      expires_at: getString(options, "expires-at"),
    };
    writeJson(out, await client.bookingLinks.create(params));
    return;
  }
  if (subcommand === "get") {
    writeJson(
      out,
      await client.bookingLinks.get(requirePositional(parsed.positional, 2, "booking link id")),
    );
    return;
  }
  if (subcommand === "update") {
    const id = requirePositional(parsed.positional, 2, "booking link id");
    const params: UpdateBookingLinkParams = {
      name: getString(options, "name"),
      mailbox: getString(options, "mailbox"),
      duration_minutes: getNumber(options, "duration-minutes"),
      timezone: getString(options, "timezone"),
      offered_ranges: parseBookingLinkRanges(options),
      source_page_id: getNullableString(options, "source-page"),
      description: getString(options, "description"),
      buffer_minutes: getNumber(options, "buffer-minutes"),
      minimum_notice_minutes: getNumber(options, "minimum-notice-minutes"),
      conferencing_provider: getConferencingProvider(options),
      max_bookings: getMaxBookings(options),
      expires_at: getNullableString(options, "expires-at"),
    };
    writeJson(out, await client.bookingLinks.update(id, params));
    return;
  }
  if (subcommand === "revoke") {
    const id = requirePositional(parsed.positional, 2, "booking link id");
    writeJson(out, await client.bookingLinks.revoke(id));
    return;
  }
  throw new CliUsageError("Unknown booking-links command.");
}

async function runBookingPages(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  const options = parsed.options;
  if (subcommand === "list") {
    writeJson(
      out,
      await client.bookingPages.list({
        cursor: getString(options, "cursor"),
        limit: getNumber(options, "limit"),
      }),
    );
    return;
  }
  if (subcommand === "create") {
    const params: CreateBookingPageParams = {
      name: getRequiredString(options, "name"),
      mailbox: getRequiredString(options, "mailbox"),
      slug: getRequiredString(options, "slug"),
      duration_minutes: requireNumber(options, "duration-minutes"),
      availability_days: requireIntList(options, "availability-days"),
      window_start_minutes: requireNumber(options, "window-start-minutes"),
      window_end_minutes: requireNumber(options, "window-end-minutes"),
      timezone: getRequiredString(options, "timezone"),
      description: getString(options, "description"),
      buffer_minutes: getNumber(options, "buffer-minutes"),
      minimum_notice_minutes: getNumber(options, "minimum-notice-minutes"),
      max_advance_days: getNumber(options, "max-advance-days"),
      conferencing_provider: getConferencingProvider(options),
      active: getBoolean(options, "active"),
    };
    writeJson(out, await client.bookingPages.create(params));
    return;
  }
  if (subcommand === "get") {
    writeJson(
      out,
      await client.bookingPages.get(requirePositional(parsed.positional, 2, "booking page id")),
    );
    return;
  }
  if (subcommand === "update") {
    const id = requirePositional(parsed.positional, 2, "booking page id");
    const days = getIntList(options, "availability-days");
    const params: UpdateBookingPageParams = {
      name: getString(options, "name"),
      mailbox: getString(options, "mailbox"),
      slug: getString(options, "slug"),
      duration_minutes: getNumber(options, "duration-minutes"),
      ...(days.length > 0 ? { availability_days: days } : {}),
      window_start_minutes: getNumber(options, "window-start-minutes"),
      window_end_minutes: getNumber(options, "window-end-minutes"),
      timezone: getString(options, "timezone"),
      description: getString(options, "description"),
      buffer_minutes: getNumber(options, "buffer-minutes"),
      minimum_notice_minutes: getNumber(options, "minimum-notice-minutes"),
      max_advance_days: getNumber(options, "max-advance-days"),
      conferencing_provider: getConferencingProvider(options),
      active: getBoolean(options, "active"),
    };
    writeJson(out, await client.bookingPages.update(id, params));
    return;
  }
  if (subcommand === "delete") {
    const id = requirePositional(parsed.positional, 2, "booking page id");
    await client.bookingPages.delete(id);
    writeJson(out, { ok: true, id });
    return;
  }
  throw new CliUsageError("Unknown booking-pages command.");
}

async function runAutomations(
  client: ShipmailClient,
  parsed: ParsedArgs,
  out: Output,
): Promise<void> {
  const subcommand = parsed.positional[1];
  const idempotencyKey = getString(parsed.options, "idempotency-key");
  const options = idempotencyKey ? { idempotencyKey } : undefined;
  if (subcommand === "list") {
    writeJson(out, await client.automations.list());
    return;
  }
  if (subcommand === "create") {
    writeJson(
      out,
      await client.automations.create(
        {
          name: getRequiredString(parsed.options, "name"),
          definition: await automationDefinition(getRequiredString(parsed.options, "definition")),
        },
        options,
      ),
    );
    return;
  }
  const id = requirePositional(parsed.positional, 2, "automation id");
  if (subcommand === "get") {
    writeJson(out, await client.automations.get(id));
    return;
  }
  if (subcommand === "update") {
    const name = getString(parsed.options, "name");
    const definitionInput = getString(parsed.options, "definition");
    const status = automationStatus(parsed.options);
    const params: UpdateAutomationParams = {
      ...(name !== undefined ? { name } : {}),
      ...(definitionInput !== undefined
        ? { definition: await automationDefinition(definitionInput) }
        : {}),
      ...(status !== undefined ? { status } : {}),
    };
    if (Object.keys(params).length === 0) {
      throw new CliUsageError("Provide --name, --definition, or --status.");
    }
    writeJson(out, await client.automations.update(id, params, options));
    return;
  }
  if (subcommand === "run") {
    writeJson(out, await client.automations.run(id, options));
    return;
  }
  throw new CliUsageError("Unknown automations command.");
}

function writeError(err: unknown, errOut: Output): void {
  if (err instanceof CliUsageError) {
    errOut.write(`Error: ${err.message}\n\n${usage()}`);
    return;
  }
  if (err instanceof CliHttpError) {
    errOut.write(`Error: HTTP ${err.status}\n${JSON.stringify(err.body, null, 2)}\n`);
    return;
  }
  if (err instanceof ShipmailError) {
    const shipmailError = err;
    const status = shipmailError.status !== undefined ? ` (HTTP ${shipmailError.status})` : "";
    const requestId = shipmailError.requestId ? ` request_id=${shipmailError.requestId}` : "";
    // The tracking row an interrupted send left behind, so the operator can look
    // it up instead of running the send again.
    const messageId =
      shipmailError instanceof ReconciliationRequiredError && shipmailError.messageId
        ? ` message_id=${shipmailError.messageId}`
        : "";
    errOut.write(`Error: ${shipmailError.message}${status}${requestId}${messageId}\n`);
    if (shipmailError instanceof ValidationError) {
      for (const detail of shipmailError.details ?? []) {
        const code = detail.code ? ` (${detail.code})` : "";
        errOut.write(`  ${detail.field}: ${detail.message}${code}\n`);
      }
    }
    // A refusal the organization owner can lift in Shipmail: print where, so a person or an agent
    // reading the output can pass the link on.
    if (shipmailError.actionUrl) {
      const reason = shipmailError.reason ? ` (${shipmailError.reason})` : "";
      errOut.write(`Ask the organization owner to open${reason}: ${shipmailError.actionUrl}\n`);
    }
    if (shipmailError.limit) {
      const { resource, used, limit, scope } = shipmailError.limit;
      errOut.write(`Limit: ${resource} ${used} of ${limit} (${scope})\n`);
    }
    return;
  }
  errOut.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
}

export async function runCli(
  argv: readonly string[],
  options: RunCliOptions = {},
): Promise<number> {
  const parsed = parseCliArgs(argv);
  const out = options.stdout ?? stdout;
  const errOut = options.stderr ?? stderr;
  const command = parsed.positional[0];

  try {
    if (command === "version" || optionValue(parsed.options, "version")) {
      out.write(`${CLI_VERSION}\n`);
      return 0;
    }

    if ((command === "login" || command === "logout") && optionValue(parsed.options, "help")) {
      out.write(loginUsage());
      return 0;
    }

    if (!command || command === "help" || command === "-h" || optionValue(parsed.options, "help")) {
      out.write(usage());
      return 0;
    }

    if (command === "status") {
      const response = await rawApiRequest(parsed, options, "GET", "/status", undefined, false);
      await writeRawResponse(parsed, { stdout: out }, response);
      return 0;
    }

    if (command === "capabilities") {
      const response = await rawApiRequest(
        parsed,
        options,
        "GET",
        "/capabilities",
        undefined,
        true,
      );
      await writeRawResponse(parsed, { stdout: out }, response);
      return 0;
    }

    if (command === "api") {
      const method = requirePositional(parsed.positional, 1, "method").toUpperCase();
      const path = apiPath(requirePositional(parsed.positional, 2, "path"));
      const body = await readJsonInput(getString(parsed.options, "data"));
      const response = await rawApiRequest(parsed, options, method, path, body, path !== "/status");
      await writeRawResponse(parsed, { stdout: out }, response);
      return 0;
    }

    if (command === "login") {
      await runLogin(parsed, options, out);
      return 0;
    }

    if (command === "logout") {
      await runLogout(parsed, options, out);
      return 0;
    }

    const client = await createClient(parsed, options);
    if (command === "organization") {
      if (parsed.positional[1] !== "access") {
        throw new CliUsageError("Unknown organization command.");
      }
      writeJson(out, await client.organization.access());
    } else if (command === "automations") await runAutomations(client, parsed, out);
    else if (command === "domains") await runDomains(client, parsed, out);
    else if (command === "mailboxes") await runMailboxes(client, parsed, out);
    else if (command === "members") await runMembers(client, parsed, out);
    else if (command === "inbox") await runInbox(client, parsed, out);
    else if (command === "messages") await runMessages(client, parsed, out);
    else if (command === "scheduled-messages") await runScheduledMessages(client, parsed, out);
    else if (command === "reply-scans") await runReplyScans(client, parsed, out);
    else if (command === "webhooks") await runWebhooks(client, parsed, out);
    else if (command === "suppressions") await runSuppressions(client, parsed, out);
    else if (command === "templates") await runTemplates(client, parsed, out);
    else if (command === "newsletters") await runNewsletters(client, parsed, out);
    else if (command === "newsletter-assets")
      await runNewsletterAssets(client, parsed, out, options.fetch ?? globalThis.fetch);
    else if (command === "newsletter-sender-identities")
      await runNewsletterSenderIdentities(client, parsed, out);
    else if (command === "newsletter-domains") await runNewsletterDomains(client, parsed, out);
    else if (command === "audiences") await runAudiences(client, parsed, out);
    else if (command === "calendar") await runCalendar(client, parsed, out);
    else if (command === "booking-pages") await runBookingPages(client, parsed, out);
    else if (command === "booking-links") await runBookingLinks(client, parsed, out);
    else throw new CliUsageError(`Unknown command: ${command}.`);
    return 0;
  } catch (err) {
    writeError(err, errOut);
    return 1;
  }
}

async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2));
  exit(code);
}

export function isMainModule(
  moduleUrl: string = import.meta.url,
  argvPath: string | undefined = process.argv[1],
): boolean {
  if (!argvPath) return false;
  return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argvPath);
}

if (isMainModule()) {
  void main();
}
