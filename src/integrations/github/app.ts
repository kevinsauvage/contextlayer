import "server-only";
import { App } from "octokit";
import { requireEnv } from "@/infrastructure/env";

let cached: App | undefined;

export function getGithubApp(): App {
  if (!cached) {
    const env = requireEnv(
      "GITHUB_APP_ID",
      "GITHUB_APP_PRIVATE_KEY",
      "GITHUB_APP_CLIENT_ID",
      "GITHUB_APP_CLIENT_SECRET",
    );
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

export function githubAuthorizeUrl(state: string): string {
  const env = requireEnv("GITHUB_APP_CLIENT_ID", "BETTER_AUTH_URL");
  const params = new URLSearchParams({
    client_id: env.GITHUB_APP_CLIENT_ID,
    redirect_uri: new URL("/api/github/callback", env.BETTER_AUTH_URL).toString(),
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
