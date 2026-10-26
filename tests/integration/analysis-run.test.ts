import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { AnalysisAlreadyRunningError } from "@/core/errors";
import { estimateCostUsd } from "@/core/analysis/pricing";
import { STALE_ANALYSIS_ERROR } from "@/core/analysis/stale";
import { restartAnalysis, startAnalysis } from "@/features/analysis/run";
import { getAnalysis, type Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { getEnv } from "@/infrastructure/env";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

let db: Database;
let project: Project;

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA"]);
  const connections = await seedConnections(db, "orgA");
  project = await seedProject(db, "orgA", connections, { trackerResourceId: "P" });
});

type Execute = () => Promise<{
  result: unknown;
  issues: [];
  revision?: string;
  usage?: { inputTokens: number; outputTokens: number };
}>;

const start = (request: string, execute: Execute) =>
  startAnalysis({ db, project, userId: "u1", kind: "create", input: { request }, execute });

const restart = (request: string, execute: Execute, rerunId: string) =>
  restartAnalysis({ db, userId: "u1", input: { request }, execute, rerunId });

// `startAnalysis` returns the id only once its run finished, so a pending run is found by its stored input.
async function waitForRow(request: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const rows = await db.select().from(schema.analysis);
    const row = rows.find((candidate) => {
      const input: unknown = candidate.input;
      return typeof input === "object" && input !== null && "request" in input && input.request === request;
    });
    if (row) return row.id;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`no analysis row for ${request}`);
}

describe("source revisions", () => {
  const revisionsOf = async (id: string) => {
    const found = (await getAnalysis(db, "orgA", id))?.analysis;
    return { current: found?.sourceRevision, previous: found?.previousSourceRevision };
  };
  const at = (revision: string) => async () => ({ result: { title: "T" }, issues: [] as [], revision });

  it("records the commit a run read and keeps the one it replaced on a re-run", async () => {
    const id = await start("revisions", at("aaa1111"));
    expect(await revisionsOf(id)).toEqual({ current: "aaa1111", previous: null });

    await restart("revisions", at("bbb2222"), id);
    expect(await revisionsOf(id)).toEqual({ current: "bbb2222", previous: "aaa1111" });
  });

  it("compares with the last draft that read the code when a re-run in between failed", async () => {
    const id = await start("revisions after a failure", at("aaa1111"));
    await restart(
      "revisions after a failure",
      async () => {
        throw new Error("model timed out");
      },
      id,
    );
    await restart("revisions after a failure", at("ccc3333"), id);

    expect(await revisionsOf(id)).toEqual({ current: "ccc3333", previous: "aaa1111" });
  });
});

describe("cost", () => {
  it("records the price of the run's tokens for the configured model", async () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
    const id = await start("cost", async () => ({ result: {}, issues: [], usage }));

    expect((await getAnalysis(db, "orgA", id))?.analysis.costUsd).toBe(estimateCostUsd(getEnv().AI_MODEL, usage));
  });

  it("clears the previous cost when a re-run starts", async () => {
    const id = await start("cost again", async () => ({
      result: {},
      issues: [],
      usage: { inputTokens: 1000, outputTokens: 1000 },
    }));
    await restart(
      "cost again",
      async () => {
        throw new Error("model timed out");
      },
      id,
    );

    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({ status: "failed", costUsd: null });
  });
});

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
      .set({ status: "running", startedAt: new Date(Date.now() - 11 * 60 * 1000) })
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
      .set({ status: "running", startedAt: new Date(Date.now() - 11 * 60 * 1000) })
      .where(eq(schema.analysis.id, id));

    await expect(restart("fresh", async () => ({ result: {}, issues: [] }), id)).resolves.toBe(id);
    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "completed",
      input: { request: "fresh" },
    });
  });

  it("discards the outcome of a run that a re-run replaced", async () => {
    let finishFirst!: (outcome: { result: unknown; issues: [] }) => void;
    const first = start(
      "slow",
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    );
    const slowId = await waitForRow("slow");
    await db
      .update(schema.analysis)
      .set({ startedAt: new Date(Date.now() - 11 * 60 * 1000) })
      .where(eq(schema.analysis.id, slowId));

    await restart("replacement", async () => ({ result: { title: "replacement" }, issues: [] }), slowId);
    finishFirst({ result: { title: "slow" }, issues: [] });
    await first;

    expect((await getAnalysis(db, "orgA", slowId))?.analysis).toMatchObject({
      status: "completed",
      input: { request: "replacement" },
      result: { title: "replacement" },
    });
  });
});
