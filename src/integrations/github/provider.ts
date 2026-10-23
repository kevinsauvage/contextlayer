import "server-only";
import type { CompleteResult, SourceProvider } from "@/core/integrations/provider";
import {
  getInstallationRepo,
  githubAccountsForUser,
  githubAuthorizeUrl,
  githubInstallUrl,
  isGithubConfigured,
  listInstallationRepos,
  type GithubAccount,
} from "./app";
import { GithubSource } from "./source";

// With an installation id (the return from GitHub's install page) only that installation is linked; without
// one (the user clicked "Connect") every installation the user can already access is linked.
export function selectGithubAccounts(
  accounts: GithubAccount[],
  installationId: number | undefined,
  installUrl: string,
): CompleteResult {
  const wanted =
    installationId === undefined ? accounts : accounts.filter((account) => account.installationId === installationId);
  if (!wanted.length)
    return installationId === undefined ? { status: "redirect", url: installUrl } : { status: "forbidden" };
  return {
    status: "connected",
    accounts: wanted.map((account) => ({
      externalId: String(account.installationId),
      label: account.accountLogin,
      metadata: {},
      tokens: null,
    })),
  };
}

const parseRepo = (resourceId: string) => {
  const [owner = "", name = ""] = resourceId.split("/");
  return { owner, name };
};

export const githubProvider: SourceProvider = {
  id: "github",
  name: "GitHub",
  kind: "source",
  description: "Read-only access to the repositories you choose, through the ContextLayer GitHub App.",
  accountNoun: "account",
  resourceNoun: "repository",
  canAddAccount: true,
  exclusive: true,

  isConfigured: isGithubConfigured,

  // GitHub does not call back for an app that is already installed, so "connect" signs the user in to find
  // their installations, and "add" goes straight to the install page.
  authorizeUrl: ({ state, redirectUri, add }) =>
    add ? githubInstallUrl(state) : githubAuthorizeUrl(state, redirectUri),

  async complete({ query, state }) {
    const code = query.get("code");
    if (!code) return { status: "cancelled" };
    const installationParam = query.get("installation_id");
    const installationId = installationParam === null ? undefined : Number(installationParam);
    if (installationId !== undefined && !Number.isInteger(installationId)) return { status: "forbidden" };
    return selectGithubAccounts(await githubAccountsForUser(code), installationId, githubInstallUrl(state));
  },

  async listResources(ctx) {
    const repos = await listInstallationRepos(Number(ctx.externalId));
    return repos
      .map((repo) => ({ id: `${repo.owner}/${repo.name}`, label: `${repo.owner}/${repo.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },

  async getResource(ctx, resourceId) {
    const { owner, name } = parseRepo(resourceId);
    if (!owner || !name) return null;
    const repo = await getInstallationRepo(Number(ctx.externalId), owner, name);
    return repo ? { id: `${repo.owner}/${repo.name}`, label: `${repo.owner}/${repo.name}` } : null;
  },

  openSource: (ctx, resourceId) => GithubSource.connect(Number(ctx.externalId), parseRepo(resourceId)),
};
