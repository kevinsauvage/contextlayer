import { eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { githubInstallation } from "@/infrastructure/db/schema";
import type { GithubAccount } from "@/integrations/github/app";

type ConnectInput = {
  organizationId: string;
  accounts: GithubAccount[];
  installationId?: number;
};

export type ConnectOutcome = "connected" | "taken" | "forbidden" | "needs_install";

async function link(db: Database, organizationId: string, account: GithubAccount): Promise<"linked" | "taken"> {
  const [existing] = await db
    .select({ organizationId: githubInstallation.organizationId })
    .from(githubInstallation)
    .where(eq(githubInstallation.id, account.installationId));
  if (existing) return existing.organizationId === organizationId ? "linked" : "taken";

  await db
    .insert(githubInstallation)
    .values({ id: account.installationId, organizationId, accountLogin: account.accountLogin })
    .onConflictDoNothing();
  return "linked";
}

// With an installationId (return from the install page) only that installation is linked; without one
// (the user clicked "Connect") every installation the user already has is linked.
export async function connectGithub(db: Database, input: ConnectInput): Promise<ConnectOutcome> {
  const wanted =
    input.installationId === undefined
      ? input.accounts
      : input.accounts.filter((account) => account.installationId === input.installationId);
  if (!wanted.length) return input.installationId === undefined ? "needs_install" : "forbidden";

  const results = [];
  for (const account of wanted) results.push(await link(db, input.organizationId, account));
  return results.includes("linked") ? "connected" : "taken";
}
