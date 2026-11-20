import { beforeAll, describe, expect, it, vi } from "vitest";
import { projectForRequest } from "@/features/projects/request";
import type { Database } from "@/infrastructure/db/client";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

const state = vi.hoisted(() => ({ db: undefined as unknown as Database }));
vi.mock("@/infrastructure/db/client", () => ({ getDb: () => state.db }));

let projectId: string;

beforeAll(async () => {
  state.db = await migratedDb();
  await seedOrgs(state.db, ["orgA", "orgB"]);
  const connections = await seedConnections(state.db, "orgA");
  const project = await seedProject(state.db, "orgA", connections, { name: "Storefront" });
  projectId = project.id;
});

describe("projectForRequest", () => {
  it("returns the project, its database and both integrations in one read", async () => {
    const loaded = await projectForRequest("orgA", projectId);

    expect(loaded?.db).toBe(state.db);
    expect(loaded?.project).toMatchObject({ id: projectId, name: "Storefront" });
    expect(loaded?.integrations).toMatchObject({
      sourceName: "GitHub",
      trackerName: "Jira Cloud",
      needsReconnect: false,
    });
  });

  it("answers null for another organization or a malformed id", async () => {
    await expect(projectForRequest("orgB", projectId)).resolves.toBeNull();
    await expect(projectForRequest("orgA", "not-a-uuid")).resolves.toBeNull();
  });
});
