import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { STALE_ANALYSIS_ERROR, STALE_ANALYSIS_MS } from "@/core/analysis/stale";
import { getAnalysis, getProject, listAnalyses, listProjects } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { first } from "@/lib/first";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

let db: Database;
let connections: Awaited<ReturnType<typeof seedConnections>>;
let projectId: string;

async function addAnalysis(
  overrides: Partial<typeof schema.analysis.$inferInsert> = {},
  id = crypto.randomUUID(),
): Promise<string> {
  await db.insert(schema.analysis).values({
    id,
    projectId,
    createdByUserId: "u1",
    kind: "create",
    status: "completed",
    input: { request: "Round totals" },
    result: { title: "Round totals" },
    ...overrides,
  });
  return id;
}

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA", "orgB"]);
  connections = await seedConnections(db, "orgA");
  const project = await seedProject(db, "orgA", connections, { name: "Storefront" });
  projectId = project.id;
});

describe("getProject", () => {
  it("scopes the lookup to the organization and refuses a malformed id", async () => {
    await expect(getProject(db, "orgA", projectId)).resolves.toMatchObject({ name: "Storefront" });
    await expect(getProject(db, "orgB", projectId)).resolves.toBeNull();
    await expect(getProject(db, "orgA", "not-a-uuid")).resolves.toBeNull();
  });
});

describe("listProjects", () => {
  it("lists projects with the provider of each side, newest first", async () => {
    const projects = await listProjects(db, "orgA");

    const [project] = projects;
    expect(project?.project.name).toBe("Storefront");
    expect(project?.sourceProvider).toBe("github");
    expect(project?.trackerProvider).toBe("jira");
    await expect(listProjects(db, "orgB")).resolves.toEqual([]);
  });
});

describe("getAnalysis", () => {
  it("returns the analysis with its project, scoped through the project's organization", async () => {
    const id = await addAnalysis({ result: { title: "Ok" } });

    await expect(getAnalysis(db, "orgA", id)).resolves.toMatchObject({
      analysis: { id, status: "completed" },
      project: { id: projectId },
    });
    await expect(getAnalysis(db, "orgB", id)).resolves.toBeNull();
    await expect(getAnalysis(db, "orgA", "not-a-uuid")).resolves.toBeNull();
  });

  it("shows a stale running row as failed instead of letting it block the page", async () => {
    const id = await addAnalysis({
      status: "running",
      result: null,
      startedAt: new Date(Date.now() - STALE_ANALYSIS_MS - 1000),
    });

    const found = await getAnalysis(db, "orgA", id);
    expect(found?.analysis).toMatchObject({ status: "failed", error: STALE_ANALYSIS_ERROR });
  });

  it("leaves a recent running row running", async () => {
    const id = await addAnalysis({ status: "running", result: null, startedAt: new Date() });
    await expect(getAnalysis(db, "orgA", id)).resolves.toMatchObject({ analysis: { status: "running" } });
  });
});

describe("listAnalyses", () => {
  it("pages with a keyset cursor and never repeats the cursor row", async () => {
    const base = new Date("2026-11-01T10:00:00.000Z");
    const ids: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      ids.push(
        await addAnalysis(
          { createdAt: new Date(base.getTime() + index * 1000), result: { title: `Run ${index}` } },
          crypto.randomUUID(),
        ),
      );
    }
    const page = await listAnalyses(db, projectId);
    const ourRuns = page.analyses.filter((row) => ids.includes(row.id));
    expect(ourRuns).toHaveLength(3);
    expect(ourRuns[0]?.id).toBe(ids[2]);

    const [cursor] = ourRuns.slice(1);
    if (!cursor) throw new Error("no cursor");
    const next = await listAnalyses(db, projectId, cursor.id);
    expect(next.analyses.map((row) => row.id)).not.toContain(cursor.id);
    expect(next.analyses.some((row) => ids.includes(row.id) && row.createdAt < cursor.createdAt)).toBe(true);
  });

  it("treats a malformed cursor as the first page", async () => {
    const page = await listAnalyses(db, projectId, "not-a-uuid");
    expect(page.analyses.length).toBeGreaterThan(0);
  });

  it("returns no next cursor for a short page", async () => {
    await expect(listAnalyses(db, projectId)).resolves.toMatchObject({ olderThan: null });
  });

  it("caps a page at 50 rows and returns the cursor of the last one", async () => {
    const scratch = await seedProject(db, "orgA", connections, { name: "Large history" });
    const rows = Array.from({ length: 51 }, (_, index) => ({
      projectId: scratch.id,
      createdByUserId: "u1",
      kind: "create" as const,
      status: "completed" as const,
      input: { request: `Run ${index}` },
      result: { title: `Run ${index}` },
      createdAt: new Date(Date.now() - index * 1000),
    }));
    await db.insert(schema.analysis).values(rows);

    const page = await listAnalyses(db, scratch.id);
    expect(page.analyses).toHaveLength(50);
    expect(page.olderThan).toBe(page.analyses.at(-1)?.id);
  });

  it("scopes the history to its project", async () => {
    const other = await seedProject(db, "orgA", connections, { name: "Other" });
    const otherId = first(
      await db
        .insert(schema.analysis)
        .values({
          projectId: other.id,
          createdByUserId: "u1",
          kind: "create",
          status: "completed",
          input: { request: "Other" },
          result: { title: "Other" },
        })
        .returning({ id: schema.analysis.id }),
    ).id;

    const page = await listAnalyses(db, projectId);
    expect(page.analyses.map((row) => row.id)).not.toContain(otherId);
    await expect(listAnalyses(db, other.id)).resolves.toMatchObject({
      analyses: [expect.objectContaining({ id: otherId })],
    });
  });
});

describe("displayed rows", () => {
  it("keeps a stale row's stored status in the database", async () => {
    const id = await addAnalysis({
      status: "running",
      result: null,
      startedAt: new Date(Date.now() - STALE_ANALYSIS_MS - 1000),
    });
    const page = await listAnalyses(db, projectId);
    expect(page.analyses.find((row) => row.id === id)?.status).toBe("failed");

    const [stored] = await db.select().from(schema.analysis).where(eq(schema.analysis.id, id));
    expect(stored?.status).toBe("running");
  });
});
