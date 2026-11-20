import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { IntegrationProvider, SourceProvider, TrackerProvider } from "@/core/integrations/provider";
import { TrackerRejectedError } from "@/core/errors";
import type { Database } from "@/infrastructure/db/client";
import { integrationConnection } from "@/infrastructure/db/schema";
import { migratedDb, seedConnections, seedOrgs, seedProject } from "../helpers/db";

const state = vi.hoisted(() => ({ providers: [] as IntegrationProvider[] }));

vi.mock("@/integrations/registry", () => ({
  listProviders: (kind?: string) =>
    kind ? state.providers.filter((provider) => provider.kind === kind) : state.providers,
  findProvider: (id: string) => state.providers.find((provider) => provider.id === id),
}));

const { integrationsOverview, ofKind, providerNames } = await import("@/features/integrations/overview");
const { resourceListsFor } = await import("@/features/integrations/resources");
const { projectIntegrations } = await import("@/features/projects/view");

const source: SourceProvider = {
  id: "github",
  name: "GitHub",
  kind: "source",
  description: "Code",
  accountNoun: "account",
  resourceNoun: "repository",
  resourceNounPlural: "repositories",
  canAddAccount: true,
  exclusive: true,
  supportsSubdirectory: true,
  isConfigured: () => true,
  authorizeUrl: () => "u",
  complete: async () => ({ status: "cancelled" }),
  listResources: async () => [{ id: "acme/web", label: "acme/web" }],
  openSource: async () => {
    throw new Error("unused");
  },
  scopeResource: (id) => id,
};

const tracker: TrackerProvider = {
  id: "jira",
  name: "Jira Cloud",
  kind: "tracker",
  description: "Tickets",
  accountNoun: "site",
  resourceNoun: "project",
  resourceNounPlural: "projects",
  canAddAccount: false,
  exclusive: false,
  isConfigured: () => false,
  authorizeUrl: () => "u",
  complete: async () => ({ status: "cancelled" }),
  listResources: async () => [{ id: "SHOP", label: "SHOP · Shop" }],
  openTracker: () => {
    throw new Error("unused");
  },
  parseIssueKey: () => null,
  issueKeyExample: (id) => `${id}-123`,
};

let db: Database;
let connections: Awaited<ReturnType<typeof seedConnections>>;

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA", "orgB"]);
  connections = await seedConnections(db, "orgA");
  state.providers.push(source, tracker);
});

describe("integrationsOverview", () => {
  it("describes every provider with its configuration and this organization's connections only", async () => {
    await seedProject(db, "orgA", connections, { name: "Storefront" });
    const overview = await integrationsOverview(db, "orgA");

    expect(overview.map((provider) => provider.id)).toEqual(["github", "jira"]);
    expect(overview[0]).toMatchObject({ name: "GitHub", configured: true, resourceNoun: "repository" });
    expect(overview[0]?.connections).toHaveLength(1);
    expect(overview[0]?.connections[0]).toMatchObject({ provider: "github", projectCount: 1 });
    expect(overview[1]).toMatchObject({ configured: false });
    expect(overview[1]?.connections[0]).toMatchObject({ provider: "jira" });

    await expect(integrationsOverview(db, "orgB")).resolves.toEqual([
      expect.objectContaining({ id: "github", connections: [] }),
      expect.objectContaining({ id: "jira", connections: [] }),
    ]);
  });

  it("splits providers by kind and indexes their names", async () => {
    const overview = await integrationsOverview(db, "orgA");

    expect(ofKind(overview, "source").map((provider) => provider.id)).toEqual(["github"]);
    expect(ofKind(overview, "tracker").map((provider) => provider.id)).toEqual(["jira"]);
    expect(providerNames(overview)).toEqual({ github: "GitHub", jira: "Jira Cloud" });
  });
});

describe("resourceListsFor", () => {
  it("loads each connection's resources, keeping recoverable failures as values", async () => {
    const throwing: TrackerProvider = {
      ...tracker,
      id: "throwing",
      name: "Broken tracker",
      resourceNoun: "project",
      resourceNounPlural: "projects",
      listResources: async () => {
        throw new Error("network down");
      },
    };
    const refused: TrackerProvider = {
      ...tracker,
      id: "refused",
      listResources: async () => {
        throw new TrackerRejectedError("The grant was revoked");
      },
    };
    state.providers.push(throwing, refused);
    const rows = await db
      .insert(integrationConnection)
      .values([
        { organizationId: "orgA", provider: "throwing", externalId: "t", label: "broken", connectedByUserId: "u1" },
        { organizationId: "orgA", provider: "refused", externalId: "r", label: "refused", connectedByUserId: "u1" },
        { organizationId: "orgB", provider: "github", externalId: "other", label: "theirs", connectedByUserId: "u1" },
      ])
      .returning();
    const [broken, refusedRow, foreign] = rows;
    if (!broken || !refusedRow || !foreign) throw new Error("seeding failed");

    const lists = await resourceListsFor(db, "orgA", [
      connections.source.id,
      broken.id,
      refusedRow.id,
      foreign.id,
      "not-a-uuid",
    ]);

    expect(lists[connections.source.id]).toEqual({ resources: [{ id: "acme/web", label: "acme/web" }] });
    expect(lists[broken.id]).toEqual({
      error:
        "Could not load the project list from Broken tracker. Reload the page; if it keeps failing, reconnect Broken tracker in Integrations.",
    });
    expect(lists[refusedRow.id]).toEqual({ error: "The grant was revoked" });
    expect(lists[foreign.id]).toEqual({
      error: "That connection no longer exists. Reload the page.",
    });
    expect(lists["not-a-uuid"]).toEqual({ error: "That connection no longer exists. Reload the page." });

    state.providers.splice(state.providers.indexOf(throwing), 1);
    state.providers.splice(state.providers.indexOf(refused), 1);
  });
});

