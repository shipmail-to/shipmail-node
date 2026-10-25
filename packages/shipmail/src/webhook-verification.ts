import { WebhookVerificationError } from "./errors.js";
import type { WebhookEvent } from "./types/webhook.js";

const DEFAULT_TOLERANCE_SECONDS = 300; // 5 minutes

type WebhookHeaders = {
  readonly "x-shipmail-signature"?: string;
  readonly "x-shipmail-timestamp"?: string;
  readonly "x-shipmail-event-id"?: string;
  readonly [key: string]: string | undefined;
};

function getHeader(headers: WebhookHeaders | Headers, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  return headers[name] ?? headers[name.toLowerCase()];
}

async function signPayload(secret: string, timestamp: number, body: string): Promise<string> {
  const { createHmac } = await import("crypto");
  const payload = `v1=${timestamp}\n${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify an incoming webhook signature. Throws `WebhookVerificationError` on failure.
 * Returns the parsed webhook event on success.
 */
export async function verifyWebhook(
  body: string,
  headers: WebhookHeaders | Headers,
  secret: string,
  options?: { readonly toleranceInSeconds?: number | undefined },
): Promise<WebhookEvent> {
  const signature = getHeader(headers, "x-shipmail-signature");
  const timestampStr = getHeader(headers, "x-shipmail-timestamp");

  if (!signature) {
    throw new WebhookVerificationError("Missing X-Shipmail-Signature header");
  }
  if (!timestampStr) {
    throw new WebhookVerificationError("Missing X-Shipmail-Timestamp header");
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    throw new WebhookVerificationError("Invalid X-Shipmail-Timestamp header");
  }

  const tolerance = options?.toleranceInSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    throw new WebhookVerificationError("Webhook timestamp is outside tolerance window");
  }

  const expected = await signPayload(secret, timestamp, body);

  const { timingSafeEqual } = await import("crypto");
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new WebhookVerificationError("Webhook signature verification failed");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new WebhookVerificationError("Invalid webhook payload: not valid JSON");
  }

  return parsed as WebhookEvent;
}
