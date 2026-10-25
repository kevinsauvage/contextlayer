import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
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

async function completedAnalysis(): Promise<string> {
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
        runToken: crypto.randomUUID(),
      })
      .returning({ id: schema.analysis.id }),
  );
  return row.id;
}

describe("publishApproved", () => {
  it("creates the issue once and records its key and URL", async () => {
    const id = await completedAnalysis();
    const result = await publishApproved(db, id, draft, async () => ({ key: "SHOP-1", url: "u/1" }));

    expect(result).toEqual({ issueKey: "SHOP-1", issueUrl: "u/1" });
    const [row] = await db.select().from(schema.analysis).where(eq(schema.analysis.id, id));
    expect(row).toMatchObject({ publishedIssueKey: "SHOP-1", publishedIssueUrl: "u/1", publishingSince: null });
  });

  it("lets only one of two simultaneous approvals create an issue", async () => {
    const id = await completedAnalysis();
    let writes = 0;
    const write = async () => {
      writes += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { key: "SHOP-2", url: "u/2" };
    };

    const results = await Promise.all([publishApproved(db, id, draft, write), publishApproved(db, id, draft, write)]);

    expect(writes).toBe(1);
    expect(results.filter((result) => result.issueKey === "SHOP-2")).toHaveLength(1);
    expect(results.filter((result) => result.error === "This analysis is already being published")).toHaveLength(1);
  });

  it("releases the claim when the tracker refuses the write, so a retry can publish", async () => {
    const id = await completedAnalysis();
    const rejected = await publishApproved(db, id, draft, async () => {
      throw new TrackerRejectedError("summary: The summary is too long.");
    });

    expect(rejected).toEqual({ error: "summary: The summary is too long." });
    const retried = await publishApproved(db, id, draft, async () => ({ key: "SHOP-3", url: "u/3" }));
    expect(retried).toEqual({ issueKey: "SHOP-3", issueUrl: "u/3" });
  });

  it("keeps the claim after an unconfirmed write, which may have created the issue", async () => {
    const id = await completedAnalysis();
    const unconfirmed = await publishApproved(db, id, draft, async () => {
      throw new Error("socket hang up");
    });

    expect(unconfirmed.error).toMatch(/did not confirm/);
    let writes = 0;
    const retried = await publishApproved(db, id, draft, async () => {
      writes += 1;
      return { key: "SHOP-4", url: "u/4" };
    });
    expect(retried).toEqual({ error: "This analysis is already being published" });
    expect(writes).toBe(0);
  });
});
