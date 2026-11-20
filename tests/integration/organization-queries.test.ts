import { beforeAll, describe, expect, it } from "vitest";
import {
  getOrganization,
  getPendingInvitation,
  listInvitationsForUser,
  listMembers,
  listPendingInvitations,
  listUserOrganizations,
} from "@/features/organizations/queries";
import type { Database } from "@/infrastructure/db/client";
import { invitation, member, organization, user } from "@/infrastructure/db/schema";
import { migratedDb } from "../helpers/db";

let db: Database;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const now = Date.now();

beforeAll(async () => {
  db = await migratedDb();
  await db.insert(user).values(
    ["u1", "u2", "u3"].map((id) => ({
      id,
      name: id === "u1" ? "Owner" : `User ${id}`,
      email: `${id}@x.test`,
      emailVerified: false,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })),
  );
  await db.insert(organization).values([
    { id: "orgB", name: "Beta", slug: "beta", createdAt: new Date(now) },
    { id: "orgA", name: "Alpha", slug: "alpha", createdAt: new Date(now) },
  ]);
  await db.insert(member).values([
    { id: "m1", organizationId: "orgA", userId: "u1", role: "owner", createdAt: new Date(now) },
    { id: "m2", organizationId: "orgB", userId: "u1", role: "member", createdAt: new Date(now + 1) },
    { id: "m3", organizationId: "orgA", userId: "u2", role: "admin", createdAt: new Date(now + 2) },
  ]);
  await db.insert(invitation).values([
    {
      id: "inv-pending",
      organizationId: "orgA",
      email: "invitee@x.test",
      role: "member",
      status: "pending",
      expiresAt: new Date(now + DAY),
      inviterId: "u1",
      createdAt: new Date(now),
    },
    {
      id: "inv-expired",
      organizationId: "orgA",
      email: "late@x.test",
      role: "member",
      status: "pending",
      expiresAt: new Date(now - MINUTE),
      inviterId: "u1",
      createdAt: new Date(now),
    },
    {
      id: "inv-used",
      organizationId: "orgB",
      email: "used@x.test",
      role: "admin",
      status: "accepted",
      expiresAt: new Date(now + DAY),
      inviterId: "u1",
      createdAt: new Date(now),
    },
  ]);
});

describe("listUserOrganizations", () => {
  it("returns the organizations a user belongs to, by name, with the role there", async () => {
    await expect(listUserOrganizations(db, "u1")).resolves.toEqual([
      { id: "orgA", name: "Alpha", role: "owner" },
      { id: "orgB", name: "Beta", role: "member" },
    ]);
    await expect(listUserOrganizations(db, "u3")).resolves.toEqual([]);
  });
});

describe("getOrganization", () => {
  it("returns the name only, or null", async () => {
    await expect(getOrganization(db, "orgA")).resolves.toEqual({ id: "orgA", name: "Alpha" });
    await expect(getOrganization(db, "missing")).resolves.toBeNull();
  });
});

describe("listMembers", () => {
  it("joins the user and keeps the membership order", async () => {
    await expect(listMembers(db, "orgA")).resolves.toEqual([
      { id: "m1", userId: "u1", name: "Owner", email: "u1@x.test", role: "owner" },
      { id: "m3", userId: "u2", name: "User u2", email: "u2@x.test", role: "admin" },
    ]);
  });
});

describe("pending invitations", () => {
  it("lists only the pending, unexpired invitations of one organization", async () => {
    await expect(listPendingInvitations(db, "orgA")).resolves.toEqual([
      { id: "inv-pending", email: "invitee@x.test", role: "member", expiresAt: new Date(now + DAY) },
    ]);
    await expect(listPendingInvitations(db, "orgB")).resolves.toEqual([]);
  });

  it("resolves one invitation with its organization and inviter, ignoring stale ones", async () => {
    await expect(getPendingInvitation(db, "inv-pending")).resolves.toEqual({
      id: "inv-pending",
      email: "invitee@x.test",
      organizationName: "Alpha",
      inviterName: "Owner",
    });
    await expect(getPendingInvitation(db, "inv-expired")).resolves.toBeNull();
    await expect(getPendingInvitation(db, "inv-used")).resolves.toBeNull();
  });
});

describe("listInvitationsForUser", () => {
  it("offers an invitation by address only to a verified address", async () => {
    await expect(listInvitationsForUser(db, { email: "INVITEE@x.test", emailVerified: false })).resolves.toEqual([]);
    await expect(listInvitationsForUser(db, { email: "INVITEE@x.test", emailVerified: true })).resolves.toEqual([
      { id: "inv-pending", organizationName: "Alpha" },
    ]);
  });

  it("hides an expired or accepted invitation", async () => {
    await expect(listInvitationsForUser(db, { email: "late@x.test", emailVerified: true })).resolves.toEqual([]);
    await expect(listInvitationsForUser(db, { email: "used@x.test", emailVerified: true })).resolves.toEqual([]);
  });
});
