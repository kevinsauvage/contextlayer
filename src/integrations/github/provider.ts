import "server-only";
import { isSafeSubdirectory, type CompleteResult, type SourceProvider } from "@/core/integrations/provider";
import {
  getInstallationDirectory,
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

type ParsedRepo = { owner: string; name: string; subdirectory?: string };

// GitHub resource ids may narrow a repository to one folder with `owner/repo#apps/web`.
const SCOPE_SEPARATOR = "#";

const trimSlashes = (path: string) => path.replace(/^\/+|\/+$/g, "");

function splitScope(resourceId: string): { id: string; subdirectory?: string } {
  const at = resourceId.indexOf(SCOPE_SEPARATOR);
  return at === -1
    ? { id: resourceId }
    : { id: resourceId.slice(0, at), subdirectory: trimSlashes(resourceId.slice(at + 1)) };
}

// A malformed scope returns an empty owner so the provider refuses it instead of silently reading the whole
// repository.
function parseGithubResourceId(resourceId: string): ParsedRepo {
  const { id, subdirectory } = splitScope(resourceId);
  if (subdirectory !== undefined && !isSafeSubdirectory(subdirectory)) return { owner: "", name: "" };
  const [owner = "", name = ""] = id.split("/");
  return { owner, name, subdirectory };
}

function scopeResource(resourceId: string, subdirectory: string | undefined): string {
  const { id } = splitScope(resourceId);
  const path = trimSlashes((subdirectory ?? "").trim());
  return path && isSafeSubdirectory(path) ? `${id}${SCOPE_SEPARATOR}${path}` : id;
}

const labelOf = (owner: string, name: string, subdirectory?: string) =>
  subdirectory ? `${owner}/${name} · ${subdirectory}` : `${owner}/${name}`;

const repoId = (owner: string, name: string) => `${owner}/${name}`;

export const githubProvider: SourceProvider = {
  id: "github",
  name: "GitHub",
  kind: "source",
  description: "Read-only access to the repositories you choose, through the ContextLayer GitHub App.",
  accountNoun: "account",
  resourceNoun: "repository",
  canAddAccount: true,
  exclusive: true,
  supportsSubdirectory: true,

  isConfigured: isGithubConfigured,

  scopeResource,

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
      .map((repo) => ({ id: repoId(repo.owner, repo.name), label: labelOf(repo.owner, repo.name) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },

  async getResource(ctx, resourceId) {
    const { owner, name, subdirectory } = parseGithubResourceId(resourceId);
    if (!owner || !name) return null;
    const installationId = Number(ctx.externalId);
    const repo = await getInstallationRepo(installationId, owner, name);
    if (!repo) return null;
    if (subdirectory && !(await getInstallationDirectory(installationId, repo.owner, repo.name, subdirectory)))
      return null;
    return {
      id: scopeResource(repoId(repo.owner, repo.name), subdirectory),
      label: labelOf(repo.owner, repo.name, subdirectory),
    };
  },

  openSource: (ctx, resourceId, options) => {
    const { owner, name, subdirectory } = parseGithubResourceId(resourceId);
    return GithubSource.connect(Number(ctx.externalId), { owner, name }, subdirectory, options?.deadline);
  },
};
