import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisAlreadyRunningError, AnalysisLimitError, ConnectionMissingError } from "@/core/errors";
import { STALE_ANALYSIS_ERROR } from "@/core/analysis/stale";
import { assertRunAllowed, claimRun } from "@/features/analysis/limits";
import { restartAnalysis, startAnalysis, UNEXPECTED_RUN_ERROR } from "@/features/analysis/run";
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
  const now = new Date();
  await db
    .insert(schema.user)
    .values({ id: "u-limits", name: "Limits", email: "limits@x.test", createdAt: now, updatedAt: now });
});

type Execute = (
  deadline: AbortSignal,
  onUsage: (usage: { inputTokens: number; outputTokens: number }) => void,
) => Promise<{
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

describe("usage limits", () => {
  const now = new Date("2030-01-01T12:00:00.000Z");
  const limits = { perUserPerDay: 3, totalPerDay: 100, perUserPerMinute: 100 };
  const insertRun = (userId: string, startedAt: Date) => db.insert(schema.analysisRun).values({ userId, startedAt });
  const runsOf = async (userId: string) =>
    (await db.select().from(schema.analysisRun).where(eq(schema.analysisRun.userId, userId))).length;

  beforeEach(async () => {
    await db.delete(schema.analysisRun).where(eq(schema.analysisRun.userId, "u-limits"));
  });

  it("counts a re-run as a run, so refining one analysis spends the same budget as starting one", async () => {
    const before = await runsOf("u1");
    const ok = async () => ({ result: {}, issues: [] as [] });
    const id = await start("counted", ok);
    await restart("counted", ok, id);

    expect(await runsOf("u1")).toBe(before + 2);
  });

  it("refuses a claim at the limit without running it, and records no run for a claim that throws", async () => {
    await insertRun("u-limits", new Date(now.getTime() - 60 * 60_000));
    const claim = vi.fn(async () => "claimed");

    await expect(claimRun(db, "u-limits", { ...limits, perUserPerDay: 1 }, claim, now)).rejects.toBeInstanceOf(
      AnalysisLimitError,
    );
    expect(claim).not.toHaveBeenCalled();

    await expect(
      claimRun(
        db,
        "u-limits",
        limits,
        async () => {
          throw new AnalysisAlreadyRunningError();
        },
        now,
      ),
    ).rejects.toBeInstanceOf(AnalysisAlreadyRunningError);
    expect(await runsOf("u-limits")).toBe(1);

    await expect(claimRun(db, "u-limits", limits, claim, now)).resolves.toBe("claimed");
    expect(await runsOf("u-limits")).toBe(2);
  });

  it("allows a run under every limit", async () => {
    await insertRun("u-limits", new Date(now.getTime() - 2 * 60_000));

    await expect(assertRunAllowed(db, "u-limits", limits, now)).resolves.toBeUndefined();
  });

  it("refuses a caller at their daily limit", async () => {
    await insertRun("u-limits", new Date(now.getTime() - 60 * 60_000));
    await insertRun("u-limits", new Date(now.getTime() - 2 * 60 * 60_000));
    await insertRun("u-limits", new Date(now.getTime() - 3 * 60 * 60_000));

    await expect(assertRunAllowed(db, "u-limits", limits, now)).rejects.toBeInstanceOf(AnalysisLimitError);
    await expect(assertRunAllowed(db, "u-limits", limits, now)).rejects.toThrow(
      "You have reached your daily analysis limit. Try again tomorrow.",
    );
  });

  it("refuses everyone once the deployment's day is spent", async () => {
    await insertRun("u-limits", new Date(now.getTime() - 60 * 60_000));
    await insertRun("u1", new Date(now.getTime() - 60 * 60_000));

    await expect(
      assertRunAllowed(db, "u-limits", { ...limits, totalPerDay: 2, perUserPerDay: 100 }, now),
    ).rejects.toThrow("The daily analysis limit is reached. Try again tomorrow.");
  });

  it("refuses a caller running too fast, and ignores an older run", async () => {
    await insertRun("u-limits", new Date(now.getTime() - 30_000));
    await expect(
      assertRunAllowed(db, "u-limits", { ...limits, perUserPerDay: 100, perUserPerMinute: 1 }, now),
    ).rejects.toThrow("You are running analyses too quickly. Wait a minute and try again.");

    await db.delete(schema.analysisRun).where(eq(schema.analysisRun.userId, "u-limits"));
    await insertRun("u-limits", new Date(now.getTime() - 2 * 60_000));
    await expect(
      assertRunAllowed(db, "u-limits", { ...limits, perUserPerDay: 100, perUserPerMinute: 1 }, now),
    ).resolves.toBeUndefined();
  });
});

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

describe("usage", () => {
  it("records the run's tokens, which the page prices at render time", async () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
    const id = await start("usage", async () => ({ result: {}, issues: [], usage }));

    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
  });

  it("clears the previous tokens when a failed re-run starts", async () => {
    const id = await start("usage again", async () => ({
      result: {},
      issues: [],
      usage: { inputTokens: 1000, outputTokens: 1000 },
    }));
    await restart(
      "usage again",
      async () => {
        throw new Error("model timed out");
      },
      id,
    );

    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "failed",
      inputTokens: null,
      outputTokens: null,
    });
  });

  it("records the tokens a failed run spent before it failed", async () => {
    const id = await start("failing usage", async (_deadline, onUsage) => {
      onUsage({ inputTokens: 500, outputTokens: 50 });
      throw new Error("model timed out");
    });

    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "failed",
      inputTokens: 500,
      outputTokens: 50,
    });
  });

  it("keeps the last good draft and its edits when a re-run fails", async () => {
    const good = {
      title: "Good",
      description: [],
      acceptanceCriteria: [],
      assumptions: [],
      openQuestions: [],
      evidence: [],
    };
    const id = await start("keep draft", async () => ({ result: good, issues: [] }));
    const edited = { ...good, title: "Edited" };
    await db.update(schema.analysis).set({ editedResult: edited }).where(eq(schema.analysis.id, id));
    await restart(
      "keep draft",
      async () => {
        throw new Error("model timed out");
      },
      id,
    );

    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "failed",
      result: good,
      editedResult: edited,
    });
  });
});

describe("running an analysis", () => {
  it("records an unexpected failure without its internal message", async () => {
    const id = await start("vague", async () => {
      throw new Error("POST https://internal.example/v1 failed: 500 req_123");
    });
    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "failed",
      error: UNEXPECTED_RUN_ERROR,
    });
  });

  it("keeps the message of a failure the person can act on", async () => {
    const id = await start("vague", async () => {
      throw new ConnectionMissingError("The code source connection no longer exists");
    });
    expect((await getAnalysis(db, "orgA", id))?.analysis).toMatchObject({
      status: "failed",
      error: "The code source connection no longer exists",
    });
  });

  it("hands the run a live deadline", async () => {
    let received: AbortSignal | undefined;
    await start("vague", async (deadline) => {
      received = deadline;
      return { result: {}, issues: [] };
    });
    expect(received?.aborted).toBe(false);
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

  it("keeps the original author when someone re-runs the analysis", async () => {
    const id = await start("author", async () => ({ result: { title: "T" }, issues: [] }));
    await restart("author", async () => ({ result: { title: "T2" }, issues: [] }), id);

    const [row] = await db.select().from(schema.analysis).where(eq(schema.analysis.id, id));
    expect(row?.createdByUserId).toBe("u1");
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
