import "server-only";
import { App, RequestError } from "octokit";
import { hasEnv, requireEnv } from "@/infrastructure/env";

const APP_KEYS = [
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
] as const;

let cached: App | undefined;

export const isGithubConfigured = () => hasEnv(...APP_KEYS);

export function getGithubApp(): App {
  if (!cached) {
    const env = requireEnv(...APP_KEYS);
    cached = new App({
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
      oauth: { clientId: env.GITHUB_APP_CLIENT_ID, clientSecret: env.GITHUB_APP_CLIENT_SECRET },
    });
  }
  return cached;
}

export const githubInstallUrl = (state: string) =>
  `https://github.com/apps/${requireEnv("GITHUB_APP_SLUG").GITHUB_APP_SLUG}/installations/new?state=${encodeURIComponent(state)}`;

export function githubAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GITHUB_APP_CLIENT_ID").GITHUB_APP_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export type RepoRef = { owner: string; name: string };

export async function listInstallationRepos(installationId: number): Promise<RepoRef[]> {
  const octokit = await getGithubApp().getInstallationOctokit(installationId);
  const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, { per_page: 100 });
  return repos.map((repo) => ({ owner: repo.owner.login, name: repo.name }));
}

export async function getInstallationRepo(
  installationId: number,
  owner: string,
  name: string,
): Promise<RepoRef | null> {
  const octokit = await getGithubApp().getInstallationOctokit(installationId);
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo: name });
    return { owner: data.owner.login, name: data.name };
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) return null;
    throw error;
  }
}

export async function getInstallationDirectory(
  installationId: number,
  owner: string,
  name: string,
  path: string,
): Promise<boolean> {
  const octokit = await getGithubApp().getInstallationOctokit(installationId);
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo: name, path });
    return Array.isArray(data);
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) return false;
    throw error;
  }
}

export type GithubAccount = { installationId: number; accountLogin: string };

// Installations of this app that the signed-in GitHub user can access. Installation ids in callback URLs
// are attacker-controllable, so only ids returned here may be linked.
export async function githubAccountsForUser(code: string): Promise<GithubAccount[]> {
  const app = getGithubApp();
  const { authentication } = await app.oauth.createToken({ code });
  const userOctokit = await app.oauth.getUserOctokit({ token: authentication.token });
  const installations = await userOctokit.paginate(userOctokit.rest.apps.listInstallationsForAuthenticatedUser, {
    per_page: 100,
  });
  return installations.flatMap((installation) =>
    installation.account && "login" in installation.account
      ? [{ installationId: installation.id, accountLogin: installation.account.login }]
      : [],
  );
}
