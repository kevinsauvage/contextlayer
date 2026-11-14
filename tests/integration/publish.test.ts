import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PUBLISH_CLAIM_MS } from "@/core/analysis/stale";
import { TrackerRejectedError } from "@/core/errors";
import type { TicketDraft } from "@/core/requirements/schemas";
import { publishApproved } from "@/features/analysis/publish";
import type { Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { first } from "@/lib/first";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

let db: Database;
let project: Project;

const draft: TicketDraft = {
  title: "Round cart totals",
  description: [{ text: "Totals are rounded down.", status: "verified", evidenceIds: ["e1"] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence: [
    {
      id: "e1",
      kind: "code",
      reference: "src/cart/loadCart.ts",
      excerpt: "Math.floor(total)",
    },
  ],
};

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA"]);
  project = await seedProject(db, "orgA", await seedConnections(db, "orgA"));
});

async function completedAnalysis(): Promise<{ id: string; runToken: string }> {
  const runToken = crypto.randomUUID();
  const row = first(
    await db
      .insert(schema.analysis)
      .values({
        projectId: project.id,
        createdByUserId: "u1",
        kind: "create",
        status: "completed",
        input: { request: "Round totals" },
        result: draft,
        runToken,
      })
      .returning({ id: schema.analysis.id }),
  );
  return { id: row.id, runToken };
}

describe("publishApproved", () => {
  const rowOf = async (id: string) => first(await db.select().from(schema.analysis).where(eq(schema.analysis.id, id)));

  const claimedAt = async (id: string, ageMs: number) =>
    db
      .update(schema.analysis)
      .set({ publishingSince: new Date(Date.now() - ageMs) })
      .where(eq(schema.analysis.id, id));

  // Fails the nth call to `db.update` after the claim, which is the publish record.
  const failingRecord = (failures: number[]) => {
    const original = db.update.bind(db);
    let calls = 0;
    return vi.spyOn(db, "update").mockImplementation((...args: Parameters<typeof db.update>) => {
      calls += 1;
      if (failures.includes(calls)) throw new Error("database unavailable");
      return original(...args);
    });
  };

  it("creates the issue once and records its key and URL", async () => {
    const { id, runToken } = await completedAnalysis();
    const result = await publishApproved(db, id, runToken, draft, async () => ({ key: "SHOP-1", url: "u/1" }));

    expect(result).toEqual({ issueKey: "SHOP-1", issueUrl: "u/1" });
    const [row] = await db.select().from(schema.analysis).where(eq(schema.analysis.id, id));
    expect(row).toMatchObject({ publishedIssueKey: "SHOP-1", publishedIssueUrl: "u/1", publishingSince: null });
  });

  it("lets only one of two simultaneous approvals create an issue", async () => {
    const { id, runToken } = await completedAnalysis();
    let writes = 0;
    const write = async () => {
      writes += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { key: "SHOP-2", url: "u/2" };
    };

    const results = await Promise.all([
      publishApproved(db, id, runToken, draft, write),
      publishApproved(db, id, runToken, draft, write),
    ]);

    expect(writes).toBe(1);
    expect(results.filter((result) => result.issueKey === "SHOP-2")).toHaveLength(1);
    expect(
      results.filter(
        (result) => result.error === "This draft is already being published. Wait a moment, then reload the page.",
      ),
    ).toHaveLength(1);
  });

  it("releases the claim when the tracker refuses the write, so a retry can publish", async () => {
    const { id, runToken } = await completedAnalysis();
    const rejected = await publishApproved(db, id, runToken, draft, async () => {
      throw new TrackerRejectedError("summary: The summary is too long.");
    });

    expect(rejected).toEqual({ error: "summary: The summary is too long." });
    const retried = await publishApproved(db, id, runToken, draft, async () => ({ key: "SHOP-3", url: "u/3" }));
    expect(retried).toEqual({ issueKey: "SHOP-3", issueUrl: "u/3" });
  });

  it("keeps the claim after an unconfirmed write, which may have created the issue", async () => {
    const { id, runToken } = await completedAnalysis();
    const unconfirmed = await publishApproved(db, id, runToken, draft, async () => {
      throw new Error("socket hang up");
    });

    expect(unconfirmed.error).toMatch(/did not confirm/);
    let writes = 0;
    const retried = await publishApproved(db, id, runToken, draft, async () => {
      writes += 1;
      return { key: "SHOP-4", url: "u/4" };
    });
    expect(retried).toEqual({ error: "This draft is already being published. Wait a moment, then reload the page." });
    expect(writes).toBe(0);
  });

  it("publishes once a dead request's claim has expired", async () => {
    const { id, runToken } = await completedAnalysis();
    await claimedAt(id, PUBLISH_CLAIM_MS + 1000);

    expect(await publishApproved(db, id, runToken, draft, async () => ({ key: "SHOP-5", url: "u/5" }))).toEqual({
      issueKey: "SHOP-5",
      issueUrl: "u/5",
    });
    expect((await rowOf(id)).publishingSince).toBeNull();
  });

  it("refuses while another approval's claim is still live", async () => {
    const { id, runToken } = await completedAnalysis();
    await claimedAt(id, 10_000);
    let writes = 0;

    const result = await publishApproved(db, id, runToken, draft, async () => {
      writes += 1;
      return { key: "SHOP-6", url: "u/6" };
    });

    expect(result).toEqual({ error: "This draft is already being published. Wait a moment, then reload the page." });
    expect(writes).toBe(0);
  });

  it("refuses a row that is already published", async () => {
    const { id, runToken } = await completedAnalysis();
    await db
      .update(schema.analysis)
      .set({ publishedIssueKey: "SHOP-7", publishedIssueUrl: "u/7" })
      .where(eq(schema.analysis.id, id));
    let writes = 0;

    const result = await publishApproved(db, id, runToken, draft, async () => {
      writes += 1;
      return { key: "SHOP-8", url: "u/8" };
    });

    expect(result).toEqual({ error: "This draft is already being published. Wait a moment, then reload the page." });
    expect(writes).toBe(0);
  });

  it("retries recording the issue once the write landed", async () => {
    const { id, runToken } = await completedAnalysis();
    const spy = failingRecord([2]);

    try {
      expect(await publishApproved(db, id, runToken, draft, async () => ({ key: "SHOP-9", url: "u/9" }))).toEqual({
        issueKey: "SHOP-9",
        issueUrl: "u/9",
      });
      expect((await rowOf(id)).publishedIssueKey).toBe("SHOP-9");
    } finally {
      spy.mockRestore();
    }
  });

  it("names the issue when it could not record the publish at all", async () => {
    const { id, runToken } = await completedAnalysis();
    const spy = failingRecord([2, 3]);
    let writes = 0;

    try {
      const result = await publishApproved(db, id, runToken, draft, async () => {
        writes += 1;
        return { key: "SHOP-10", url: "u/10" };
      });
      expect(result).toMatchObject({ issueKey: "SHOP-10", issueUrl: "u/10" });
      expect(result.error).toMatch(/Do not approve this draft again; use SHOP-10\./);
      expect(writes).toBe(1);
      expect((await rowOf(id)).publishedIssueKey).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
