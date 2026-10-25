import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

import { z } from "zod";

import type { CredentialStore, StoredLogin } from "./credentials";

export const LOGIN_TIMEOUT_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
const SCOPE = "openid profile email offline_access";
const REGISTERED_REDIRECT_URI = "http://127.0.0.1/callback";

const protectedResourceSchema = z.object({
  resource: z.string(),
  authorization_servers: z.array(z.string()).min(1),
});

const authorizationServerSchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  registration_endpoint: z.string().optional(),
  revocation_endpoint: z.string().optional(),
  code_challenge_methods_supported: z.array(z.string()).optional(),
});

const registrationSchema = z.object({ client_id: z.string().min(1) });

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
});

const oauthErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

export class OAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

export type OAuthServer = {
  readonly resource: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly registrationEndpoint: string | undefined;
  readonly revocationEndpoint: string | undefined;
};

type TokenResponse = z.infer<typeof tokenSchema>;

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function getJson(fetchFn: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchFn(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`Sign-in discovery failed: ${url} returned ${response.status}.`);
  return response.json();
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`The server sent an invalid ${what}.`);
  return parsed.data;
}

function sameOrigin(url: string, origin: string, what: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`The server sent an invalid ${what}.`);
  }
  if (parsed.origin !== origin) throw new Error(`The ${what} is not on ${origin}.`);
  return url;
}

// RFC 9728 for the REST resource, then RFC 8414 for its authorization server. Every endpoint must
// live on the API's own origin, so a tampered document cannot send tokens elsewhere.
export async function discoverOAuthServer(
  apiBaseUrl: string,
  fetchFn: typeof fetch,
): Promise<OAuthServer> {
  const origin = new URL(apiBaseUrl).origin;
  const resource = `${origin}/api/v1`;
  const protectedResource = parseOrThrow(
    protectedResourceSchema,
    await getJson(fetchFn, `${origin}/.well-known/oauth-protected-resource/api/v1`),
    "protected resource document",
  );
  if (trimSlash(protectedResource.resource) !== resource) {
    throw new Error(`The protected resource document is not for ${resource}.`);
  }

  const [issuer = ""] = protectedResource.authorization_servers;
  const issuerUrl = new URL(sameOrigin(issuer, origin, "authorization server"));
  const issuerPath = trimSlash(issuerUrl.pathname);
  const metadata = parseOrThrow(
    authorizationServerSchema,
    await getJson(fetchFn, `${origin}/.well-known/oauth-authorization-server${issuerPath}`),
    "authorization server document",
  );
  if (trimSlash(metadata.issuer) !== trimSlash(issuer)) {
    throw new Error("The authorization server document names a different issuer.");
  }
  if (
    metadata.code_challenge_methods_supported &&
    !metadata.code_challenge_methods_supported.includes("S256")
  ) {
    throw new Error("The authorization server does not support PKCE with S256.");
  }

  return {
    resource,
    authorizationEndpoint: sameOrigin(
      metadata.authorization_endpoint,
      origin,
      "authorization endpoint",
    ),
    tokenEndpoint: sameOrigin(metadata.token_endpoint, origin, "token endpoint"),
    registrationEndpoint:
      metadata.registration_endpoint === undefined
        ? undefined
        : sameOrigin(metadata.registration_endpoint, origin, "registration endpoint"),
    revocationEndpoint:
      metadata.revocation_endpoint === undefined
        ? undefined
        : sameOrigin(metadata.revocation_endpoint, origin, "revocation endpoint"),
  };
}

async function oauthFailure(response: Response, fallback: string): Promise<OAuthError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = oauthErrorSchema.safeParse(body);
  if (!parsed.success)
    return new OAuthError("server_error", `${fallback} (HTTP ${response.status}).`);
  return new OAuthError(
    parsed.data.error,
    parsed.data.error_description
      ? `${fallback}: ${parsed.data.error_description}`
      : `${fallback}: ${parsed.data.error}`,
  );
}

