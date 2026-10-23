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

export type RepoRef = { owner: string; name: string };

export async function listInstallationRepos(installationId: number): Promise<RepoRef[]> {
  const octokit = await getGithubApp().getInstallationOctokit(installationId);
  const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, { per_page: 100 });
  return repos.map((repo) => ({ owner: repo.owner.login, name: repo.name }));
}

// Proves the signed-in GitHub user actually has access to the installation they claim,
// since installation_id in the callback URL is attacker-controllable.
export async function installationAccountForUser(code: string, installationId: number): Promise<string | null> {
  const app = getGithubApp();
  const { authentication } = await app.oauth.createToken({ code });
  const userOctokit = await app.oauth.getUserOctokit({ token: authentication.token });
  const installations = await userOctokit.paginate(userOctokit.rest.apps.listInstallationsForAuthenticatedUser, {
    per_page: 100,
  });
  const match = installations.find((installation) => installation.id === installationId);
  return match?.account && "login" in match.account ? match.account.login : null;
}
