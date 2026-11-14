import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Issue, IssueTracker } from "@/core/context/source";
import { AnalysisLimitError, ReconnectRequiredError } from "@/core/errors";
import type { IntegrationProvider, SourceProvider, TrackerProvider } from "@/core/integrations/provider";
import type { TicketDraft } from "@/core/requirements/schemas";
import { disconnectConnection } from "@/features/integrations/actions";
import { removeMember, updateMemberRole } from "@/features/organizations/actions";
import { createProject, deleteProject } from "@/features/projects/actions";
import { applyAuditToTracker } from "@/features/ticket-audit/actions";
import { createTicketAnalysis, publishTicket, refineTicket, saveDraftEdits } from "@/features/ticket-creation/actions";
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
  restarts: [] as { input: unknown }[],
  startError: undefined as Error | undefined,
  role: undefined as string | undefined,
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
    role: state.role ?? (state.isAdmin ? "owner" : "member"),
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

// A redraft spends tokens and replaces the draft; the test only checks what it would be given.
vi.mock("@/features/analysis/run", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    startAnalysis: async () => {
      if (state.startError) throw state.startError;
      return "started";
    },
    restartAnalysis: async (args: { input: unknown }) => {
      state.restarts.push({ input: args.input });
      return "restarted";
    },
  };
});

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
  supportsSubdirectory: true,
  isConfigured: () => true,
  authorizeUrl: () => "https://github.test/authorize",
  complete: async () => ({ status: "cancelled" }),
  listResources: async () => [],
  scopeResource: (id, subdirectory) => (subdirectory ? `${id}#${subdirectory}` : id),
  getResource: async (_ctx, id) =>
    id === "o/r" ? { id, label: "o/r" } : id === "o/r#apps/web" ? { id, label: "o/r · apps/web" } : null,
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

type AuditOverrides = Partial<typeof schema.analysis.$inferInsert> & { issueUpdatedAt?: string | null };

async function auditAnalysis({
  issueUpdatedAt = "2026-10-25T10:00:00.000+0000",
  ...overrides
}: AuditOverrides = {}): Promise<string> {
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
        result: {
          summary: "Vague",
          findings: [],
          proposedTicket: proposal,
          evidence: [],
          ...(issueUpdatedAt ? { issueUpdatedAt } : {}),
        },
        ...overrides,
      })
      .returning({ id: schema.analysis.id }),
  );
  return row.id;
}