export async function registerClient(server: OAuthServer, fetchFn: typeof fetch): Promise<string> {
  if (!server.registrationEndpoint) {
    throw new Error("The authorization server does not allow client registration.");
  }
  const response = await fetchFn(server.registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Shipmail CLI",
      application_type: "native",
      redirect_uris: [REGISTERED_REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await oauthFailure(response, "Client registration failed");
  return parseOrThrow(registrationSchema, await response.json(), "client registration").client_id;
}

async function tokenRequest(
  tokenEndpoint: string,
  fetchFn: typeof fetch,
  params: Record<string, string>,
  failure: string,
): Promise<TokenResponse> {
  const response = await fetchFn(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await oauthFailure(response, failure);
  const tokens = parseOrThrow(tokenSchema, await response.json(), "token response");
  if (tokens.token_type.toLowerCase() !== "bearer") {
    throw new Error("The server issued an unsupported token type.");
  }
  return tokens;
}

function storedTokens(
  tokens: TokenResponse,
  previousRefreshToken: string | undefined,
  now: number,
): Pick<StoredLogin, "accessToken" | "refreshToken" | "expiresAt"> {
  const refreshToken = tokens.refresh_token ?? previousRefreshToken;
  return {
    accessToken: tokens.access_token,
    ...(refreshToken ? { refreshToken } : {}),
    expiresAt: now + (tokens.expires_in ?? 3600) * 1000,
  };
}

export async function refreshLogin(
  login: StoredLogin,
  fetchFn: typeof fetch,
  now: number = Date.now(),
): Promise<StoredLogin> {
  if (!login.refreshToken) {
    throw new OAuthError("invalid_grant", "The login has expired and cannot be refreshed");
  }
  const tokens = await tokenRequest(
    login.tokenEndpoint,
    fetchFn,
    {
      grant_type: "refresh_token",
      refresh_token: login.refreshToken,
      client_id: login.clientId,
      resource: `${new URL(login.baseUrl).origin}/api/v1`,
    },
    "Token refresh failed",
  );
  return { ...login, ...storedTokens(tokens, login.refreshToken, now) };
}

export async function revokeToken(
  revocationEndpoint: string,
  clientId: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<void> {
  const response = await fetchFn(revocationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token,
      token_type_hint: "refresh_token",
      client_id: clientId,
    }).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await oauthFailure(response, "Token revocation failed");
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function callbackPage(message: string): string {
  return `<!doctype html><meta charset="utf-8"><title>Shipmail CLI</title><p>${message}</p>\n`;
}

type LoopbackListener = {
  readonly redirectUri: string;
  readonly code: Promise<string>;
  close(): void;
};

const LOOPBACK_ORIGIN = "http://127.0.0.1";

// The request target as a URL on the loopback origin, or null when it is malformed or names
// another host.
function callbackTarget(target: string | undefined): URL | null {
  if (!target?.startsWith("/")) return null;
  try {
    const url = new URL(target, LOOPBACK_ORIGIN);
    return url.origin === LOOPBACK_ORIGIN ? url : null;
  } catch {
    return null;
  }
}

// RFC 8252 section 7.3: listen on an ephemeral loopback port for the one callback that carries
// this attempt's state. Anything else gets an error page while the listener keeps waiting, so a
// stray or forged request cannot end the login.
export async function startLoopbackListener(
  expectedState: string,
  timeoutMs: number,
): Promise<LoopbackListener> {
  let settle: { resolve: (code: string) => void; reject: (error: Error) => void } | undefined;
  const code = new Promise<string>((resolve, reject) => {
    settle = { resolve, reject };
  });

  const server = createServer((request, response) => {
    const plain = (status: number, message: string) =>
      response
        .writeHead(status, { "Content-Type": "text/plain; charset=utf-8" })
        .end(`${message}\n`);
    if (request.method !== "GET") {
      plain(405, "Method not allowed");
      return;
    }
    const url = callbackTarget(request.url);
    if (!url || url.pathname !== "/callback") {
      plain(404, "Not found");
      return;
    }
    const reply = (status: number, message: string) =>
      response
        .writeHead(status, { "Content-Type": "text/html; charset=utf-8", Connection: "close" })
        .end(callbackPage(message));

    if (url.searchParams.get("state") !== expectedState) {
      reply(400, "This sign-in link does not match the CLI. Run shipmail login again.");
      return;
    }
    const error = url.searchParams.get("error");
    if (error) {
      const description = url.searchParams.get("error_description");
      reply(400, "Sign-in was not completed. You can close this tab.");
      settle?.reject(new OAuthError(error, `Sign-in failed: ${description ?? error}`));
      return;
    }
    const authorizationCode = url.searchParams.get("code");
    if (!authorizationCode) {
      reply(400, "The sign-in response had no code. Run shipmail login again.");
      settle?.reject(new Error("The sign-in response had no authorization code."));
      return;
    }
    reply(200, "Signed in to the Shipmail CLI. You can close this tab.");
    settle?.resolve(authorizationCode);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Could not open a local port for the sign-in callback.");
  }
  const { port } = address;

  const timer = setTimeout(() => {
    settle?.reject(
      new Error("Timed out waiting for the browser sign-in. Run shipmail login again."),
    );
  }, timeoutMs);

  return {
    redirectUri: `http://127.0.0.1:${port}/callback`,
    code,
    close() {
      clearTimeout(timer);
      server.close();
      server.closeAllConnections();
    },
  };
}

export function openInBrowser(url: string): void {
  const [command, args, verbatim] =
    process.platform === "darwin"
      ? ["open", [url], false]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", '""', `"${url}"`], true]
        : ["xdg-open", [url], false];
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsVerbatimArguments: verbatim,
    });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // The URL is printed as well, so a missing opener only costs a copy and paste.
  }
}

export type LoginOptions = {
  readonly baseUrl: string;
  readonly fetch: typeof fetch;
  readonly store: CredentialStore;
  readonly openBrowser: ((url: string) => void) | null;
  readonly print: (line: string) => void;
  readonly timeoutMs: number;
  readonly organizationId: string | undefined;
};

export async function login(options: LoginOptions): Promise<StoredLogin> {
  const server = await discoverOAuthServer(options.baseUrl, options.fetch);
  const existing = await options.store.read(options.baseUrl);
  const clientId = existing?.clientId ?? (await registerClient(server, options.fetch));

  const verifier = randomToken(32);
  const state = randomToken(16);
  const listener = await startLoopbackListener(state, options.timeoutMs);
  try {
    const authorizeUrl = new URL(server.authorizationEndpoint);
    authorizeUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: listener.redirectUri,
      scope: SCOPE,
      state,
      code_challenge: codeChallenge(verifier),
      code_challenge_method: "S256",
      resource: server.resource,
    }).toString();

    options.print("Open this URL to sign in to Shipmail:");
    options.print(authorizeUrl.toString());
    options.openBrowser?.(authorizeUrl.toString());

    const code = await listener.code;
    const tokens = await tokenRequest(
      server.tokenEndpoint,
      options.fetch,
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: listener.redirectUri,
        client_id: clientId,
        code_verifier: verifier,
        resource: server.resource,
      },
      "Sign-in failed",
    );
    const organizationId = options.organizationId ?? existing?.organizationId;
    const stored: StoredLogin = {
      baseUrl: options.baseUrl,
      clientId,
      ...storedTokens(tokens, undefined, Date.now()),
      tokenEndpoint: server.tokenEndpoint,
      ...(server.revocationEndpoint ? { revocationEndpoint: server.revocationEndpoint } : {}),
      ...(organizationId ? { organizationId } : {}),
    };
    await options.store.withLock(() => options.store.write(stored));
    return stored;
  } finally {
    listener.close();
  }
}
