import { beforeAll, describe, expect, it } from "vitest";
import { getConnection, listConnections } from "@/features/integrations/connections";
import { listMembers, listUserOrganizations } from "@/features/organizations/queries";
import { getAnalysis, getProject, listProjects } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { first } from "@/lib/first";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

let db: Database;
const ids = { project: "", analysis: "", source: "", tracker: "" };

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA", "orgB"]);
  await db
    .insert(schema.member)
    .values({ id: "m1", organizationId: "orgA", userId: "u1", role: "owner", createdAt: new Date() });
  const connections = await seedConnections(db, "orgA");
  const project = await seedProject(db, "orgA", connections, {
    sourceResourceId: "acme/shop",
    trackerResourceId: "SHOP",
    trackerResourceLabel: "SHOP · Shop",
  });
  const analysis = first(
    await db
      .insert(schema.analysis)
      .values({ projectId: project.id, createdByUserId: "u1", kind: "create", input: { title: "t" } })
      .returning(),
  );
  Object.assign(ids, {
    project: project.id,
    analysis: analysis.id,
    source: connections.source.id,
    tracker: connections.tracker.id,
  });
});

describe("tenant isolation", () => {
  it("returns data to the owning organization", async () => {
    expect(await getProject(db, "orgA", ids.project)).not.toBeNull();
    expect((await getAnalysis(db, "orgA", ids.analysis))?.project.id).toBe(ids.project);
    expect(await getConnection(db, "orgA", ids.source)).not.toBeNull();
    expect((await listProjects(db, "orgA")).map((row) => [row.sourceProvider, row.trackerProvider])).toEqual([
      ["github", "jira"],
    ]);
    expect(await listMembers(db, "orgA")).toHaveLength(1);
  });

  it("hides everything from another organization", async () => {
    expect(await getProject(db, "orgB", ids.project)).toBeNull();
    expect(await getAnalysis(db, "orgB", ids.analysis)).toBeNull();
    expect(await getConnection(db, "orgB", ids.tracker)).toBeNull();
    expect(await listProjects(db, "orgB")).toEqual([]);
    expect(await listConnections(db, "orgB")).toEqual([]);
    expect(await listMembers(db, "orgB")).toEqual([]);
  });

  it("lists only the organizations a user belongs to", async () => {
    expect((await listUserOrganizations(db, "u1")).map((org) => org.id)).toEqual(["orgA"]);
  });

  it("counts the projects that use each connection", async () => {
    const counts = Object.fromEntries((await listConnections(db, "orgA")).map((c) => [c.provider, c.projectCount]));
    expect(counts).toEqual({ github: 1, jira: 1 });
  });
});
