import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, link, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

import { z } from "zod";

const KEYCHAIN_SERVICE = "shipmail-cli";

export const storedLoginSchema = z.object({
  baseUrl: z.string(),
  clientId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number(),
  tokenEndpoint: z.string(),
  revocationEndpoint: z.string().optional(),
  organizationId: z.string().optional(),
});

export type StoredLogin = z.infer<typeof storedLoginSchema>;

export type CredentialBackend = {
  readonly kind: "keychain" | "secret-tool" | "file";
  read(baseUrl: string): Promise<StoredLogin | null>;
  write(login: StoredLogin): Promise<void>;
  delete(baseUrl: string): Promise<void>;
};

export type CredentialStore = CredentialBackend & {
  // Runs fn while no other shipmail process changes the saved logins.
  withLock<T>(fn: () => Promise<T>): Promise<T>;
};

export type CommandResult = {
  readonly code: number;
  readonly stdout: string;
};

export type CommandRunner = (
  command: string,
  args: readonly string[],
  input?: string,
) => Promise<CommandResult>;

const fileContentsSchema = z.object({ logins: z.record(z.string(), storedLoginSchema) });

function parseLogin(raw: string): StoredLogin | null {
  try {
    const parsed = storedLoginSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const runCommand: CommandRunner = (command, args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: ["pipe", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout }));
    child.stdin.end(input ?? "");
  });

// security -i reads one command per line into a 4096-byte buffer and splits a longer line.
const SECURITY_MAX_LINE = 4000;
// errSecItemNotFound, the exit status of security when there is nothing to delete.
const KEYCHAIN_ITEM_NOT_FOUND = 44;

export function securityQuote(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error("A Keychain value cannot contain a line break.");
  return `"${value.replace(/["\\]/g, (character) => `\\${character}`)}"`;
}

export function keychainStore(run: CommandRunner): CredentialBackend {
  return {
    kind: "keychain",
    async read(baseUrl) {
      const result = await run("security", [
        "find-generic-password",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        baseUrl,
        "-w",
      ]);
      return result.code === 0 ? parseLogin(result.stdout.trim()) : null;
    },
    // The secret goes to security -i on stdin, never into argv, where ps could read it.
    async write(login) {
      const command = [
        "add-generic-password",
        "-U",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        login.baseUrl,
        "-l",
        "Shipmail CLI",
        "-w",
        JSON.stringify(login),
      ]
        .map(securityQuote)
        .join(" ");
      if (command.length > SECURITY_MAX_LINE) {
        throw new Error("The login is too large for the macOS Keychain.");
      }
      const result = await run("security", ["-i"], `${command}\n`);
      if (result.code !== 0) throw new Error("Could not save the login to the macOS Keychain.");
    },
    async delete(baseUrl) {
      const result = await run("security", [
        "delete-generic-password",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        baseUrl,
      ]);
      if (result.code !== 0 && result.code !== KEYCHAIN_ITEM_NOT_FOUND) {
        throw new Error("Could not delete the login from the macOS Keychain.");
      }
    },
  };
}

export function secretToolStore(run: CommandRunner): CredentialBackend {
  const attributes = (baseUrl: string) => ["service", KEYCHAIN_SERVICE, "account", baseUrl];
  return {
    kind: "secret-tool",
    async read(baseUrl) {
      const result = await run("secret-tool", ["lookup", ...attributes(baseUrl)]);
      return result.code === 0 ? parseLogin(result.stdout.trim()) : null;
    },
    async write(login) {
      const result = await run(
        "secret-tool",
        ["store", "--label=Shipmail CLI", ...attributes(login.baseUrl)],
        JSON.stringify(login),
      );
      if (result.code !== 0) throw new Error("Could not save the login with secret-tool.");
    },
    // secret-tool clear exits 0 when nothing matched as well, so any other exit is a failure.
    async delete(baseUrl) {
      const result = await run("secret-tool", ["clear", ...attributes(baseUrl)]);
      if (result.code !== 0) throw new Error("Could not delete the login with secret-tool.");
    },
  };
}

export function credentialsFilePath(env: Record<string, string | undefined>): string {
  const configHome = env["XDG_CONFIG_HOME"] || join(env["HOME"] || homedir(), ".config");
  return join(configHome, "shipmail", "credentials.json");
}

export function fileStore(path: string): CredentialBackend {
  const directory = dirname(path);

  async function readAll(): Promise<Record<string, StoredLogin>> {
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      return {};
    }
    try {
      const parsed = fileContentsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data.logins : {};
    } catch {
      return {};
    }
  }

  async function writeAll(logins: Record<string, StoredLogin>): Promise<void> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ logins }, null, 2)}\n`, { mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, path);
  }

  return {
    kind: "file",
    async read(baseUrl) {
      return (await readAll())[baseUrl] ?? null;
    },
    async write(login) {
      await writeAll({ ...(await readAll()), [login.baseUrl]: login });
    },
    async delete(baseUrl) {
      const logins = await readAll();
      if (!(baseUrl in logins)) return;
      const rest = { ...logins };
      delete rest[baseUrl];
      await writeAll(rest);
    },
  };
}

// A waiter gives up after this long behind a holder that is still running.
const LOCK_WAIT_MS = 60_000;
const LOCK_RETRY_MS = 50;

function errorCode(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === "EPERM";
  }
}

async function readLock(path: string): Promise<string | null> {
  return readFile(path, "utf8").catch(() => null);
}

function lockHolder(content: string): number | null {
  const match = /^(\d+) [0-9a-f]+$/.exec(content);
  return match?.[1] ? Number(match[1]) : null;
}

// Creates a lock file with its content in one step: the content goes to a private file, which is
// then hard-linked to the lock path. link() fails when the file exists, so a lock is never empty.
async function tryCreateLock(path: string, owner: string): Promise<boolean> {
  const staged = `${path}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(staged, owner, { mode: 0o600, flag: "wx" });
  try {
    await link(staged, path);
    return true;
  } catch (error) {
    if (errorCode(error) === "EEXIST") return false;
    throw error;
  } finally {
    await unlink(staged).catch(() => undefined);
  }
}

