import { beforeAll, describe, expect, it } from "vitest";
import { listInvitationsForUser } from "@/features/organizations/queries";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { migratedDb, seedOrgs } from "../helpers/db";

let db: Database;

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA"]);
  await db.insert(schema.invitation).values({
    id: "inv1",
    organizationId: "orgA",
    email: "new@x.test",
    role: "member",
    expiresAt: new Date(Date.now() + 60_000),
    inviterId: "u1",
  });
});

describe("listInvitationsForUser", () => {
  it("offers an invitation to the verified owner of the address", async () => {
    expect(await listInvitationsForUser(db, { email: "New@x.test", emailVerified: true })).toEqual([
      { id: "inv1", organizationName: "orgA" },
    ]);
  });

  // Sign-up does not verify email, so anyone could register the invitee's address first.
  it("offers nothing to an unverified account with the invited address", async () => {
    expect(await listInvitationsForUser(db, { email: "new@x.test", emailVerified: false })).toEqual([]);
  });
});
