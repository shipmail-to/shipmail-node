import { describe, expect, test } from "bun:test";

import { API_KEY_SCOPES, apiKeyScopesGrant } from "../api-key-scopes.js";

describe("message security review scope", () => {
  test("is explicit for least-privilege keys while wildcard credentials remain powerful", () => {
    expect(API_KEY_SCOPES).toContain("messages:review");
    expect(apiKeyScopesGrant(["messages:read"], "messages:review")).toBe(false);
    expect(apiKeyScopesGrant(["messages:review"], "messages:review")).toBe(true);
    expect(apiKeyScopesGrant(["*"], "messages:review")).toBe(true);
  });
});
