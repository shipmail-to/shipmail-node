import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { runCli } from "./cli.js";
import {
  breakLock,
  type CommandRunner,
  credentialsFilePath,
  type CredentialStore,
  defaultCredentialStore,
  fileStore,
  keychainStore,
  secretToolStore,
  type StoredLogin,
  withFileLock,
} from "./credentials.js";
import { codeChallenge, discoverOAuthServer } from "./oauth.js";

const ORIGIN = "https://shipmail.to";
const BASE_URL = `${ORIGIN}/api/v1`;
const TOKEN_ENDPOINT = `${ORIGIN}/api/auth/oauth2/token`;
const REVOCATION_ENDPOINT = `${ORIGIN}/api/auth/oauth2/revoke`;

type Captured = { readonly url: URL; readonly init: RequestInit | undefined };

function createOutput() {
  let text = "";
  return {
    out: {
      write(chunk: string) {
        text += chunk;
      },
    },
    text: () => text,
  };
}

function memoryStore(initial: StoredLogin[] = []): CredentialStore & {
  readonly logins: Map<string, StoredLogin>;
} {
  const logins = new Map(initial.map((login) => [login.baseUrl, login]));
  return {
    kind: "file",
    logins,
    read: (baseUrl) => Promise.resolve(logins.get(baseUrl) ?? null),
    write: (login) => {
      logins.set(login.baseUrl, login);
      return Promise.resolve();
    },
    delete: (baseUrl) => {
      logins.delete(baseUrl);
      return Promise.resolve();
    },
    withLock: inProcessLock(),
  };
}

function inProcessLock(): CredentialStore["withLock"] {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const result = queue.then(fn);
    queue = result.catch(() => undefined);
    return result;
  };
}

function storedLogin(overrides: Partial<StoredLogin> = {}): StoredLogin {
  return {
    baseUrl: BASE_URL,
    clientId: "client_1",
    accessToken: "access_1",
    refreshToken: "refresh_1",
    expiresAt: Date.now() + 3_600_000,
    tokenEndpoint: TOKEN_ENDPOINT,
    revocationEndpoint: REVOCATION_ENDPOINT,
    ...overrides,
  };
}

function formBody(init: RequestInit | undefined): URLSearchParams {
  if (typeof init?.body !== "string") throw new Error("expected a form body");
  return new URLSearchParams(init.body);
}

function jsonBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") throw new Error("expected a JSON body");
  return JSON.parse(init.body);
}

const protectedResource = {
  resource: BASE_URL,
  resource_name: "Shipmail API",
  authorization_servers: [ORIGIN],
  bearer_methods_supported: ["header"],
};

const authorizationServer = {
  issuer: ORIGIN,
  authorization_endpoint: `${ORIGIN}/api/auth/oauth2/authorize`,
  token_endpoint: TOKEN_ENDPOINT,
  registration_endpoint: `${ORIGIN}/api/auth/oauth2/register`,
  revocation_endpoint: REVOCATION_ENDPOINT,
  code_challenge_methods_supported: ["S256"],
};

// A fake authorization server and REST API behind the injected fetch.
function fakeServer(
  overrides: {
    readonly token?: (body: URLSearchParams) => Response;
    readonly revoke?: () => Response;
    readonly asMetadata?: Record<string, unknown>;
  } = {},
) {
  const requests: Captured[] = [];
  const fetchFn = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    requests.push({ url, init });
    if (url.pathname === "/.well-known/oauth-protected-resource/api/v1") {
      return Promise.resolve(Response.json(protectedResource));
    }
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return Promise.resolve(Response.json(overrides.asMetadata ?? authorizationServer));
    }
    if (url.pathname === "/api/auth/oauth2/register") {
      return Promise.resolve(Response.json({ client_id: "client_1" }, { status: 201 }));
    }
    if (url.pathname === "/api/auth/oauth2/token") {
      const body = formBody(init);
      if (overrides.token) return Promise.resolve(overrides.token(body));
      const refreshed = body.get("grant_type") === "refresh_token";
      return Promise.resolve(
        Response.json({
          access_token: refreshed ? "access_2" : "access_1",
          refresh_token: refreshed ? "refresh_2" : "refresh_1",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      );
    }
    if (url.pathname === "/api/auth/oauth2/revoke") {
      return Promise.resolve(overrides.revoke?.() ?? new Response(null, { status: 200 }));
    }
    if (url.pathname === "/api/v1/domains") {
      return Promise.resolve(Response.json({ data: [], has_more: false, next_cursor: null }));
    }
    return Promise.resolve(Response.json({ error: "not found" }, { status: 404 }));
  };
  return {
    fetch: fetchFn as typeof fetch,
    requests,
    find: (pathname: string) => requests.filter((request) => request.url.pathname === pathname),
  };
}

// Plays the browser: follows the authorize URL by calling the CLI's loopback callback.
function browser(answer: (authorize: URL) => Record<string, string>) {
  const visits: URL[] = [];
  const responses: Promise<Response>[] = [];
  return {
    visits,
    responses,
    open(url: string) {
      const authorize = new URL(url);
      visits.push(authorize);
      const callback = new URL(authorize.searchParams.get("redirect_uri") ?? "");
      callback.search = new URLSearchParams(answer(authorize)).toString();
      responses.push(globalThis.fetch(callback));
    },
  };
}

