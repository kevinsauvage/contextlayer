import "server-only";
import type { Octokit } from "octokit";
import type { ContextSource, LineRange } from "@/core/context/source";
import { getGithubApp, type RepoRef } from "./app";

const MAX_FILE_BYTES = 100_000;
const MAX_SEARCH_TERMS = 5;
const TEXT_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|css|scss|sql|ya?ml|py|rb|go|java|kt|php|cs|rs|html|vue|svelte)$/i;
const IGNORED_PATH = /(^|\/)(node_modules|dist|build|\.next|vendor|coverage)\/|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.min\./;

export class GithubSource implements ContextSource {
  private constructor(
    private readonly octokit: Octokit,
    private readonly repo: RepoRef,
    private readonly branch: string,
  ) {}

  static async connect(installationId: number, repo: RepoRef): Promise<GithubSource> {
    const octokit = await getGithubApp().getInstallationOctokit(installationId);
    const { data } = await octokit.rest.repos.get({ owner: repo.owner, repo: repo.name });
    return new GithubSource(octokit, repo, data.default_branch);
  }

  async listFiles(): Promise<string[]> {
    const { data } = await this.octokit.rest.git.getTree({
      owner: this.repo.owner,
      repo: this.repo.name,
      tree_sha: this.branch,
      recursive: "1",
    });
    return data.tree
      .filter((node) => node.type === "blob" && node.path && (node.size ?? 0) <= MAX_FILE_BYTES)
      .map((node) => node.path as string)
      .filter((path) => TEXT_EXTENSIONS.test(path) && !IGNORED_PATH.test(path));
  }

  async readFile(path: string): Promise<string> {
    const { data } = await this.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: this.repo.owner,
      repo: this.repo.name,
      path,
      ref: this.branch,
      headers: { accept: "application/vnd.github.raw+json" },
    });
    return data as unknown as string;
  }

  // Code search is rate-limited and eventually consistent; path matching still works without it.
  async searchContent(terms: string[]): Promise<string[]> {
    const query = `${terms.slice(0, MAX_SEARCH_TERMS).join(" OR ")} repo:${this.repo.owner}/${this.repo.name}`;
    try {
      const { data } = await this.octokit.rest.search.code({ q: query, per_page: 30 });
      return data.items.map((item) => item.path);
    } catch {
      return [];
    }
  }

  urlFor(path: string, lines?: LineRange): string {
    const anchor = lines ? `#L${lines.start}-L${lines.end}` : "";
    return `https://github.com/${this.repo.owner}/${this.repo.name}/blob/${this.branch}/${path}${anchor}`;
  }
}
