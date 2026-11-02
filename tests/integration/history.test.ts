import { beforeAll, describe, expect, it } from "vitest";
import { listAnalyses, type Project } from "@/features/projects/queries";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

let db: Database;
let project: Project;
let other: Project;

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA"]);
  const connections = await seedConnections(db, "orgA");
  project = await seedProject(db, "orgA", connections, { name: "P" });
  other = await seedProject(db, "orgA", connections, { name: "Q" });
  // 120 analyses, three per timestamp, so a page boundary falls between rows created at the same instant.
  const base = Date.UTC(2026, 9, 1);
  await db.insert(schema.analysis).values(
    Array.from({ length: 120 }, (_, i) => ({
      projectId: project.id,
      createdByUserId: "u1",
      kind: "create" as const,
      status: "completed" as const,
      input: { request: `request ${i}` },
      createdAt: new Date(base + Math.floor(i / 3) * 1000),
    })),
  );
});

describe("listAnalyses", () => {
  it("pages through every analysis once, newest first", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const result = await listAnalyses(db, project.id, cursor);
      seen.push(...result.analyses.map((a) => a.id));
      if (!result.olderThan) break;
      cursor = result.olderThan;
    }

    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
  });

  it("returns 50 per page and no cursor on the last page", async () => {
    const first = await listAnalyses(db, project.id);
    expect(first.analyses).toHaveLength(50);
    expect(first.olderThan).not.toBeNull();
    expect(await listAnalyses(db, other.id)).toEqual({ analyses: [], olderThan: null });
  });
});
