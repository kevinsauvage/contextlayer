import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Issue, IssueTracker } from "@/core/context/source";
import type { IntegrationProvider, SourceProvider, TrackerProvider } from "@/core/integrations/provider";
import { removeMember } from "@/features/organizations/actions";
import { createProject, deleteProject } from "@/features/projects/actions";
import { applyAuditToTracker } from "@/features/ticket-audit/actions";
import { refineTicket } from "@/features/ticket-creation/actions";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { first } from "@/lib/first";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

const state = vi.hoisted(() => ({
  db: undefined as unknown as Database,
  redirects: [] as string[],
  providers: [] as IntegrationProvider[],
  isAdmin: true,
  tracker: undefined as unknown as IssueTracker,
}));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    state.redirects.push(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
  },
}));

vi.mock("@/infrastructure/auth/session", async () => {
  const { ForbiddenError } = await import("@/core/errors");
  const context = () => ({
    userId: "u1",
    organizationId: "orgA",
    role: state.isAdmin ? "owner" : "member",
    isAdmin: state.isAdmin,
    user: { name: "U", email: "u@x.test" },
  });
  return {
    requireOrgContext: async () => context(),
    requireOrgAdmin: async () => {
      const found = context();
      if (!found.isAdmin) throw new ForbiddenError();
      return found;
    },
  };
});

vi.mock("@/infrastructure/db/client", () => ({ getDb: () => state.db }));

vi.mock("@/integrations/registry", () => ({
  findProvider: (id: string) => state.providers.find((provider) => provider.id === id),
}));

const sourceProvider: SourceProvider = {
  id: "github",
  name: "GitHub",
  kind: "source",
  description: "Source",
  accountNoun: "account",
  resourceNoun: "repository",
  canAddAccount: true,
  exclusive: true,
  isConfigured: () => true,
  authorizeUrl: () => "https://github.test/authorize",
  complete: async () => ({ status: "cancelled" }),
  listResources: async () => [],
  getResource: async (_ctx, id) => (id === "o/r" ? { id, label: "o/r" } : null),
  openSource: async () => {
    throw new Error("unused");
  },
};

const trackerProvider: TrackerProvider = {
  id: "jira",
  name: "Jira Cloud",
  kind: "tracker",
  description: "Tracker",
  accountNoun: "site",
  resourceNoun: "project",
  canAddAccount: false,
  exclusive: false,
  isConfigured: () => true,
  authorizeUrl: () => "https://jira.test/authorize",
  complete: async () => ({ status: "cancelled" }),
  listResources: async () => [],
  getResource: async (_ctx, id) => (id === "SHOP" ? { id, label: "SHOP · Shop" } : null),
  openTracker: () => state.tracker,
  parseIssueKey: () => null,
  issueKeyExample: () => "SHOP-1",
};

let sourceConnectionId: string;
let trackerConnectionId: string;
let connections: Awaited<ReturnType<typeof seedConnections>>;

beforeAll(async () => {
  state.db = await migratedDb();
  await seedOrgs(state.db, ["orgA"]);
  connections = await seedConnections(state.db, "orgA");
  sourceConnectionId = connections.source.id;
  trackerConnectionId = connections.tracker.id;
  state.providers.push(sourceProvider, trackerProvider);
});

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

const projectForm = (overrides: Record<string, string> = {}) =>
  form({
    name: "Shop",
    sourceConnectionId,
    sourceResourceId: "o/r",
    trackerConnectionId,
    trackerResourceId: "SHOP",
    ...overrides,
  });

describe("createProject", () => {
  it("returns the first validation message", async () => {
    expect(await createProject({}, projectForm({ name: "A" }))).toEqual({
      error: "Enter a project name of at least 2 characters",
    });
  });

  it("reports a missing source connection", async () => {
    expect(await createProject({}, projectForm({ sourceConnectionId: randomUUID() }))).toEqual({
      error: "The code source connection no longer exists",
    });
  });

  it("reports a repository the provider cannot see", async () => {
    expect(await createProject({}, projectForm({ sourceResourceId: "gone/r" }))).toEqual({
      error: "That repository is not accessible to GitHub",
    });
  });

  it("reports a deleted Jira project", async () => {
    expect(await createProject({}, projectForm({ trackerResourceId: "GONE" }))).toEqual({
      error: "That project was not found in Jira Cloud",
    });
  });

  it("creates the project and redirects to it", async () => {
    await expect(createProject({}, projectForm())).rejects.toThrow("NEXT_REDIRECT:/projects/");
    const [created] = await state.db.select().from(schema.project).where(eq(schema.project.name, "Shop"));
    expect(created?.sourceResourceLabel).toBe("o/r");
    expect(created?.trackerResourceLabel).toBe("SHOP · Shop");
    expect(state.redirects.at(-1)).toBe(`/projects/${created?.id}`);
  });
});