// True when the file names a holder that has exited, or names none at all.
function abandoned(content: string): boolean {
  const holder = lockHolder(content);
  return holder === null || !processAlive(holder);
}

// Only one waiter breaks a lock at a time, and only if the lock still holds the content it judged
// abandoned. The breaker file names its process too, so it is cleared only once that process has
// exited: a paused breaker keeps its turn, and a running holder never loses its lock.
export async function breakLock(path: string, observed: string, owner: string): Promise<void> {
  const breaker = `${path}.break`;
  if (!(await tryCreateLock(breaker, owner))) {
    const content = await readLock(breaker);
    if (content !== null && abandoned(content) && (await readLock(breaker)) === content) {
      await unlink(breaker).catch(() => undefined);
    }
    return;
  }
  try {
    if ((await readLock(path)) === observed) await unlink(path).catch(() => undefined);
  } finally {
    if ((await readLock(breaker)) === owner) await unlink(breaker).catch(() => undefined);
  }
}

// A lock file that holds "<pid> <random token>". A waiter waits while the holder runs, breaks the
// lock once the holder has exited, and gives up after waitMs whatever the reason. Release removes
// only our own lock; nobody else can replace it while we run, because a running holder's lock is
// never broken.
export async function withFileLock<T>(
  path: string,
  fn: () => Promise<T>,
  waitMs: number = LOCK_WAIT_MS,
): Promise<T> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const owner = `${process.pid} ${randomBytes(16).toString("hex")}`;
  const deadline = Date.now() + waitMs;
  while (!(await tryCreateLock(path, owner))) {
    if (Date.now() > deadline) {
      throw new Error(
        `Another shipmail command is using the saved login. If none is running, delete ${path}.`,
      );
    }
    const observed = await readLock(path);
    if (observed !== null && abandoned(observed)) await breakLock(path, observed, owner);
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
  try {
    return await fn();
  } finally {
    if ((await readLock(path)) === owner) await unlink(path).catch(() => undefined);
  }
}

async function onPath(command: string, env: Record<string, string | undefined>): Promise<boolean> {
  for (const directory of (env["PATH"] ?? "").split(delimiter)) {
    if (!directory) continue;
    try {
      await access(join(directory, command), constants.X_OK);
      return true;
    } catch {
      // Not in this directory.
    }
  }
  return false;
}

// The system keychain when there is one, otherwise a private file. A keychain that fails to save
// (secret-tool without a running keyring, for example) falls back to the file as well. A file
// entry always wins over a keychain entry, so a fallback write cannot leave an older keychain
// login in charge; a later successful keychain write removes the file entry.
export async function defaultCredentialStore(options: {
  readonly env: Record<string, string | undefined>;
  readonly platform: NodeJS.Platform;
  readonly run: CommandRunner;
  readonly notice: (message: string) => void;
}): Promise<CredentialStore> {
  const path = credentialsFilePath(options.env);
  const file = fileStore(path);
  const lockPath = join(dirname(path), "credentials.lock");
  const withLock = <T>(fn: () => Promise<T>) => withFileLock(lockPath, fn);
  const fileNotice = () =>
    options.notice(`Saved the login in ${path}, readable only by you. No system keychain found.`);

  let native: CredentialBackend | null = null;
  if (options.platform === "darwin") native = keychainStore(options.run);
  else if (options.platform === "linux" && (await onPath("secret-tool", options.env))) {
    native = secretToolStore(options.run);
  }

  if (!native) {
    return {
      kind: "file",
      read: file.read,
      async write(login) {
        await file.write(login);
        fileNotice();
      },
      delete: file.delete,
      withLock,
    };
  }

  const store = native;
  return {
    kind: store.kind,
    async read(baseUrl) {
      return (await file.read(baseUrl)) ?? (await store.read(baseUrl).catch(() => null));
    },
    async write(login) {
      try {
        await store.write(login);
      } catch {
        await file.write(login);
        fileNotice();
        await store.delete(login.baseUrl).catch(() => undefined);
        return;
      }
      await file.delete(login.baseUrl);
    },
    async delete(baseUrl) {
      const nativeError = await store.delete(baseUrl).then(
        () => null,
        (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
      );
      // The keychain reports a failed read as no login, so a failed delete leaves its state unknown.
      // Keep the fallback login then: it is the newer one, and deleting it could hand an older
      // keychain login back to every command.
      if (nativeError) throw nativeError;
      await file.delete(baseUrl);
    },
    withLock,
  };
}
