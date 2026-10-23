import { beforeAll, describe, expect, it } from "vitest";
import { runAnalysis } from "@/features/analysis/run";
import { getAnalysis, type Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { first } from "@/lib/first";
import { migratedDb, seedOrgs } from "../helpers/db";

let db: Database;
let project: Project;

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA"]);
  const [source, tracker] = await db
    .insert(schema.integrationConnection)
    .values([
      { organizationId: "orgA", provider: "github", externalId: "1", label: "a", connectedByUserId: "u1" },
      { organizationId: "orgA", provider: "jira", externalId: "c", label: "b", connectedByUserId: "u1" },
    ])
    .returning();
  if (!source || !tracker) throw new Error("seed failed");
  project = first(
    await db
      .insert(schema.project)
      .values({
        organizationId: "orgA",
        name: "P",
        sourceConnectionId: source.id,
        sourceResourceId: "a/b",
        sourceResourceLabel: "a/b",
        trackerConnectionId: tracker.id,
        trackerResourceId: "P",
        trackerResourceLabel: "P",
      })
      .returning(),
  );
});

const run = (request: string, execute: () => Promise<{ result: unknown; issues: [] }>, rerunId?: string) =>
  runAnalysis({ db, project, userId: "u1", kind: "create", input: { request }, execute, rerunId });

describe("running an analysis", () => {
  it("records a failure with its message", async () => {
    const id = await run("vague", async () => {
      throw new Error("model timed out");
    });
    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({ status: "failed", error: "model timed out" });
  });

  it("re-runs in place with the refined title and clears the previous outcome", async () => {
    const id = await run("vague", async () => {
      throw new Error("model timed out");
    });
    const rerun = await run("Change the hero heading", async () => ({ result: { title: "Hero" }, issues: [] }), id);

    expect(rerun).toBe(id);
    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "completed",
      input: { request: "Change the hero heading" },
      result: { title: "Hero" },
      error: null,
    });
  });
});
