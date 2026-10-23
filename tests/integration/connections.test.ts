import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { InvalidGrantError, ReconnectRequiredError, type IntegrationProvider } from "@/core/integrations/provider";
import { connectionContext } from "@/features/integrations/access";
import {
  getConnection,
  listConnections,
  projectsUsingConnection,
  saveAccounts,
} from "@/features/integrations/connections";
import { decrypt } from "@/infrastructure/crypto";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { migratedDb, seedOrgs } from "../helpers/db";

let db: Database;

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA", "orgB", "orgC"]);
});

const github = { id: "github", name: "GitHub", exclusive: true } as IntegrationProvider;
const jira = { id: "jira", name: "Jira", exclusive: false } as IntegrationProvider;
const account = (externalId: string, tokens = false) => ({
  externalId,
  label: `account-${externalId}`,
  metadata: {},
  tokens: tokens ? { accessToken: "at-1", refreshToken: "rt-1", expiresAt: new Date(Date.now() - 1000) } : null,
});
const save = (organizationId: string, provider: IntegrationProvider, accounts: ReturnType<typeof account>[]) =>
  saveAccounts(db, { organizationId, userId: "u1", provider, accounts });
const connectionOf = async (organizationId: string, provider: string, externalId: string) => {
  const rows = await listConnections(db, organizationId);
  const row = rows.find((c) => c.provider === provider && c.label === `account-${externalId}`);
  if (!row) throw new Error("missing connection");
  const connection = await getConnection(db, organizationId, row.id);
  if (!connection) throw new Error("missing connection");
  return connection;
};

describe("saving connected accounts", () => {
  it("links accounts and is idempotent", async () => {
    expect(await save("orgA", github, [account("99"), account("100")])).toBe("connected");
    expect(await save("orgA", github, [account("99")])).toBe("connected");
    expect((await listConnections(db, "orgA")).filter((c) => c.provider === "github")).toHaveLength(2);
    expect((await connectionOf("orgA", "github", "99")).exclusiveKey).toBe("github:99");
  });

  it("refuses an exclusive account that belongs to another organization", async () => {
    expect(await save("orgB", github, [account("99")])).toBe("taken");
    expect(await listConnections(db, "orgB")).toEqual([]);
  });

  it("links the free accounts of a batch and skips the taken one", async () => {
    expect(await save("orgB", github, [account("300"), account("99")])).toBe("connected");
    const githubAccounts = (await listConnections(db, "orgB")).filter((c) => c.provider === "github");
    expect(githubAccounts.map((c) => c.label)).toEqual(["account-300"]);
  });

  it("keeps exclusive keys unique in the database", async () => {
    await expect(
      db.insert(schema.integrationConnection).values({
        organizationId: "orgC",
        provider: "github",
        externalId: "99",
        label: "duplicate",
        connectedByUserId: "u1",
        exclusiveKey: "github:99",
      }),
    ).rejects.toThrow();
  });

  it("lets several organizations share a non-exclusive account", async () => {
    expect(await save("orgA", jira, [account("site", true)])).toBe("connected");
    expect(await save("orgB", jira, [account("site", true)])).toBe("connected");
    expect((await connectionOf("orgA", "jira", "site")).exclusiveKey).toBeNull();
  });

  it("stores tokens encrypted", async () => {
    const connection = await connectionOf("orgA", "jira", "site");
    expect(connection.accessTokenEnc).not.toContain("at-1");
    expect(connection.accessTokenEnc && decrypt(connection.accessTokenEnc)).toBe("at-1");
  });
});

describe("access tokens", () => {
  it("refreshes once for the whole grant and serializes concurrent refreshes", async () => {
    await save("orgA", jira, [account("s1", true), account("s2", true)]);
    let calls = 0;
    const provider = {
      ...jira,
      refresh: async () => {
        calls += 1;
        return {
          accessToken: `at-${calls + 1}`,
          refreshToken: `rt-${calls + 1}`,
          expiresAt: new Date(Date.now() + 3_600_000),
        };
      },
    } as IntegrationProvider;
    const [s1, s2] = await Promise.all([connectionOf("orgA", "jira", "s1"), connectionOf("orgA", "jira", "s2")]);

    const tokens = await Promise.all([
      connectionContext(db, s1, provider).accessToken(),
      connectionContext(db, s2, provider).accessToken(),
    ]);

    expect(calls).toBe(1);
    expect(tokens).toEqual(["at-2", "at-2"]);
    const after = await connectionOf("orgA", "jira", "s2");
    expect(after.refreshTokenEnc && decrypt(after.refreshTokenEnc)).toBe("rt-2");
  });

  it("marks the grant for reconnection when the provider rejects the refresh token", async () => {
    await save("orgA", jira, [account("dead", true)]);
    const provider = {
      ...jira,
      refresh: async () => {
        throw new InvalidGrantError("revoked");
      },
    } as IntegrationProvider;
    const connection = await connectionOf("orgA", "jira", "dead");

    await expect(connectionContext(db, connection, provider).accessToken()).rejects.toBeInstanceOf(
      ReconnectRequiredError,
    );
    expect((await connectionOf("orgA", "jira", "dead")).status).toBe("needs_reconnect");

    expect(await save("orgA", jira, [account("dead", true)])).toBe("connected");
    expect((await connectionOf("orgA", "jira", "dead")).status).toBe("active");
  });
});

describe("disconnecting", () => {
  it("reports the projects that still use a connection", async () => {
    const source = await connectionOf("orgA", "github", "100");
    const tracker = await connectionOf("orgA", "jira", "site");
    await db.insert(schema.project).values({
      organizationId: "orgA",
      name: "Shop",
      sourceConnectionId: source.id,
      sourceResourceId: "a/b",
      sourceResourceLabel: "a/b",
      trackerConnectionId: tracker.id,
      trackerResourceId: "S",
      trackerResourceLabel: "S",
    });
    expect((await projectsUsingConnection(db, "orgA", tracker.id)).map((p) => p.name)).toEqual(["Shop"]);
    expect(await projectsUsingConnection(db, "orgB", tracker.id)).toEqual([]);
    await db.delete(schema.project).where(eq(schema.project.name, "Shop"));
  });
});
