import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptInvitation,
  cancelInvitation,
  createOrganization,
  deleteOrganization,
  inviteMember,
  leaveOrganization,
  removeMember,
  updateMemberRole,
} from "@/features/organizations/actions";
import { getAuth } from "@/infrastructure/auth/auth";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { migratedDb } from "../helpers/db";

// The actions run against a real Better Auth instance on PGlite; only Next's request scope is faked. `state.cookie` is
// the session of whoever is acting.
const state = vi.hoisted(() => ({ db: undefined as unknown as Database, cookie: "", redirects: [] as string[] }));

vi.mock("@/infrastructure/db/client", () => ({ getDb: () => state.db }));

const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => new Headers({ cookie: state.cookie }),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    state.redirects.push(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
  },
}));

const db = () => state.db;
const sessions: Record<string, string> = {};

async function signUp(email: string): Promise<string> {
  const response = await getAuth().api.signUpEmail({
    body: { email, password: "password-1234", name: email.split("@")[0] ?? email },
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  sessions[email] = cookie;
  return cookie;
}

const actAs = (email: string) => {
  state.cookie = sessions[email] ?? "";
};

const memberOf = async (organizationId: string, email: string) => {
  const [row] = await db()
    .select({ id: schema.member.id, role: schema.member.role })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(and(eq(schema.user.email, email), eq(schema.member.organizationId, organizationId)));
  return row;
};

async function invite(email: string, role = "member") {
  const result = await inviteMember(email, role);
  if (!result.invitationId) throw new Error(result.error ?? "no invitation");
  return result.invitationId;
}

let orgId: string;

beforeAll(async () => {
  state.db = await migratedDb();
  for (const email of ["owner@x.test", "admin@x.test", "member@x.test", "outsider@x.test"]) await signUp(email);

  actAs("owner@x.test");
  const created = await createOrganization("Acme");
  orgId = created.organizationId ?? "";

  const adminInvite = await invite("admin@x.test", "admin");
  const memberInvite = await invite("member@x.test");
  actAs("admin@x.test");
  await acceptInvitation(adminInvite);
  actAs("member@x.test");
  await acceptInvitation(memberInvite);
});

beforeEach(() => {
  state.redirects = [];
  actAs("owner@x.test");
});

describe("organization actions", () => {
  it("lets the invitees join with the invited role", async () => {
    expect(orgId).not.toBe("");
    expect((await memberOf(orgId, "admin@x.test"))?.role).toBe("admin");
    expect((await memberOf(orgId, "member@x.test"))?.role).toBe("member");
  });

  it("refuses an invitation to anyone but the invited address", async () => {
    const invitationId = await invite("someone@x.test");
    actAs("outsider@x.test");

    expect((await acceptInvitation(invitationId)).error).toBeDefined();
    expect(await memberOf(orgId, "outsider@x.test")).toBeUndefined();

    actAs("owner@x.test");
    expect(await cancelInvitation(invitationId)).toEqual({});
  });

  it("keeps invitations, roles and removals to owners and admins", async () => {
    actAs("member@x.test");
    const target = await memberOf(orgId, "admin@x.test");
    if (!target) throw new Error("missing admin");
    const forbidden = { error: "Only organization owners and admins can do this" };

    expect(await inviteMember("new@x.test", "member")).toEqual(forbidden);
    expect(await updateMemberRole(target.id, "member")).toEqual(forbidden);
    expect(await removeMember(target.id)).toEqual(forbidden);
    expect((await memberOf(orgId, "admin@x.test"))?.role).toBe("admin");
  });

  it("refuses an invitation role that is not offered", async () => {
    expect(await inviteMember("new@x.test", "owner")).toEqual({ error: "Choose a valid role" });
  });

  it("lets an admin change a role and remove a member", async () => {
    actAs("admin@x.test");
    const member = await memberOf(orgId, "member@x.test");
    if (!member) throw new Error("missing member");

    expect(await updateMemberRole(member.id, "admin")).toEqual({});
    expect((await memberOf(orgId, "member@x.test"))?.role).toBe("admin");
    expect(await updateMemberRole(member.id, "member")).toEqual({});
    expect(await removeMember(member.id)).toEqual({});
    expect(await memberOf(orgId, "member@x.test")).toBeUndefined();
  });

  it("lets only the owner delete the organization", async () => {
    actAs("admin@x.test");
    expect(await deleteOrganization()).toEqual({ error: "Only the organization owner can delete it" });
  });

  it("moves a member who leaves to their next organization", async () => {
    actAs("admin@x.test");
    const other = await createOrganization("Beta");
    expect(other.organizationId).toBeDefined();
    await getAuth().api.setActiveOrganization({
      body: { organizationId: orgId },
      headers: new Headers({ cookie: state.cookie }),
    });

    await expect(leaveOrganization()).rejects.toThrow("NEXT_REDIRECT:/projects");
    expect(await memberOf(orgId, "admin@x.test")).toBeUndefined();
  });

  it("sends the owner to onboarding after deleting their only organization", async () => {
    await expect(deleteOrganization()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
    expect(await db().select().from(schema.organization).where(eq(schema.organization.id, orgId))).toEqual([]);
  });
});
