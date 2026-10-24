import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { IntegrationProvider, SourceProvider, TrackerProvider } from "@/core/integrations/provider";
import { createProject } from "@/features/projects/actions";
import { refineTicket } from "@/features/ticket-creation/actions";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { migratedDb, seedConnections, seedOrgs } from "../helpers/db";

const state = vi.hoisted(() => ({
  db: undefined as unknown as Database,
  redirects: [] as string[],
  providers: [] as IntegrationProvider[],
}));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    state.redirects.push(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/infrastructure/auth/session", () => {
  const context = {
    userId: "u1",
    organizationId: "orgA",
    role: "owner",
    isAdmin: true,
    user: { name: "U", email: "u@x.test" },
  };
  return { requireOrgContext: async () => context, requireOrgAdmin: async () => context };
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
  openTracker: () => {
    throw new Error("unused");
  },
  parseIssueKey: () => null,
  issueKeyExample: () => "SHOP-1",
};

let sourceConnectionId: string;
let trackerConnectionId: string;

beforeAll(async () => {
  state.db = await migratedDb();
  await seedOrgs(state.db, ["orgA"]);
  const connections = await seedConnections(state.db, "orgA");
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
