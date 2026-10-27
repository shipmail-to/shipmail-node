import { describe, expect, test } from "bun:test";

import { ShipmailClient } from "../../client.js";
import type { PaginatedResponse } from "../../types/common.js";
import type { Invitation, Member, MemberRole } from "../../types/member.js";

function createClient(
  handler: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>,
): ShipmailClient {
  const fetchFn: typeof fetch = async (input, init) => handler(input, init);
  return new ShipmailClient({
    apiKey: "sm_live_test",
    baseUrl: "https://api.test.com/v1",
    fetch: fetchFn,
    maxRetries: 0,
  });
}

const mockMember: Member = {
  object: "member",
  id: "mem_alice",
  email: "alice@acme.com",
  name: "Alice",
  role: "admin",
  mailbox_access: { scope: "selected", mailbox_ids: ["mbx_support"] },
  created_at: "2026-01-01T00:00:00Z",
};

type IsExactMemberRole = [MemberRole] extends ["owner" | "admin" | "member"]
  ? ["owner" | "admin" | "member"] extends [MemberRole]
    ? true
    : false
  : false;

const memberRoleMatchesPublicContract: IsExactMemberRole = true;

describe("Members", () => {
  test("exposes the public roles and mailbox access", () => {
    expect(memberRoleMatchesPublicContract).toBe(true);
    expect(mockMember.role).toBe("admin");
    expect(mockMember.mailbox_access).toEqual({
      scope: "selected",
      mailbox_ids: ["mbx_support"],
    });
  });

  test("lists members with pagination", async () => {
    const response: PaginatedResponse<Member> = {
      data: [mockMember],
      pagination: { next_cursor: null, has_more: false },
    };
    const client = createClient((input, init) => {
      const url = new URL(String(input));
      expect(init?.method).toBe("GET");
      expect(url.pathname).toBe("/v1/members");
      expect(url.searchParams.get("cursor")).toBe("cur_abc");
      expect(url.searchParams.get("limit")).toBe("50");
      return Response.json(response);
    });

    const result = await client.members.list({ cursor: "cur_abc", limit: 50 });
    expect(result.data).toEqual([mockMember]);
  });

  test("gets a member", async () => {
    const owner: Member = {
      ...mockMember,
      id: "mem_owner",
      role: "owner",
      mailbox_access: { scope: "all", mailbox_ids: [] },
    };
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe("/v1/members/mem_owner");
      return Response.json(owner);
    });

    const result = await client.members.get("mem_owner");
    expect(result).toEqual(owner);
    expect(result.mailbox_access).toEqual({
      scope: "all",
      mailbox_ids: [],
    });
  });

  test("auto-paginates members", async () => {
    const client = createClient(() =>
      Response.json({ data: [mockMember], pagination: { next_cursor: null, has_more: false } }),
    );
    const members: Member[] = [];
    for await (const member of client.members.listAutoPaginating({ limit: 10 })) {
      members.push(member);
    }
    expect(members).toEqual([mockMember]);
  });

  test("lists pending invitations", async () => {
    const invitation: Invitation = {
      object: "invitation",
      id: "inv_bob",
      email: "bob@acme.com",
      role: "member",
      mailbox_access: { scope: "selected", mailbox_ids: ["mbx_support"] },
      newsletter_role: "editor",
      created_at: "2026-10-27T00:00:00Z",
      expires_at: "2026-11-03T00:00:00Z",
    };
    const client = createClient((input, init) => {
      expect(init?.method).toBe("GET");
      expect(new URL(String(input)).pathname).toBe("/v1/members/invitations");
      return Response.json({ data: [invitation] });
    });

    const result = await client.members.listInvitations();
    expect(result.data).toEqual([invitation]);
  });

  test("invites a person with an idempotency key", async () => {
    const invitation: Invitation = {
      object: "invitation",
      id: "inv_carol",
      email: "carol@acme.com",
      role: "admin",
      mailbox_access: { scope: "all", mailbox_ids: [] },
      newsletter_role: null,
      created_at: "2026-10-27T00:00:00Z",
      expires_at: null,
    };
    const client = createClient(async (input, init) => {
      expect(init?.method).toBe("POST");
      expect(new URL(String(input)).pathname).toBe("/v1/members/invitations");
      expect(new Headers(init?.headers).get("idempotency-key")).toBe("invite-carol");
      expect(JSON.parse(String(init?.body))).toEqual({
        email: "carol@acme.com",
        role: "admin",
        mailbox_access: "all",
      });
      return Response.json(invitation, { status: 201 });
    });

    const result = await client.members.invite(
      { email: "carol@acme.com", role: "admin", mailbox_access: "all" },
      { idempotencyKey: "invite-carol" },
    );
    expect(result).toEqual(invitation);
  });

  test("cancels an invitation", async () => {
    const client = createClient((input, init) => {
      expect(init?.method).toBe("DELETE");
      expect(new URL(String(input)).pathname).toBe("/v1/members/invitations/inv_bob");
      return new Response(null, { status: 204 });
    });

    await expect(client.members.cancelInvitation("inv_bob")).resolves.toBeUndefined();
  });

  test("shares and unshares a mailbox with a member", async () => {
    const calls: string[] = [];
    const client = createClient((input, init) => {
      calls.push(`${init?.method} ${new URL(String(input)).pathname}`);
      expect(init?.body).toBeNull();
      return Response.json(mockMember);
    });

    expect(await client.members.grantMailboxAccess("mem_alice", "mbx_sales")).toEqual(mockMember);
    expect(await client.members.revokeMailboxAccess("mem_alice", "mbx_sales")).toEqual(mockMember);
    expect(calls).toEqual([
      "PUT /v1/members/mem_alice/mailboxes/mbx_sales",
      "DELETE /v1/members/mem_alice/mailboxes/mbx_sales",
    ]);
  });
});
