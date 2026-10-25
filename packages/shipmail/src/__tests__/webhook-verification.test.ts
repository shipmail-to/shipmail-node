import { describe, expect, test } from "bun:test";
import { createHmac } from "crypto";

import { WebhookVerificationError } from "../errors.js";
import { verifyWebhook } from "../webhook-verification.js";

const TEST_SECRET = "whsec_test_secret_key_12345";

function generateSignature(secret: string, timestamp: number, body: string): string {
  const payload = `v1=${timestamp}\n${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function currentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

async function expectVerificationError(
  promise: Promise<unknown>,
  expectedMessage?: string,
): Promise<void> {
  try {
    await promise;
    throw new Error("Expected verifyWebhook to throw");
  } catch (err) {
    expect(err).toBeInstanceOf(WebhookVerificationError);
    if (expectedMessage) {
      expect((err as WebhookVerificationError).message).toBe(expectedMessage);
    }
  }
}

describe("verifyWebhook", () => {
  const validBody = JSON.stringify({
    event_id: "evt_123",
    event_type: "message.received",
    created_at: "2025-01-01T00:00:00Z",
    data: { id: "msg_456" },
  });

  test("valid signature passes verification", async () => {
    const timestamp = currentTimestamp();
    const signature = generateSignature(TEST_SECRET, timestamp, validBody);

    const event = await verifyWebhook(
      validBody,
      {
        "x-shipmail-signature": signature,
        "x-shipmail-timestamp": String(timestamp),
      },
      TEST_SECRET,
    );

    expect(event.event_id).toBe("evt_123");
    expect(event.event_type).toBe("message.received");
    expect(event.data).toEqual({ id: "msg_456" });
  });

  test("valid signature passes with Headers object", async () => {
    const timestamp = currentTimestamp();
    const signature = generateSignature(TEST_SECRET, timestamp, validBody);

    const headers = new Headers();
    headers.set("x-shipmail-signature", signature);
    headers.set("x-shipmail-timestamp", String(timestamp));

    const event = await verifyWebhook(validBody, headers, TEST_SECRET);
    expect(event.event_id).toBe("evt_123");
  });

  test("invalid signature throws WebhookVerificationError", async () => {
    const timestamp = currentTimestamp();
    const wrongSignature = generateSignature("wrong_secret", timestamp, validBody);

    await expectVerificationError(
      verifyWebhook(
        validBody,
        {
          "x-shipmail-signature": wrongSignature,
          "x-shipmail-timestamp": String(timestamp),
        },
        TEST_SECRET,
      ),
      "Webhook signature verification failed",
    );
  });

  test("tampered body fails verification", async () => {
    const timestamp = currentTimestamp();
    const signature = generateSignature(TEST_SECRET, timestamp, validBody);
    const tamperedBody = JSON.stringify({
      event_id: "evt_999",
      event_type: "message.received",
      created_at: "2025-01-01T00:00:00Z",
      data: {},
    });

    await expectVerificationError(
      verifyWebhook(
        tamperedBody,
        {
          "x-shipmail-signature": signature,
          "x-shipmail-timestamp": String(timestamp),
        },
        TEST_SECRET,
      ),
      "Webhook signature verification failed",
    );
  });

  test("expired timestamp throws WebhookVerificationError", async () => {
    const oldTimestamp = currentTimestamp() - 600; // 10 minutes ago
    const signature = generateSignature(TEST_SECRET, oldTimestamp, validBody);

    await expectVerificationError(
      verifyWebhook(
        validBody,
        {
          "x-shipmail-signature": signature,
          "x-shipmail-timestamp": String(oldTimestamp),
        },
        TEST_SECRET,
      ),
      "Webhook timestamp is outside tolerance window",
    );
  });

  test("future timestamp outside tolerance throws WebhookVerificationError", async () => {
    const futureTimestamp = currentTimestamp() + 600; // 10 minutes in the future
    const signature = generateSignature(TEST_SECRET, futureTimestamp, validBody);

    await expectVerificationError(
      verifyWebhook(
        validBody,
        {
          "x-shipmail-signature": signature,
          "x-shipmail-timestamp": String(futureTimestamp),
        },
        TEST_SECRET,
      ),
      "Webhook timestamp is outside tolerance window",
    );
  });

  test("custom tolerance allows older timestamps", async () => {
    const oldTimestamp = currentTimestamp() - 500;
    const signature = generateSignature(TEST_SECRET, oldTimestamp, validBody);

    const event = await verifyWebhook(
      validBody,
      {
        "x-shipmail-signature": signature,
        "x-shipmail-timestamp": String(oldTimestamp),
      },
      TEST_SECRET,
      { toleranceInSeconds: 600 },
    );

    expect(event.event_id).toBe("evt_123");
  });

  test("missing signature header throws WebhookVerificationError", async () => {
    const timestamp = currentTimestamp();

    await expectVerificationError(
      verifyWebhook(
        validBody,
        {
          "x-shipmail-timestamp": String(timestamp),
        },
        TEST_SECRET,
      ),
      "Missing X-Shipmail-Signature header",
    );
  });

  test("missing timestamp header throws WebhookVerificationError", async () => {
    const timestamp = currentTimestamp();
    const signature = generateSignature(TEST_SECRET, timestamp, validBody);

    await expectVerificationError(
      verifyWebhook(
        validBody,
        {
          "x-shipmail-signature": signature,
        },
        TEST_SECRET,
      ),
      "Missing X-Shipmail-Timestamp header",
    );
  });

  test("missing both headers throws for signature first", async () => {
    await expectVerificationError(
      verifyWebhook(validBody, {}, TEST_SECRET),
      "Missing X-Shipmail-Signature header",
    );
  });

  test("invalid timestamp header throws WebhookVerificationError", async () => {
    const signature = generateSignature(TEST_SECRET, 0, validBody);

    await expectVerificationError(
      verifyWebhook(
        validBody,
        {
          "x-shipmail-signature": signature,
          "x-shipmail-timestamp": "not-a-number",
        },
        TEST_SECRET,
      ),
      "Invalid X-Shipmail-Timestamp header",
    );
  });

  test("invalid JSON body throws WebhookVerificationError", async () => {
    const invalidBody = "not valid json {{{";
    const timestamp = currentTimestamp();
    const signature = generateSignature(TEST_SECRET, timestamp, invalidBody);

    await expectVerificationError(
      verifyWebhook(
        invalidBody,
        {
          "x-shipmail-signature": signature,
          "x-shipmail-timestamp": String(timestamp),
        },
        TEST_SECRET,
      ),
      "Invalid webhook payload: not valid JSON",
    );
  });

  test("verification error is not retryable", async () => {
    try {
      await verifyWebhook(validBody, {}, TEST_SECRET);
    } catch (err) {
      expect((err as WebhookVerificationError).retryable).toBe(false);
    }
  });
});