describe("projectIntegrations", () => {
  it("names both integrations and builds the tracker's issue key example", async () => {
    const project = await seedProject(db, "orgA", connections, { name: "Named", trackerResourceId: "SHOP" });

    await expect(projectIntegrations(db, project)).resolves.toEqual({
      sourceName: "GitHub",
      trackerName: "Jira Cloud",
      issueKeyExample: "SHOP-123",
      needsReconnect: false,
    });
  });

  it("flags a connection that needs a new consent", async () => {
    const project = await seedProject(db, "orgA", connections, { name: "Reconnect" });
    await db
      .update(integrationConnection)
      .set({ status: "needs_reconnect" })
      .where(eq(integrationConnection.id, connections.tracker.id));

    await expect(projectIntegrations(db, project)).resolves.toMatchObject({ needsReconnect: true });
    await db
      .update(integrationConnection)
      .set({ status: "active" })
      .where(eq(integrationConnection.id, connections.tracker.id));
  });

  it("falls back to generic names and an empty example for a project whose providers are gone", async () => {
    const [row] = await db
      .insert(integrationConnection)
      .values([
        { organizationId: "orgA", provider: "gone-source", externalId: "s", label: "s", connectedByUserId: "u1" },
        { organizationId: "orgA", provider: "gone-tracker", externalId: "t", label: "t", connectedByUserId: "u1" },
      ])
      .returning();
    if (!row) throw new Error("seeding failed");
    const [trackerRow] = await db
      .select()
      .from(integrationConnection)
      .where(eq(integrationConnection.provider, "gone-tracker"));
    if (!trackerRow) throw new Error("seeding failed");
    const project = await seedProject(db, "orgA", { source: row, tracker: trackerRow }, { name: "Gone" });

    await expect(projectIntegrations(db, project)).resolves.toEqual({
      sourceName: "Code source",
      trackerName: "Issue tracker",
      issueKeyExample: "",
      needsReconnect: false,
    });
  });
});

describe("integration connection helpers", () => {
  it("counts the projects using each connection and lists them", async () => {
    const { listConnections, projectsUsingConnection } = await import("@/features/integrations/connections");
    await seedProject(db, "orgA", connections, { name: "One" });
    await seedProject(db, "orgA", connections, { name: "Two" });

    const list = await listConnections(db, "orgA");
    const sourceRow = list.find((row) => row.id === connections.source.id);
    expect(sourceRow?.projectCount).toBeGreaterThanOrEqual(2);

    const using = await projectsUsingConnection(db, "orgA", connections.source.id);
    expect(using.map((row) => row.name)).toEqual(expect.arrayContaining(["One", "Two"]));
    await expect(projectsUsingConnection(db, "orgA", "not-a-uuid")).resolves.toEqual([]);
    await expect(projectsUsingConnection(db, "orgB", connections.source.id)).resolves.toEqual([]);
  });
});

describe("getConnection", () => {
  it("refuses a malformed id and scopes the lookup to the organization", async () => {
    const { getConnection } = await import("@/features/integrations/connections");
    const [sourceRow] = await db
      .select()
      .from(integrationConnection)
      .where(eq(integrationConnection.id, connections.source.id));

    await expect(getConnection(db, "orgA", "not-a-uuid")).resolves.toBeNull();
    await expect(getConnection(db, "orgB", connections.source.id)).resolves.toBeNull();
    await expect(getConnection(db, "orgA", connections.source.id)).resolves.toEqual(sourceRow ?? null);
  });
});

describe("provider resolution", () => {
  it("reports which side of a project is disconnected", async () => {
    const { resolveSource, resolveTracker } = await import("@/features/integrations/resolve");
    const [sourceRow] = await db
      .select()
      .from(integrationConnection)
      .where(eq(integrationConnection.id, connections.source.id));

    await expect(resolveSource(db, "orgA", connections.source.id)).resolves.toMatchObject({
      connection: sourceRow,
      provider: { id: "github" },
    });
    await expect(resolveTracker(db, "orgA", connections.source.id)).rejects.toThrow(
      "This project's issue tracker is no longer connected",
    );
    await expect(resolveSource(db, "orgB", connections.source.id)).rejects.toThrow(
      "This project's code source is no longer connected",
    );
  });
});