const approve = (authorize: URL) => ({
  code: "code_1",
  state: authorize.searchParams.get("state") ?? "",
});

describe("discovery", () => {
  test("reads the REST protected resource and its authorization server", async () => {
    const server = fakeServer();
    expect(await discoverOAuthServer(BASE_URL, server.fetch)).toEqual({
      resource: BASE_URL,
      authorizationEndpoint: authorizationServer.authorization_endpoint,
      tokenEndpoint: TOKEN_ENDPOINT,
      registrationEndpoint: authorizationServer.registration_endpoint,
      revocationEndpoint: REVOCATION_ENDPOINT,
    });
    expect(server.requests.map((request) => request.url.toString())).toEqual([
      `${ORIGIN}/.well-known/oauth-protected-resource/api/v1`,
      `${ORIGIN}/.well-known/oauth-authorization-server`,
    ]);
  });

  test("refuses an endpoint on another origin", async () => {
    const server = fakeServer({
      asMetadata: { ...authorizationServer, token_endpoint: "https://evil.test/token" },
    });
    await expect(discoverOAuthServer(BASE_URL, server.fetch)).rejects.toThrow(
      "The token endpoint is not on https://shipmail.to.",
    );
  });

  test("refuses invalid metadata", async () => {
    const server = fakeServer({ asMetadata: { issuer: ORIGIN } });
    await expect(discoverOAuthServer(BASE_URL, server.fetch)).rejects.toThrow(
      "The server sent an invalid authorization server document.",
    );
  });
});

