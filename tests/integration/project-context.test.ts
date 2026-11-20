import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ContextSource, IssueTracker } from "@/core/context/source";
import type { Database } from "@/infrastructure/db/client";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

const state = vi.hoisted(() => ({
  sourceArgs: [] as unknown[],
  trackerArgs: [] as unknown[],
}));

const source: ContextSource = {
  revision: "abc",
  listFiles: async () => [],
  readFile: async () => "",
  searchContent: async () => ({ paths: [], failedTerms: [] }),
};

vi.mock("@/integrations/registry", () => ({
  findProvider: (id: string) =>
    id === "github"
      ? {
          id: "github",
          kind: "source",
          openSource: async (...args: unknown[]) => {
            state.sourceArgs.push(args);
            return source;
          },
        }
      : id === "jira"
        ? {
            id: "jira",
            kind: "tracker",
            openTracker: (...args: unknown[]) => {
              state.trackerArgs.push(args);
              return {} as IssueTracker;
            },
          }
        : undefined,
}));

const { buildProjectContext, buildProjectTracker } = await import("@/features/analysis/project-context");
const { resolveConnection, resolveSource, resolveTracker } = await import("@/features/integrations/resolve");

let database: Database;
let connections: Awaited<ReturnType<typeof seedConnections>>;

beforeAll(async () => {
  database = await migratedDb();
  await seedOrgs(database, ["orgA"]);
  connections = await seedConnections(database, "orgA");
});

async function fixture() {
  const project = await seedProject(database, "orgA", connections, { name: "P" });
  return { database, project, connections };
}

describe("buildProjectContext", () => {
  it("opens the project's source with the run's deadline and its tracker", async () => {
    const { database, project } = await fixture();
    const deadline = new AbortController().signal;

    const context = await buildProjectContext(database, project, deadline);

    expect(context.source).toBe(source);
    expect(state.sourceArgs.at(-1)).toEqual([expect.anything(), project.sourceResourceId, { deadline }]);
    expect(state.trackerArgs.at(-1)).toEqual([expect.anything(), project.trackerResourceId]);
  });

  it("opens without a deadline when the caller has none", async () => {
    const { database, project } = await fixture();
    await buildProjectContext(database, project);
    expect(state.sourceArgs.at(-1)).toEqual([expect.anything(), project.sourceResourceId, { deadline: undefined }]);
  });

  it("refuses a project whose source connection is missing", async () => {
    const { database, project } = await fixture();
    const orphan = { ...project, sourceConnectionId: crypto.randomUUID() };

    await expect(buildProjectContext(database, orphan)).rejects.toThrow(
      "This project's code source is no longer connected",
    );
  });
});

describe("buildProjectTracker", () => {
  it("opens only the tracker, without costing a source call", async () => {
    const { database, project } = await fixture();
    const before = state.sourceArgs.length;

    await buildProjectTracker(database, project);

    expect(state.sourceArgs).toHaveLength(before);
    expect(state.trackerArgs.at(-1)).toEqual([expect.anything(), project.trackerResourceId]);
  });
});

describe("resolveConnection", () => {
  it("returns the connection and provider for the right side", async () => {
    const { database, connections } = await fixture();

    await expect(resolveSource(database, "orgA", connections.source.id)).resolves.toMatchObject({
      provider: { id: "github" },
      connection: { id: connections.source.id },
    });
    await expect(resolveTracker(database, "orgA", connections.tracker.id)).resolves.toMatchObject({
      provider: { id: "jira" },
    });
  });

  it("answers null for an unknown id instead of throwing a cast error", async () => {
    const { database } = await fixture();
    await expect(resolveConnection(database, "orgA", "not-a-uuid")).resolves.toBeNull();
  });
});
