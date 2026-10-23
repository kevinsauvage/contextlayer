import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { AnalysisAlreadyRunningError } from "@/core/errors";
import { STALE_ANALYSIS_ERROR } from "@/features/analysis/stale";
import { restartAnalysis, startAnalysis } from "@/features/analysis/run";
import { getAnalysis, type Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

let db: Database;
let project: Project;

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA"]);
  const connections = await seedConnections(db, "orgA");
  project = await seedProject(db, "orgA", connections, { trackerResourceId: "P" });
});

type Execute = () => Promise<{ result: unknown; issues: [] }>;

const start = (request: string, execute: Execute) =>
  startAnalysis({ db, project, userId: "u1", kind: "create", input: { request }, execute });

const restart = (request: string, execute: Execute, rerunId: string) =>
  restartAnalysis({ db, userId: "u1", input: { request }, execute, rerunId });

describe("running an analysis", () => {
  it("records a failure with its message", async () => {
    const id = await start("vague", async () => {
      throw new Error("model timed out");
    });
    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({ status: "failed", error: "model timed out" });
  });

  it("re-runs in place with the refined title and clears the previous outcome", async () => {
    const id = await start("vague", async () => {
      throw new Error("model timed out");
    });
    const rerun = await restart("Change the hero heading", async () => ({ result: { title: "Hero" }, issues: [] }), id);

    expect(rerun).toBe(id);
    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "completed",
      input: { request: "Change the hero heading" },
      result: { title: "Hero" },
      error: null,
    });
  });

  it("refuses to re-run an analysis that is already running", async () => {
    const id = await start("vague", async () => {
      throw new Error("model timed out");
    });
    await db
      .update(schema.analysis)
      .set({ status: "running", input: { request: "in flight" } })
      .where(eq(schema.analysis.id, id));
    let executed = false;

    await expect(
      restart(
        "refined",
        async () => {
          executed = true;
          return { result: {}, issues: [] };
        },
        id,
      ),
    ).rejects.toBeInstanceOf(AnalysisAlreadyRunningError);
    expect(executed).toBe(false);
    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "running",
      input: { request: "in flight" },
    });
  });

  it("starts only one of two simultaneous re-runs", async () => {
    const id = await start("vague", async () => {
      throw new Error("model timed out");
    });
    const slow = () =>
      new Promise<{ result: unknown; issues: [] }>((resolve) =>
        setTimeout(() => resolve({ result: {}, issues: [] }), 10),
      );

    const results = await Promise.allSettled([restart("first", slow, id), restart("second", slow, id)]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(AnalysisAlreadyRunningError);
  });

  it("reports a stale running row as failed without writing", async () => {
    const id = await start("vague", async () => {
      throw new Error("model timed out");
    });
    await db
      .update(schema.analysis)
      .set({ status: "running", createdAt: new Date(Date.now() - 11 * 60 * 1000) })
      .where(eq(schema.analysis.id, id));

    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "failed",
      error: STALE_ANALYSIS_ERROR,
    });
    const [row] = await db.select().from(schema.analysis).where(eq(schema.analysis.id, id));
    expect(row?.status).toBe("running");
  });

  it("re-runs a stale running row", async () => {
    const id = await start("vague", async () => {
      throw new Error("model timed out");
    });
    await db
      .update(schema.analysis)
      .set({ status: "running", createdAt: new Date(Date.now() - 11 * 60 * 1000) })
      .where(eq(schema.analysis.id, id));

    await expect(restart("fresh", async () => ({ result: {}, issues: [] }), id)).resolves.toBe(id);
    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "completed",
      input: { request: "fresh" },
    });
  });
});