describe("shipmail login", () => {
  test("registers, signs in through the loopback callback, and stores the login", async () => {
    const server = fakeServer();
    const store = memoryStore();
    const play = browser(approve);
    const stdout = createOutput();
    const stderr = createOutput();

    const code = await runCli(["login", "--organization", "org_1"], {
      env: {},
      fetch: server.fetch,
      credentialStore: store,
      openBrowser: play.open,
      stdout: stdout.out,
      stderr: stderr.out,
    });

    expect(stderr.text()).toContain("Open this URL to sign in to Shipmail:");
    expect(code).toBe(0);
    expect(stdout.text()).toBe("Signed in to https://shipmail.to. Default organization: org_1.\n");

    const [registration] = server.find("/api/auth/oauth2/register");
    expect(jsonBody(registration?.init)).toEqual({
      client_name: "Shipmail CLI",
      application_type: "native",
      redirect_uris: ["http://127.0.0.1/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });

    const authorize = play.visits[0];
    if (!authorize) throw new Error("the browser was not opened");
    expect(stderr.text()).toContain(authorize.toString());
    const redirectUri = authorize.searchParams.get("redirect_uri") ?? "";
    expect(redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "client_1",
      scope: "openid profile email offline_access",
      code_challenge_method: "S256",
      resource: BASE_URL,
    });
    expect(authorize.searchParams.get("state")?.length).toBeGreaterThanOrEqual(16);

    const callback = await play.responses[0];
    expect(callback?.status).toBe(200);
    expect(await callback?.text()).toContain("You can close this tab.");

    const [tokenRequest] = server.find("/api/auth/oauth2/token");
    const tokenBody = formBody(tokenRequest?.init);
    expect(tokenBody.get("grant_type")).toBe("authorization_code");
    expect(tokenBody.get("code")).toBe("code_1");
    expect(tokenBody.get("redirect_uri")).toBe(redirectUri);
    expect(tokenBody.get("resource")).toBe(BASE_URL);
    expect(codeChallenge(tokenBody.get("code_verifier") ?? "")).toBe(
      authorize.searchParams.get("code_challenge") ?? "",
    );

    expect(store.logins.get(BASE_URL)).toMatchObject({
      clientId: "client_1",
      accessToken: "access_1",
      refreshToken: "refresh_1",
      tokenEndpoint: TOKEN_ENDPOINT,
      revocationEndpoint: REVOCATION_ENDPOINT,
      organizationId: "org_1",
    });
    expect(stdout.text() + stderr.text()).not.toContain("access_1");
    expect(stdout.text() + stderr.text()).not.toContain("refresh_1");
  });

  test("reuses the stored client and does not open a browser with --no-browser", async () => {
    const server = fakeServer();
    const store = memoryStore([storedLogin({ clientId: "client_saved" })]);
    const stderr = createOutput();
    let opened = false;

    const pending = runCli(["login", "--no-browser"], {
      env: {},
      fetch: server.fetch,
      credentialStore: store,
      openBrowser: () => {
        opened = true;
      },
      stdout: createOutput().out,
      stderr: stderr.out,
    });
    while (!stderr.text().includes("http")) await Bun.sleep(5);
    const authorize = new URL(stderr.text().trim().split("\n").at(-1) ?? "");
    const callback = new URL(authorize.searchParams.get("redirect_uri") ?? "");
    callback.search = new URLSearchParams(approve(authorize)).toString();
    await globalThis.fetch(callback);

    expect(await pending).toBe(0);
    expect(opened).toBe(false);
    expect(authorize.searchParams.get("client_id")).toBe("client_saved");
    expect(server.find("/api/auth/oauth2/register")).toHaveLength(0);
  });

  // Sends a raw HTTP request, so the request target reaches the listener unnormalized.
  function rawRequest(callback: URL, requestLine: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = connect(Number(callback.port), "127.0.0.1", () => {
        socket.write(`${requestLine}\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
      });
      let response = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => {
        response += chunk;
      });
      socket.on("error", reject);
      socket.on("close", () => resolve(response.split("\r\n")[0] ?? ""));
    });
  }

  test("answers stray callbacks with an error and keeps waiting for the real one", async () => {
    const store = memoryStore();
    const statuses: string[] = [];
    let finished: Promise<void> = Promise.resolve();
    const open = (url: string) => {
      const authorize = new URL(url);
      const callback = new URL(authorize.searchParams.get("redirect_uri") ?? "");
      const query = (state: string) => new URLSearchParams({ code: "code_1", state }).toString();
      finished = (async () => {
        statuses.push(await rawRequest(callback, "GET // HTTP/1.1"));
        statuses.push(await rawRequest(callback, "GET //evil.test/callback HTTP/1.1"));
        statuses.push(await rawRequest(callback, `POST /callback?${query("x")} HTTP/1.1`));
        statuses.push(await rawRequest(callback, `GET /callback?${query("forged")} HTTP/1.1`));
        statuses.push(await rawRequest(callback, "GET /callback HTTP/1.1"));
        const state = authorize.searchParams.get("state") ?? "";
        statuses.push(await rawRequest(callback, `GET /callback?${query(state)} HTTP/1.1`));
      })();
    };

    const code = await runCli(["login"], {
      env: {},
      fetch: fakeServer().fetch,
      credentialStore: store,
      openBrowser: open,
      stdout: createOutput().out,
      stderr: createOutput().out,
    });
    await finished;

    expect(statuses).toEqual([
      "HTTP/1.1 404 Not Found",
      "HTTP/1.1 404 Not Found",
      "HTTP/1.1 405 Method Not Allowed",
      "HTTP/1.1 400 Bad Request",
      "HTTP/1.1 400 Bad Request",
      "HTTP/1.1 200 OK",
    ]);
    expect(code).toBe(0);
    expect(store.logins.get(BASE_URL)?.accessToken).toBe("access_1");
  });

  test("a callback whose state does not match cannot end the login", async () => {
    const store = memoryStore();
    const play = browser(() => ({ code: "code_1", state: "forged" }));
    const stderr = createOutput();

    const code = await runCli(["login"], {
      env: {},
      fetch: fakeServer().fetch,
      credentialStore: store,
      openBrowser: play.open,
      loginTimeoutMs: 300,
      stdout: createOutput().out,
      stderr: stderr.out,
    });

    expect((await play.responses[0])?.status).toBe(400);
    expect(code).toBe(1);
    expect(stderr.text()).toContain("Timed out waiting for the browser sign-in.");
    expect(store.logins.size).toBe(0);
  });

  test("reports an error the authorization server sent back", async () => {
    const play = browser((authorize) => ({
      error: "access_denied",
      error_description: "User denied access",
      state: authorize.searchParams.get("state") ?? "",
    }));
    const stderr = createOutput();

    const code = await runCli(["login"], {
      env: {},
      fetch: fakeServer().fetch,
      credentialStore: memoryStore(),
      openBrowser: play.open,
      stdout: createOutput().out,
      stderr: stderr.out,
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Sign-in failed: User denied access");
  });

  test("times out when the browser never comes back", async () => {
    const stderr = createOutput();
    const code = await runCli(["login"], {
      env: {},
      fetch: fakeServer().fetch,
      credentialStore: memoryStore(),
      openBrowser: () => undefined,
      loginTimeoutMs: 50,
      stdout: createOutput().out,
      stderr: stderr.out,
    });

    expect(code).toBe(1);
    expect(stderr.text()).toContain("Timed out waiting for the browser sign-in.");
  });

  test("prints login help", async () => {
    const stdout = createOutput();
    expect(await runCli(["login", "--help"], { env: {}, stdout: stdout.out })).toBe(0);
    expect(stdout.text()).toContain("--no-browser");
    expect(stdout.text()).toContain("shipmail logout revokes the login");
  });
});

describe("credential resolution", () => {
  async function domainsList(
    argv: readonly string[],
    env: Record<string, string>,
    store: CredentialStore,
    server = fakeServer(),
  ) {
    const stderr = createOutput();
    const code = await runCli(["domains", "list", ...argv], {
      env,
      fetch: server.fetch,
      credentialStore: store,
      stdout: createOutput().out,
      stderr: stderr.out,
    });
    const [request] = server.find("/api/v1/domains");
    return { code, stderr: stderr.text(), headers: new Headers(request?.init?.headers), server };
  }

  test("prefers --api-key, then SHIPMAIL_API_KEY, then the stored login", async () => {
    const store = memoryStore([storedLogin({ organizationId: "org_saved" })]);

    const flag = await domainsList(["--api-key", "sm_flag"], { SHIPMAIL_API_KEY: "sm_env" }, store);
    expect(flag.headers.get("authorization")).toBe("Bearer sm_flag");
    expect(flag.headers.has("x-shipmail-organization")).toBe(false);

    const env = await domainsList([], { SHIPMAIL_API_KEY: "sm_env" }, store);
    expect(env.headers.get("authorization")).toBe("Bearer sm_env");
    expect(env.headers.has("x-shipmail-organization")).toBe(false);

    const stored = await domainsList([], {}, store);
    expect(stored.headers.get("authorization")).toBe("Bearer access_1");
    expect(stored.headers.get("x-shipmail-organization")).toBe("org_saved");
  });

  test("prefers --organization, then SHIPMAIL_ORGANIZATION, then the stored default", async () => {
    const store = memoryStore([storedLogin({ organizationId: "org_saved" })]);
    const flag = await domainsList(
      ["--organization", "org_flag"],
      { SHIPMAIL_ORGANIZATION: "org_env" },
      store,
    );
    expect(flag.headers.get("x-shipmail-organization")).toBe("org_flag");
    const env = await domainsList([], { SHIPMAIL_ORGANIZATION: "org_env" }, store);
    expect(env.headers.get("x-shipmail-organization")).toBe("org_env");
  });

  test("sends the organization on generic api requests", async () => {
    const server = fakeServer();
    const code = await runCli(["api", "GET", "/domains", "--organization", "org_2"], {
      env: {},
      fetch: server.fetch,
      credentialStore: memoryStore([storedLogin()]),
      stdout: createOutput().out,
    });
    expect(code).toBe(0);
    const headers = new Headers(server.find("/api/v1/domains")[0]?.init?.headers);
    expect(headers.get("authorization")).toBe("Bearer access_1");
    expect(headers.get("x-shipmail-organization")).toBe("org_2");
  });

  test("asks to sign in when there is no credential", async () => {
    const result = await domainsList([], {}, memoryStore());
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Not signed in. Run shipmail login");
  });

  test("refreshes a token that expires within a minute and saves the new tokens", async () => {
    const store = memoryStore([storedLogin({ expiresAt: Date.now() + 30_000 })]);
    const result = await domainsList([], {}, store);

    expect(result.code).toBe(0);
    const [refresh] = result.server.find("/api/auth/oauth2/token");
    const body = formBody(refresh?.init);
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "refresh_token",
      refresh_token: "refresh_1",
      client_id: "client_1",
      resource: BASE_URL,
    });
    expect(result.headers.get("authorization")).toBe("Bearer access_2");
    expect(store.logins.get(BASE_URL)).toMatchObject({
      accessToken: "access_2",
      refreshToken: "refresh_2",
    });
  });

  test("deletes the stored login when the refresh token is rejected", async () => {
    const store = memoryStore([storedLogin({ expiresAt: Date.now() - 1000 })]);
    const server = fakeServer({
      token: () =>
        Response.json(
          { error: "invalid_grant", error_description: "This connection must be reauthorized." },
          { status: 400 },
        ),
    });
    const result = await domainsList([], {}, store, server);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Run shipmail login.");
    expect(store.logins.size).toBe(0);
    expect(server.find("/api/v1/domains")).toHaveLength(0);
  });

  test("keeps a login another process refreshed first", async () => {
    const store = memoryStore([storedLogin({ expiresAt: Date.now() - 1000 })]);
    const server = fakeServer({
      token: () => {
        store.logins.set(BASE_URL, storedLogin({ accessToken: "access_3", refreshToken: "r3" }));
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      },
    });
    const result = await domainsList([], {}, store, server);

    expect(result.code).toBe(0);
    expect(result.headers.get("authorization")).toBe("Bearer access_3");
    expect(store.logins.get(BASE_URL)?.refreshToken).toBe("r3");
  });
});

describe("refresh and logout across processes", () => {
  const directories: string[] = [];
  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
  });

  // Each call stands for a separate shipmail process sharing one credentials file and its lock.
  async function sharedFileStores() {
    const configHome = mkdtempSync(join(tmpdir(), "shipmail-cli-lock-"));
    directories.push(configHome);
    const open = () =>
      defaultCredentialStore({
        env: { XDG_CONFIG_HOME: configHome, PATH: "" },
        platform: "linux",
        run: () => Promise.reject(new Error("not called")),
        notice: () => undefined,
      });
    return { open, configHome };
  }

  // A token endpoint that rotates refresh tokens and rejects a spent one, like Better Auth.
  function rotatingServer(valid: Map<string, number>, onRefresh?: () => void) {
    return fakeServer({
      token: (body) => {
        onRefresh?.();
        const generation = valid.get(body.get("refresh_token") ?? "");
        if (generation === undefined) {
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        }
        valid.clear();
        valid.set(`refresh_${generation + 1}`, generation + 1);
        return Response.json({
          access_token: `access_${generation + 1}`,
          refresh_token: `refresh_${generation + 1}`,
          token_type: "Bearer",
          expires_in: 3600,
        });
      },
    });
  }

  function runDomains(store: CredentialStore, server: ReturnType<typeof fakeServer>) {
    const stderr = createOutput();
    return runCli(["domains", "list"], {
      env: {},
      fetch: server.fetch,
      credentialStore: store,
      stdout: createOutput().out,
      stderr: stderr.out,
    }).then((code) => ({ code, stderr: stderr.text() }));
  }

  function authorizations(server: ReturnType<typeof fakeServer>): (string | null)[] {
    return server
      .find("/api/v1/domains")
      .map((request) => new Headers(request.init?.headers).get("authorization"));
  }

  test("two processes refreshing at once spend the refresh token once", async () => {
    const stores = await sharedFileStores();
    await (await stores.open()).write(storedLogin({ expiresAt: Date.now() - 1000 }));
    const server = rotatingServer(new Map([["refresh_1", 1]]));

    const results = await Promise.all([
      runDomains(await stores.open(), server),
      runDomains(await stores.open(), server),
    ]);

    expect(results.map((result) => result.code)).toEqual([0, 0]);
    expect(server.find("/api/auth/oauth2/token")).toHaveLength(1);
    expect(authorizations(server)).toEqual(["Bearer access_2", "Bearer access_2"]);
    expect((await (await stores.open()).read(BASE_URL))?.refreshToken).toBe("refresh_2");
    expect(existsSync(join(stores.configHome, "shipmail", "credentials.lock"))).toBe(false);
  });

  test("a login saved while a rejected refresh runs is kept", async () => {
    const stores = await sharedFileStores();
    await (await stores.open()).write(storedLogin({ expiresAt: Date.now() - 1000 }));
    const other = await stores.open();
    let saving: Promise<void> | undefined;
    const server = rotatingServer(new Map(), () => {
      saving = other.withLock(() => other.write(storedLogin({ accessToken: "access_new" })));
    });

    const result = await runDomains(await stores.open(), server);
    await saving;

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Run shipmail login.");
    expect((await other.read(BASE_URL))?.accessToken).toBe("access_new");
  });

  test("refreshes the login another process saved, never the stale one it first read", async () => {
    const store = memoryStore([storedLogin({ expiresAt: Date.now() - 1000 })]);
    const firstRead = store.read;
    let reads = 0;
    store.read = (baseUrl) => {
      reads += 1;
      // After the first read, another process saves a newer login that is also about to expire.
      if (reads === 2) {
        store.logins.set(
          BASE_URL,
          storedLogin({
            accessToken: "access_2",
            refreshToken: "refresh_2",
            expiresAt: Date.now() - 1,
          }),
        );
      }
      return firstRead(baseUrl);
    };
    const server = rotatingServer(new Map([["refresh_2", 2]]));

    const result = await runDomains(store, server);

    expect(result.code).toBe(0);
    expect(formBody(server.find("/api/auth/oauth2/token")[0]?.init).get("refresh_token")).toBe(
      "refresh_2",
    );
    expect(authorizations(server)).toEqual(["Bearer access_3"]);
  });

  test("a refresh never saves over a login another process saved meanwhile", async () => {
    const store = memoryStore([storedLogin({ expiresAt: Date.now() - 1000 })]);
    const accountB = storedLogin({
      accessToken: "access_B",
      refreshToken: "refresh_B",
      organizationId: "org_B",
      expiresAt: Date.now() + 3_600_000,
    });
    // While the refresh is in flight, the person signs in again as another account.
    const server = rotatingServer(new Map([["refresh_1", 1]]), () => {
      store.logins.set(BASE_URL, accountB);
    });

    const result = await runDomains(store, server);

    expect(result.code).toBe(0);
    expect(authorizations(server)).toEqual(["Bearer access_2"]);
    expect(store.logins.get(BASE_URL)).toEqual(accountB);
  });

  test("logout waits for a refresh and revokes the rotated refresh token", async () => {
    const stores = await sharedFileStores();
    await (await stores.open()).write(storedLogin({ expiresAt: Date.now() - 1000 }));
    const logoutStore = await stores.open();
    let logout: Promise<number> | undefined;
    const server = rotatingServer(new Map([["refresh_1", 1]]), () => {
      logout = runCli(["logout"], {
        env: {},
        fetch: server.fetch,
        credentialStore: logoutStore,
        stdout: createOutput().out,
      });
    });

    expect((await runDomains(await stores.open(), server)).code).toBe(0);
    expect(await logout).toBe(0);

    const [revoke] = server.find("/api/auth/oauth2/revoke");
    expect(formBody(revoke?.init).get("token")).toBe("refresh_2");
    expect(await logoutStore.read(BASE_URL)).toBeNull();
  });

  test("the lock waits for its holder and breaks a stale lock", async () => {
    const directory = mkdtempSync(join(tmpdir(), "shipmail-cli-lock-"));
    directories.push(directory);
    const lockPath = join(directory, "nested", "credentials.lock");
    const order: string[] = [];

    let release: () => void = () => undefined;
    const holding = withFileLock(lockPath, async () => {
      order.push("first");
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      order.push("first done");
    });
    while (order.length === 0) await Bun.sleep(5);
    const waiting = withFileLock(lockPath, async () => {
      order.push("second");
    });
    await Bun.sleep(120);
    expect(order).toEqual(["first"]);
    release();
    await Promise.all([holding, waiting]);
    expect(order).toEqual(["first", "first done", "second"]);
    expect(statSync(join(directory, "nested")).mode & 0o777).toBe(0o700);

    // A lock whose holder still runs is kept, however old, until the waiter gives up.
    writeFileSync(lockPath, `${process.pid} ${"a".repeat(32)}`);
    const aged = new Date(Date.now() - 3_600_000);
    utimesSync(lockPath, aged, aged);
    await expect(withFileLock(lockPath, () => Promise.resolve("ran"), 200)).rejects.toThrow(
      "Another shipmail command is using the saved login.",
    );
    expect(existsSync(lockPath)).toBe(true);

    // A lock whose holder exited is broken, and so is one without a holder.
    writeFileSync(lockPath, `${2 ** 22 + 12345} ${"b".repeat(32)}`);
    expect(await withFileLock(lockPath, () => Promise.resolve("ran"))).toBe("ran");
    expect(existsSync(lockPath)).toBe(false);
    writeFileSync(lockPath, "");
    expect(await withFileLock(lockPath, () => Promise.resolve("ran"))).toBe("ran");
    expect(existsSync(lockPath)).toBe(false);
  });

  test("breaking a lock removes only the content the waiter judged abandoned", async () => {
    const directory = mkdtempSync(join(tmpdir(), "shipmail-cli-lock-"));
    directories.push(directory);
    const lockPath = join(directory, "credentials.lock");
    const dead = `${2 ** 22 + 12345} ${"d".repeat(32)}`;
    const live = `${process.pid} ${"c".repeat(32)}`;
    const me = `${process.pid} ${"e".repeat(32)}`;

    // Another waiter broke the dead lock and a new holder took it before this waiter acted.
    writeFileSync(lockPath, live);
    await breakLock(lockPath, dead, me);
    expect(readFileSync(lockPath, "utf8")).toBe(live);

    // Only one waiter breaks at a time: a running breaker keeps its turn, however long it pauses.
    writeFileSync(lockPath, dead);
    writeFileSync(`${lockPath}.break`, live);
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(`${lockPath}.break`, old, old);
    await breakLock(lockPath, dead, me);
    expect(readFileSync(lockPath, "utf8")).toBe(dead);
    expect(existsSync(`${lockPath}.break`)).toBe(true);

    // A breaker whose process exited is cleared, and the next break succeeds.
    writeFileSync(`${lockPath}.break`, dead);
    await breakLock(lockPath, dead, me);
    await breakLock(lockPath, dead, me);
    expect(existsSync(lockPath)).toBe(false);
    expect(existsSync(`${lockPath}.break`)).toBe(false);
  });

  test("a waiter gives up at its deadline even when the lock cannot be read", async () => {
    const directory = mkdtempSync(join(tmpdir(), "shipmail-cli-lock-"));
    directories.push(directory);
    const lockPath = join(directory, "credentials.lock");
    // A directory at the lock path exists for link() but cannot be read as a file.
    mkdirSync(lockPath);
    await expect(withFileLock(lockPath, () => Promise.resolve("ran"), 150)).rejects.toThrow(
      "Another shipmail command is using the saved login.",
    );
  });
});

describe("shipmail logout", () => {
  test("revokes the refresh token and deletes the login", async () => {
    const server = fakeServer();
    const store = memoryStore([storedLogin()]);
    const stdout = createOutput();

    const code = await runCli(["logout"], {
      env: {},
      fetch: server.fetch,
      credentialStore: store,
      stdout: stdout.out,
    });

    expect(code).toBe(0);
    expect(stdout.text()).toBe("Signed out of https://shipmail.to.\n");
    const [revoke] = server.find("/api/auth/oauth2/revoke");
    expect(Object.fromEntries(formBody(revoke?.init))).toEqual({
      token: "refresh_1",
      token_type_hint: "refresh_token",
      client_id: "client_1",
    });
    expect(store.logins.size).toBe(0);
  });

  test("reports a failed revocation and still deletes the login", async () => {
    const store = memoryStore([storedLogin()]);
    const stderr = createOutput();
    const failing = ((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.reject(new Error("network down"))) as typeof fetch;

    const code = await runCli(["logout"], {
      env: {},
      fetch: failing,
      credentialStore: store,
      stdout: createOutput().out,
      stderr: stderr.out,
    });

    expect(code).toBe(0);
    expect(stderr.text()).toContain("Could not revoke the login at the server: network down");
    expect(store.logins.size).toBe(0);
  });

  test("skips revocation when the server advertised no endpoint", async () => {
    const server = fakeServer();
    const store = memoryStore([storedLogin({ revocationEndpoint: undefined })]);
    expect(
      await runCli(["logout"], {
        env: {},
        fetch: server.fetch,
        credentialStore: store,
        stdout: createOutput().out,
      }),
    ).toBe(0);
    expect(server.requests).toHaveLength(0);
    expect(store.logins.size).toBe(0);
  });
});

describe("credential storage", () => {
  const directories: string[] = [];
  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
  });
  function tempConfigHome(): string {
    const directory = mkdtempSync(join(tmpdir(), "shipmail-cli-credentials-"));
    directories.push(directory);
    return directory;
  }

  test("defaults to ~/.config/shipmail/credentials.json", () => {
    expect(credentialsFilePath({ HOME: "/home/ada" })).toBe(
      "/home/ada/.config/shipmail/credentials.json",
    );
    expect(credentialsFilePath({ XDG_CONFIG_HOME: "/xdg", HOME: "/home/ada" })).toBe(
      "/xdg/shipmail/credentials.json",
    );
  });

  test("writes the file store with mode 0600 in a 0700 directory", async () => {
    const path = credentialsFilePath({ XDG_CONFIG_HOME: tempConfigHome() });
    const store = fileStore(path);
    await store.write(storedLogin());
    await store.write(storedLogin({ baseUrl: "http://localhost:3000/api/v1" }));

    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(join(path, "..")).mode & 0o777).toBe(0o700);
    expect(await store.read(BASE_URL)).toEqual(storedLogin({ expiresAt: expect.any(Number) }));

    await store.delete(BASE_URL);
    expect(await store.read(BASE_URL)).toBeNull();
    expect(await store.read("http://localhost:3000/api/v1")).not.toBeNull();
  });

  test("uses the file store with a notice when there is no system keychain", async () => {
    const notices: string[] = [];
    const store = await defaultCredentialStore({
      env: { XDG_CONFIG_HOME: tempConfigHome(), PATH: "" },
      platform: "linux",
      run: () => Promise.reject(new Error("not called")),
      notice: (message) => notices.push(message),
    });
    expect(store.kind).toBe("file");
    await store.write(storedLogin());
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain("credentials.json");
    expect(notices[0]).not.toContain("access_1");
  });

  // How security -i splits a line: double quotes group words, a backslash escapes the next character.
  function securityWords(line: string): string[] {
    const words: string[] = [];
    let word: string | null = null;
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line.charAt(index);
      if (character === "\\") {
        word = (word ?? "") + line.charAt((index += 1));
      } else if (character === '"') {
        quoted = !quoted;
        word ??= "";
      } else if (/\s/.test(character) && !quoted) {
        if (word !== null) words.push(word);
        word = null;
      } else {
        word = (word ?? "") + character;
      }
    }
    if (word !== null) words.push(word);
    return words;
  }

  const awkwardLogin = storedLogin({
    accessToken: 'access "quoted" with spaces \\ and a backslash',
    refreshToken: 'refresh \\" tail',
  });

  test("stores a macOS login in the Keychain through stdin, never in argv", async () => {
    const calls: { command: string; args: readonly string[]; input: string | undefined }[] = [];
    let saved = "";
    const run: CommandRunner = (command, args, input) => {
      calls.push({ command, args, input });
      if (args[0] === "-i") saved = securityWords(input ?? "").at(-1) ?? "";
      if (args[0] === "find-generic-password") return Promise.resolve({ code: 0, stdout: saved });
      return Promise.resolve({ code: 0, stdout: "" });
    };
    const store = keychainStore(run);
    await store.write(awkwardLogin);
    expect(await store.read(BASE_URL)).toEqual(awkwardLogin);
    await store.delete(BASE_URL);

    expect(calls.map((call) => [call.command, ...call.args])).toEqual([
      ["security", "-i"],
      ["security", "find-generic-password", "-s", "shipmail-cli", "-a", BASE_URL, "-w"],
      ["security", "delete-generic-password", "-s", "shipmail-cli", "-a", BASE_URL],
    ]);
    expect(securityWords(calls[0]?.input ?? "")).toEqual([
      "add-generic-password",
      "-U",
      "-s",
      "shipmail-cli",
      "-a",
      BASE_URL,
      "-l",
      "Shipmail CLI",
      "-w",
      JSON.stringify(awkwardLogin),
    ]);
    expect(calls[0]?.input?.split("\n")).toEqual([expect.any(String), ""]);
  });

  test("keeps tokens out of every spawned argv", async () => {
    const argv: string[] = [];
    const run: CommandRunner = (command, args) => {
      argv.push(command, ...args);
      return Promise.resolve({ code: 0, stdout: "" });
    };
    for (const store of [keychainStore(run), secretToolStore(run)]) {
      await store.write(awkwardLogin);
      await store.read(BASE_URL);
      await store.delete(BASE_URL);
    }
    const joined = argv.join("\n");
    expect(joined).not.toContain("access");
    expect(joined).not.toContain("refresh");
  });

  test("refuses a Keychain line that security -i would split", async () => {
    const run: CommandRunner = () => Promise.resolve({ code: 0, stdout: "" });
    await expect(
      keychainStore(run).write(storedLogin({ accessToken: "a".repeat(4000) })),
    ).rejects.toThrow("too large");
  });

  test("a fallback login wins over an older Keychain login", async () => {
    const configHome = tempConfigHome();
    const keychain = new Map<string, string>();
    let keychainWorks = true;
    const run: CommandRunner = (_command, args, input) => {
      if (args[0] === "-i") {
        if (!keychainWorks) return Promise.resolve({ code: 1, stdout: "" });
        keychain.set(BASE_URL, securityWords(input ?? "").at(-1) ?? "");
        return Promise.resolve({ code: 0, stdout: "" });
      }
      if (args[0] === "find-generic-password") {
        const saved = keychain.get(BASE_URL);
        return Promise.resolve(saved ? { code: 0, stdout: saved } : { code: 44, stdout: "" });
      }
      // A Keychain that refuses to save may refuse to delete as well.
      return Promise.resolve({ code: 1, stdout: "" });
    };
    const store = await defaultCredentialStore({
      env: { XDG_CONFIG_HOME: configHome },
      platform: "darwin",
      run,
      notice: () => undefined,
    });

    await store.write(storedLogin({ accessToken: "access_A" }));
    expect((await store.read(BASE_URL))?.accessToken).toBe("access_A");

    keychainWorks = false;
    await store.write(storedLogin({ accessToken: "access_B", organizationId: "org_B" }));
    expect(keychain.get(BASE_URL)).toContain("access_A");
    expect(await store.read(BASE_URL)).toMatchObject({
      accessToken: "access_B",
      organizationId: "org_B",
    });

    keychainWorks = true;
    await store.write(storedLogin({ accessToken: "access_A" }));
    expect(
      await fileStore(credentialsFilePath({ XDG_CONFIG_HOME: configHome })).read(BASE_URL),
    ).toBeNull();
    expect((await store.read(BASE_URL))?.accessToken).toBe("access_A");
  });

  test("a failed logout keeps the newer fallback login in charge", async () => {
    const configHome = tempConfigHome();
    const keychain = new Map<string, string>();
    let keychainWorks = true;
    const run: CommandRunner = (_command, args, input) => {
      if (args[0] === "-i") {
        if (!keychainWorks) return Promise.resolve({ code: 1, stdout: "" });
        keychain.set(BASE_URL, securityWords(input ?? "").at(-1) ?? "");
        return Promise.resolve({ code: 0, stdout: "" });
      }
      if (args[0] === "find-generic-password") {
        const saved = keychain.get(BASE_URL);
        return Promise.resolve(saved ? { code: 0, stdout: saved } : { code: 44, stdout: "" });
      }
      return Promise.resolve({ code: 1, stdout: "" });
    };
    const store = await defaultCredentialStore({
      env: { XDG_CONFIG_HOME: configHome },
      platform: "darwin",
      run,
      notice: () => undefined,
    });

    await store.write(storedLogin({ accessToken: "access_A" }));
    keychainWorks = false;
    await store.write(storedLogin({ accessToken: "access_B" }));

    await expect(store.delete(BASE_URL)).rejects.toThrow();
    expect((await store.read(BASE_URL))?.accessToken).toBe("access_B");
  });

  test("falls back to the file when the Keychain cannot save", async () => {
    const configHome = tempConfigHome();
    const notices: string[] = [];
    const store = await defaultCredentialStore({
      env: { XDG_CONFIG_HOME: configHome },
      platform: "darwin",
      run: () => Promise.resolve({ code: 1, stdout: "" }),
      notice: (message) => notices.push(message),
    });
    await store.write(storedLogin());
    expect(notices).toHaveLength(1);
    expect(await store.read(BASE_URL)).not.toBeNull();
    await expect(store.delete(BASE_URL)).rejects.toThrow(
      "Could not delete the login from the macOS Keychain.",
    );
    // The keychain state is unknown, so the fallback login is kept rather than risk an older one.
    expect(await store.read(BASE_URL)).not.toBeNull();
  });

  test("treats only a missing item as a successful delete", async () => {
    const exitWith =
      (code: number): CommandRunner =>
      () =>
        Promise.resolve({ code, stdout: "" });
    await expect(keychainStore(exitWith(0)).delete(BASE_URL)).resolves.toBeUndefined();
    await expect(keychainStore(exitWith(44)).delete(BASE_URL)).resolves.toBeUndefined();
    await expect(keychainStore(exitWith(51)).delete(BASE_URL)).rejects.toThrow(
      "Could not delete the login from the macOS Keychain.",
    );
    // secret-tool clear exits 0 when nothing matched.
    await expect(secretToolStore(exitWith(0)).delete(BASE_URL)).resolves.toBeUndefined();
    await expect(secretToolStore(exitWith(1)).delete(BASE_URL)).rejects.toThrow(
      "Could not delete the login with secret-tool.",
    );
  });

  test("logout fails and says the login is kept when the keychain cannot delete it", async () => {
    const binDirectory = tempConfigHome();
    writeFileSync(join(binDirectory, "secret-tool"), "", { mode: 0o755 });
    const saved = JSON.stringify(storedLogin({ revocationEndpoint: undefined }));
    const run: CommandRunner = (_command, args) => {
      if (args[0] === "find-generic-password" || args[0] === "lookup") {
        return Promise.resolve({ code: 0, stdout: saved });
      }
      return Promise.resolve({ code: 1, stdout: "" });
    };

    for (const platform of ["darwin", "linux"] as const) {
      const store = await defaultCredentialStore({
        env: { XDG_CONFIG_HOME: tempConfigHome(), PATH: binDirectory },
        platform,
        run,
        notice: () => undefined,
      });
      expect(store.kind).toBe(platform === "darwin" ? "keychain" : "secret-tool");
      const stdout = createOutput();
      const stderr = createOutput();

      const code = await runCli(["logout"], {
        env: {},
        credentialStore: store,
        stdout: stdout.out,
        stderr: stderr.out,
      });

      expect(code).toBe(1);
      expect(stdout.text()).toBe("");
      expect(stderr.text()).toContain("The login is still saved on this computer.");
      expect(await store.read(BASE_URL)).not.toBeNull();
    }
  });
});
