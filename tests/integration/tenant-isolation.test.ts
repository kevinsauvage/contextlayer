import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import {
  getAnalysis,
  getGithubInstallation,
  getJiraConnection,
  getProject,
  listGithubInstallations,
  listProjects,
} from "@/features/projects/queries";
import { connectGithub } from "@/features/integrations/github-link";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { first } from "@/lib/first";

let db: Database;
const ids = { project: "", analysis: "", connection: "" };

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  db = pg;

  const now = new Date();
  await db.insert(schema.user).values({ id: "u1", name: "U", email: "u@x.test", createdAt: now, updatedAt: now });
  await db.insert(schema.organization).values([
    { id: "orgA", name: "A", slug: "a", createdAt: now },
    { id: "orgB", name: "B", slug: "b", createdAt: now },
  ]);
  await db.insert(schema.githubInstallation).values({ id: 42, organizationId: "orgA", accountLogin: "acme" });
  const connection = first(
    await db
      .insert(schema.jiraConnection)
      .values({
        organizationId: "orgA",
        cloudId: "c",
        siteUrl: "https://a.atlassian.net",
        siteName: "A",
        accessTokenEnc: "x",
        refreshTokenEnc: "y",
        expiresAt: now,
        connectedByUserId: "u1",
      })
      .returning(),
  );
  const project = first(
    await db
      .insert(schema.project)
      .values({
        organizationId: "orgA",
        name: "P",
        githubInstallationId: 42,
        repoOwner: "acme",
        repoName: "shop",
        jiraConnectionId: connection.id,
        jiraProjectKey: "SHOP",
      })
      .returning(),
  );
  const analysis = first(
    await db
      .insert(schema.analysis)
      .values({ projectId: project.id, createdByUserId: "u1", kind: "create", input: { title: "t" } })
      .returning(),
  );
  Object.assign(ids, { project: project.id, analysis: analysis.id, connection: connection.id });
});

describe("tenant isolation", () => {
  it("returns data to the owning organization", async () => {
    expect(await getProject(db, "orgA", ids.project)).not.toBeNull();
    expect((await getAnalysis(db, "orgA", ids.analysis))?.project.id).toBe(ids.project);
    expect(await getGithubInstallation(db, "orgA", 42)).not.toBeNull();
    expect(await getJiraConnection(db, "orgA", ids.connection)).not.toBeNull();
  });

  it("hides everything from another organization", async () => {
    expect(await getProject(db, "orgB", ids.project)).toBeNull();
    expect(await getAnalysis(db, "orgB", ids.analysis)).toBeNull();
    expect(await getGithubInstallation(db, "orgB", 42)).toBeNull();
    expect(await getJiraConnection(db, "orgB", ids.connection)).toBeNull();
    expect(await listProjects(db, "orgB")).toEqual([]);
  });
});

describe("connecting GitHub", () => {
  const accounts = [
    { installationId: 99, accountLogin: "acme" },
    { installationId: 100, accountLogin: "acme-org" },
  ];
  const connect = (organizationId: string, installationId?: number, available = accounts) =>
    connectGithub(db, { organizationId, accounts: available, installationId });

  it("links every installation the user has when none is specified, and is idempotent", async () => {
    expect(await connect("orgA")).toBe("connected");
    expect(await connect("orgA")).toBe("connected");
    expect((await listGithubInstallations(db, "orgA")).map((i) => i.id)).toEqual(expect.arrayContaining([99, 100]));
  });

  it("refuses installations that belong to another organization", async () => {
    expect(await connect("orgB")).toBe("taken");
    expect(await listGithubInstallations(db, "orgB")).toEqual([]);
  });

  it("links only the requested installation and rejects ids the user cannot access", async () => {
    expect(await connect("orgB", 555, [{ installationId: 555, accountLogin: "solo" }])).toBe("connected");
    expect(await connect("orgB", 12345, accounts)).toBe("forbidden");
  });

  it("asks for an installation when the user has none", async () => {
    expect(await connect("orgB", undefined, [])).toBe("needs_install");
  });
});