describe("admin actions", () => {
  it("return a message when the caller is no longer an admin", async () => {
    state.isAdmin = false;
    try {
      expect(await removeMember("member-1")).toEqual({ error: "Only organization owners and admins can do this" });
      expect(await deleteProject(randomUUID())).toEqual({
        error: "Only organization owners and admins can do this",
      });
    } finally {
      state.isAdmin = true;
    }
  });
});

describe("refineTicket", () => {
  it("returns the validation message for a turn that is too long", async () => {
    expect(await refineTicket(randomUUID(), { answers: [], message: "x".repeat(4001) })).toEqual({
      error: "Keep the message under 4,000 characters",
    });
  });

  it("asks for something to send when no answer and no message", async () => {
    expect(await refineTicket(randomUUID(), { answers: [], message: "" })).toEqual({
      error: "Answer a question or describe what to change",
    });
  });

  it("reports an analysis that does not exist in the organization", async () => {
    expect(await refineTicket(randomUUID(), { answers: [], message: "Change the title" })).toEqual({
      error: "Analysis not found",
    });
  });
});

describe("applyAuditToTracker", () => {
  const proposal = {
    title: "Round cart totals half up",
    description: [{ text: "Totals round down today.", status: "inferred" as const, evidenceIds: [] }],
    acceptanceCriteria: [],
    assumptions: [],
    openQuestions: [],
  };
  const audited = (updated: string): Issue => ({
    key: "SHOP-12",
    summary: "Cart total",
    description: "Rounds oddly",
    status: "To Do",
    url: "u",
    updated,
  });

  async function auditAnalysis(issueUpdatedAt: string): Promise<string> {
    const project = await seedProject(state.db, "orgA", connections);
    const row = first(
      await state.db
        .insert(schema.analysis)
        .values({
          projectId: project.id,
          createdByUserId: "u1",
          kind: "audit",
          status: "completed",
          input: { issueKey: "SHOP-12" },
          result: { summary: "Vague", findings: [], proposedTicket: proposal, evidence: [], issueUpdatedAt },
        })
        .returning({ id: schema.analysis.id }),
    );
    return row.id;
  }

  function fakeTracker(current: Issue) {
    const updates: string[] = [];
    state.tracker = {
      searchRelated: async () => [],
      getIssue: async () => current,
      createIssue: async () => {
        throw new Error("unused");
      },
      updateIssue: async (key) => {
        updates.push(key);
        return { key, url: `u/${key}` };
      },
    };
    return updates;
  }

  it("applies the proposal when the issue is unchanged since the audit", async () => {
    const id = await auditAnalysis("2026-10-25T10:00:00.000+0000");
    const updates = fakeTracker(audited("2026-10-25T10:00:00.000+0000"));

    expect(await applyAuditToTracker(id, proposal)).toEqual({ issueKey: "SHOP-12", issueUrl: "u/SHOP-12" });
    expect(updates).toEqual(["SHOP-12"]);
  });

  it("refuses to overwrite an issue edited in Jira since the audit, and leaves the analysis applicable", async () => {
    const id = await auditAnalysis("2026-10-25T10:00:00.000+0000");
    const updates = fakeTracker(audited("2026-10-25T11:30:00.000+0000"));

    expect(await applyAuditToTracker(id, proposal)).toEqual({
      error: "The issue changed in Jira since this audit. Re-run the audit, then apply it again.",
    });
    expect(updates).toEqual([]);
    const [row] = await state.db.select().from(schema.analysis).where(eq(schema.analysis.id, id));
    expect(row?.publishingSince).toBeNull();
  });
});
