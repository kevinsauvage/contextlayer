import { beforeAll, describe, expect, it } from "vitest";
import type { CompleteResult, IntegrationProvider, SourceProvider } from "@/core/integrations/provider";
import { saveAccounts } from "@/features/integrations/connections";
import { finishConnect } from "@/features/integrations/oauth-flow";
import type { OrgContext } from "@/infrastructure/auth/session";
import type { Database } from "@/infrastructure/db/client";
import { signState } from "@/infrastructure/signed-state";
import { migratedDb, seedOrgs } from "../helpers/db";

let db: Database;

beforeAll(async () => {
  db = await migratedDb();
  await seedOrgs(db, ["orgA", "orgB"]);
});

const context = (isAdmin = true): OrgContext => ({
  userId: "u1",
  organizationId: "orgA",
  role: isAdmin ? "owner" : "member",
  isAdmin,
  user: { name: "U", email: "u@x.test" },
});

// A GitHub-shaped provider: its install callback is where a revoked installation surfaces.
const provider = (complete: () => Promise<CompleteResult>): SourceProvider => ({
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
  complete: async () => complete(),
  listResources: async () => [],
  openSource: async () => {
    throw new Error("unused");
  },
});

const connected = (externalId: string): CompleteResult => ({
  status: "connected",
  accounts: [{ externalId, label: `account-${externalId}`, metadata: {}, tokens: null }],
});

const state = (overrides: { provider?: string; userId?: string } = {}) =>
  signState({
    userId: overrides.userId ?? "u1",
    organizationId: "orgA",
    provider: overrides.provider ?? "github",
    returnTo: "/settings/integrations",
  });

const query = (signedState: string | null) =>
  new URLSearchParams(signedState ? { state: signedState, code: "code-1" } : { code: "code-1" });

const resultOf = (url: string) => new URL(url).searchParams.get("result");

describe("finishing a connection", () => {
  it("rejects a missing or foreign state", async () => {
    const p = provider(async () => connected("1"));

    expect(resultOf(await finishConnect(db, p, context(), query(null)))).toBe("invalid");
    expect(resultOf(await finishConnect(db, p, context(), query(state({ userId: "someone-else" }))))).toBe("invalid");
    expect(resultOf(await finishConnect(db, p, context(), query(state({ provider: "jira" }))))).toBe("invalid");
  });

  it("refuses a callback from someone who is not an admin", async () => {
    const p = provider(async () => connected("1"));
    expect(resultOf(await finishConnect(db, p, context(false), query(state())))).toBe("not_admin");
  });

  it("reports a failed provider call instead of throwing", async () => {
    const revoked = provider(async () => {
      throw new Error("installation suspended");
    });
    expect(resultOf(await finishConnect(db, revoked, context(), query(state())))).toBe("failed");
  });

  it("passes a cancelled or redirecting provider result through", async () => {
    const cancelled = provider(async () => ({ status: "cancelled" }));
    expect(resultOf(await finishConnect(db, cancelled, context(), query(state())))).toBe("cancelled");

    const redirect = provider(async () => ({ status: "redirect", url: "https://github.test/installations/new" }));
    expect(await finishConnect(db, redirect, context(), query(state()))).toBe("https://github.test/installations/new");
  });

  it("saves healthy accounts", async () => {
    const p = provider(async () => connected("1"));
    expect(resultOf(await finishConnect(db, p, context(), query(state())))).toBe("connected");
  });

  it("reports an installation another organization already linked", async () => {
    const other = { ...provider(async () => connected("2")), exclusive: true } as IntegrationProvider;
    await saveAccounts(db, {
      organizationId: "orgB",
      userId: "u1",
      provider: other,
      accounts: [{ externalId: "2", label: "account-2", metadata: {}, tokens: null }],
    });

    expect(resultOf(await finishConnect(db, other, context(), query(state())))).toBe("taken");
  });
});