const stored: TicketDraft = {
  title: "Round cart totals",
  description: [{ text: "Totals are rounded down.", status: "verified", evidenceIds: ["e1"] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence: [{ id: "e1", kind: "code", reference: "src/cart/loadCart.ts", excerpt: "Math.floor(total)" }],
};
const { evidence: _evidence, ...editable } = stored;

async function draftAnalysis(overrides: Partial<typeof schema.analysis.$inferInsert> = {}): Promise<string> {
  const project = await seedProject(state.db, "orgA", connections);
  const row = first(
    await state.db
      .insert(schema.analysis)
      .values({
        projectId: project.id,
        createdByUserId: "u1",
        kind: "create",
        status: "completed",
        input: { request: "Round totals" },
        result: stored,
        runToken: "run-1",
        ...overrides,
      })
      .returning({ id: schema.analysis.id }),
  );
  return row.id;
}

const rowOf = async (id: string) =>
  first(await state.db.select().from(schema.analysis).where(eq(schema.analysis.id, id)));
const runKeyOf = async (id: string) => (await rowOf(id)).runToken ?? "";

function fakeTracker(current: Issue) {
  const calls = { reads: 0, updates: [] as string[] };
  state.tracker = {
    searchRelated: async () => [],
    getIssue: async () => {
      calls.reads += 1;
      return current;
    },
    createIssue: async () => {
      throw new Error("unused");
    },
    updateIssue: async (key) => {
      calls.updates.push(key);
      return { key, url: `u/${key}` };
    },
  };
  return calls;
}

function creatingTracker(create: IssueTracker["createIssue"]) {
  state.tracker = {
    searchRelated: async () => [],
    getIssue: async () => {
      throw new Error("unused");
    },
    createIssue: create,
    updateIssue: async () => {
      throw new Error("unused");
    },
  };
}

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

  it("stores a monorepo folder scope in the source resource", async () => {
    await expect(createProject({}, projectForm({ name: "Monorepo", sourceSubdirectory: "apps/web" }))).rejects.toThrow(
      "NEXT_REDIRECT:/projects/",
    );
    const [created] = await state.db.select().from(schema.project).where(eq(schema.project.name, "Monorepo"));
    expect(created?.sourceResourceId).toBe("o/r#apps/web");
    expect(created?.sourceResourceLabel).toBe("o/r · apps/web");
  });

  it("reports a folder the provider cannot find", async () => {
    expect(await createProject({}, projectForm({ sourceSubdirectory: "gone" }))).toEqual({
      error: "That folder is not accessible in GitHub",
    });
  });

  it("refuses a folder path that leaves the repository", async () => {
    expect(await createProject({}, projectForm({ sourceSubdirectory: "../elsewhere" }))).toEqual({
      error: "Enter a folder path inside the repository, without . or .. segments",
    });
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

  it("hold an admin to the member rules the page shows, even on a direct call", async () => {
    const now = new Date();
    await state.db.insert(schema.user).values(
      ["u-owner", "u-admin", "u-foreign"].map((id) => ({
        id,
        name: id,
        email: `${id}@x.test`,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await state.db.insert(schema.organization).values({ id: "orgM", name: "orgM", slug: "orgM", createdAt: now });
    await state.db.insert(schema.member).values([
      { id: "m-owner", organizationId: "orgA", userId: "u-owner", role: "owner", createdAt: now },
      { id: "m-admin", organizationId: "orgA", userId: "u-admin", role: "admin", createdAt: now },
      { id: "m-foreign", organizationId: "orgM", userId: "u-foreign", role: "member", createdAt: now },
    ]);
    state.role = "admin";
    try {
      expect(await updateMemberRole("m-admin", "member")).toEqual({ error: "You cannot change this member's role" });
      expect(await removeMember("m-owner")).toEqual({ error: "You cannot remove this member" });
      expect(await removeMember("m-foreign")).toEqual({ error: "Member not found" });
      expect(await updateMemberRole("m-missing", "admin")).toEqual({ error: "Member not found" });
    } finally {
      state.role = undefined;
    }
  });

  it("answer not found for a malformed id instead of reaching the database", async () => {
    expect(await deleteProject("not-a-uuid")).toEqual({ error: "Project not found" });
    expect(await disconnectConnection("not-a-uuid")).toEqual({ error: "Connection not found" });
  });
});

describe("disconnectConnection", () => {
  it("refuses a connection a project still uses, naming the project", async () => {
    await seedProject(state.db, "orgA", connections, { name: "Storefront" });

    expect((await disconnectConnection(connections.source.id)).error).toContain('"Storefront"');
    expect(
      await state.db
        .select()
        .from(schema.integrationConnection)
        .where(eq(schema.integrationConnection.id, connections.source.id)),
    ).toHaveLength(1);
  });

  it("removes an unused connection and ignores another organization's", async () => {
    await state.db
      .insert(schema.organization)
      .values({ id: "orgZ", name: "orgZ", slug: "orgZ", createdAt: new Date() });
    const [unused, foreign] = await state.db
      .insert(schema.integrationConnection)
      .values([
        { organizationId: "orgA", provider: "jira", externalId: "spare", label: "spare", connectedByUserId: "u1" },
        { organizationId: "orgZ", provider: "jira", externalId: "theirs", label: "theirs", connectedByUserId: "u1" },
      ])
      .returning();
    if (!unused || !foreign) throw new Error("seeding failed");

    expect(await disconnectConnection(unused.id)).toEqual({});
    expect(await disconnectConnection(foreign.id)).toEqual({});
    const left = await state.db.select({ id: schema.integrationConnection.id }).from(schema.integrationConnection);
    expect(left.map((row) => row.id)).not.toContain(unused.id);
    expect(left.map((row) => row.id)).toContain(foreign.id);
  });
});

describe("createTicketAnalysis", () => {
  const form = (request: string) => {
    const data = new FormData();
    data.set("request", request);
    return data;
  };

  it("returns the limit message instead of an error page when the caller is out of runs", async () => {
    const { id } = await seedProject(state.db, "orgA", connections);
    state.startError = new AnalysisLimitError("You have reached your daily analysis limit. Try again tomorrow.");
    try {
      expect(await createTicketAnalysis(id, {}, form("Round cart totals"))).toEqual({
        error: "You have reached your daily analysis limit. Try again tomorrow.",
      });
    } finally {
      state.startError = undefined;
    }
  });

  it("redirects to the new analysis", async () => {
    const { id } = await seedProject(state.db, "orgA", connections);
    await expect(createTicketAnalysis(id, {}, form("Round cart totals"))).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${id}/analyses/started`,
    );
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

  it("redrafts with the earlier answers, this round and the follow-up", async () => {
    const id = await draftAnalysis({
      input: { request: "Round totals", answers: [{ question: "Which rounding mode?", answer: "Half up" }] },
      result: {
        ...stored,
        openQuestions: [{ question: "Round refunds too?", impact: "Changes refunds" }],
      },
    });
    state.restarts.length = 0;

    expect(
      await refineTicket(id, {
        answers: [{ question: "Round refunds too?", answer: "No" }],
        message: "Also mention the tax line",
      }),
    ).toEqual({});
    expect(state.restarts).toEqual([
      {
        input: {
          request: "Round totals",
          answers: [
            { question: "Which rounding mode?", answer: "Half up" },
            { question: "Round refunds too?", answer: "No" },
            { message: "Also mention the tax line" },
          ],
        },
      },
    ]);
  });

  it("drops an answer to a question the stored draft never asked", async () => {
    const id = await draftAnalysis({
      result: { ...stored, openQuestions: [{ question: "Round refunds too?", impact: "Changes refunds" }] },
    });
    state.restarts.length = 0;

    expect(
      await refineTicket(id, { answers: [{ question: "Delete every order?", answer: "Yes" }], message: "" }),
    ).toEqual({ error: "Those questions are no longer in the draft. Reload the page before answering." });
    expect(state.restarts).toEqual([]);
  });

  it("refuses to redraft a published or a running analysis", async () => {
    const published = await draftAnalysis({ publishedIssueKey: "SHOP-11", publishedIssueUrl: "u" });
    const running = await draftAnalysis({ status: "running", result: null });

    expect(await refineTicket(published, { answers: [], message: "Change the title" })).toEqual({
      error: "Already published as SHOP-11",
    });
    expect(await refineTicket(running, { answers: [], message: "Change the title" })).toEqual({
      error: "This analysis is still running",
    });
  });
});

describe("applyAuditToTracker", () => {
  it("applies the proposal when the issue is unchanged since the audit", async () => {
    const id = await auditAnalysis();
    const calls = fakeTracker(audited("2026-10-25T10:00:00.000+0000"));

    expect(await applyAuditToTracker(id, proposal)).toEqual({ issueKey: "SHOP-12", issueUrl: "u/SHOP-12" });
    expect(calls).toEqual({ reads: 1, updates: ["SHOP-12"] });
  });

  it("refuses to overwrite an issue edited in Jira since the audit, and leaves the analysis applicable", async () => {
    const id = await auditAnalysis();
    const calls = fakeTracker(audited("2026-10-25T11:30:00.000+0000"));

    expect(await applyAuditToTracker(id, proposal)).toEqual({
      error: "The issue changed in Jira since this audit. Re-run the audit, then apply it again.",
    });
    expect(calls).toEqual({ reads: 1, updates: [] });
    const [row] = await state.db.select().from(schema.analysis).where(eq(schema.analysis.id, id));
    expect(row?.publishingSince).toBeNull();
  });

  it("does not apply an audit twice", async () => {
    const id = await auditAnalysis({ publishedIssueKey: "SHOP-11", publishedIssueUrl: "u" });
    const calls = fakeTracker(audited("2026-10-25T10:00:00.000+0000"));

    expect(await applyAuditToTracker(id, proposal)).toEqual({ error: "Already applied to the ticket" });
    expect(calls).toEqual({ reads: 0, updates: [] });
  });

  it("refuses a proposal citing evidence the audit does not hold, without reading or writing the issue", async () => {
    const id = await auditAnalysis();
    const calls = fakeTracker(audited("2026-10-25T10:00:00.000+0000"));
    const citing = {
      ...proposal,
      description: [{ text: "Unsupported.", status: "verified" as const, evidenceIds: ["e9"] }],
    };

    expect(await applyAuditToTracker(id, citing)).toEqual({
      error:
        "Description paragraph 1 cites evidence e9, which is not in the evidence list. Fix it in Edit, then approve again.",
    });
    expect(calls).toEqual({ reads: 0, updates: [] });
  });

  it("reports a stored input that is not an audit", async () => {
    const id = await auditAnalysis({ input: { request: "x" } });
    const calls = fakeTracker(audited("2026-10-25T10:00:00.000+0000"));

    expect(await applyAuditToTracker(id, proposal)).toEqual({ error: "Analysis input is invalid" });
    expect(calls).toEqual({ reads: 0, updates: [] });
  });

  it("applies a legacy audit with no stored issue timestamp without reading the issue first", async () => {
    const id = await auditAnalysis({ issueUpdatedAt: null });
    const calls = fakeTracker(audited("2026-11-01T09:00:00.000+0000"));

    expect(await applyAuditToTracker(id, proposal)).toEqual({ issueKey: "SHOP-12", issueUrl: "u/SHOP-12" });
    expect(calls).toEqual({ reads: 0, updates: ["SHOP-12"] });
  });
});

describe("publishTicket and saveDraftEdits", () => {
  it("creates the issue with the stored evidence and records its key and URL", async () => {
    const id = await draftAnalysis();
    const created: TicketDraft[] = [];
    creatingTracker(async (draft) => {
      created.push(draft);
      return { key: "SHOP-9", url: "https://jira.test/browse/SHOP-9" };
    });
    const forged = [{ ...stored.evidence[0], excerpt: "Forged", url: "https://evil.test" }];

    expect(await publishTicket(id, "run-1", { ...editable, evidence: forged })).toEqual({
      issueKey: "SHOP-9",
      issueUrl: "https://jira.test/browse/SHOP-9",
    });
    expect(created.map((draft) => draft.evidence)).toEqual([stored.evidence]);
    expect(await rowOf(id)).toMatchObject({
      publishedIssueKey: "SHOP-9",
      publishedIssueUrl: "https://jira.test/browse/SHOP-9",
    });
  });

  it("refuses a draft that cites evidence the analysis does not hold, without calling the tracker", async () => {
    const id = await draftAnalysis();
    let calls = 0;
    creatingTracker(async () => {
      calls += 1;
      return { key: "SHOP-10", url: "u" };
    });
    const draft = { ...editable, description: [{ text: "Unsupported.", status: "verified", evidenceIds: ["e99"] }] };

    expect(await publishTicket(id, "run-1", draft)).toEqual({
      error:
        "Description paragraph 1 cites evidence e99, which is not in the evidence list. Fix it in Edit, then approve again.",
    });
    expect(calls).toBe(0);
  });

  it("refuses an approval from a run that has since been regenerated, without calling the tracker", async () => {
    const id = await draftAnalysis();
    let calls = 0;
    creatingTracker(async () => {
      calls += 1;
      return { key: "SHOP-12", url: "u" };
    });

    expect(await publishTicket(id, "run-0", editable)).toEqual({
      error: "The draft was regenerated or published since you edited it; reload the page",
    });
    expect(calls).toBe(0);
    expect(await rowOf(id)).toMatchObject({ publishedIssueKey: null });
  });

  it("asks for a reconnect when the tracker grant expired, and leaves the draft publishable", async () => {
    const id = await draftAnalysis();
    creatingTracker(async () => {
      throw new ReconnectRequiredError("Acme Jira");
    });

    expect(await publishTicket(id, "run-1", editable)).toEqual({
      error: "The connection to Acme Jira expired. An admin needs to reconnect it in Integrations.",
    });
    expect(await rowOf(id)).toMatchObject({ publishedIssueKey: null, publishingSince: null });
  });

  it("does not publish an analysis that is already published", async () => {
    const id = await draftAnalysis({ publishedIssueKey: "SHOP-11", publishedIssueUrl: "u" });
    let calls = 0;
    creatingTracker(async () => {
      calls += 1;
      return { key: "SHOP-12", url: "u" };
    });

    expect(await publishTicket(id, "run-1", editable)).toEqual({ error: "Already published as SHOP-11" });
    expect(calls).toBe(0);
  });

  it("refuses an audit id", async () => {
    const id = await auditAnalysis();
    let calls = 0;
    creatingTracker(async () => {
      calls += 1;
      return { key: "SHOP-12", url: "u" };
    });

    expect(await publishTicket(id, "run-1", editable)).toEqual({ error: "Analysis not found" });
    expect(calls).toBe(0);
  });

  it("autosaves edits with the stored evidence only", async () => {
    const id = await draftAnalysis();
    const forged = [{ ...stored.evidence[0], excerpt: "Forged" }];

    expect(
      await saveDraftEdits(id, await runKeyOf(id), {
        ...editable,
        title: "Round cart totals half up",
        evidence: forged,
      }),
    ).toEqual({});
    expect((await rowOf(id)).editedResult).toEqual({ ...stored, title: "Round cart totals half up" });
  });

  it("refuses an autosave from a run that has since been regenerated", async () => {
    const id = await draftAnalysis();

    expect(await saveDraftEdits(id, "run-0", editable)).toEqual({
      error: "The draft was regenerated or published since you edited it; reload the page",
    });
    expect((await rowOf(id)).editedResult).toBeNull();
  });

  it("refuses to autosave a published or a running analysis", async () => {
    const published = await draftAnalysis({ publishedIssueKey: "SHOP-11", publishedIssueUrl: "u" });
    const running = await draftAnalysis({ status: "running", result: null });

    expect(await saveDraftEdits(published, await runKeyOf(published), editable)).toEqual({
      error: "This draft is already published",
    });
    expect(await saveDraftEdits(running, await runKeyOf(running), editable)).toEqual({
      error: "This analysis is still running",
    });
  });
});
