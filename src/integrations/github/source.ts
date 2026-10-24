import "server-only";
import type { Octokit } from "octokit";
import type { ContextSource, LineRange } from "@/core/context/source";
import { getGithubApp, type RepoRef } from "./app";

const MAX_FILE_BYTES = 100_000;
const MAX_SEARCH_TERMS = 3;
const SEARCH_RESULTS = 20;
const TEXT_EXTENSIONS =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|css|scss|sql|ya?ml|py|rb|go|java|kt|php|cs|rs|html|vue|svelte)$/i;
const IGNORED_PATH =
  /(^|\/)(node_modules|dist|build|\.next|vendor|coverage)\/|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.min\./;

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
      .map((node) => node.path)
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

  // A bare number or a hex colour names a value, not an identifier a text search can find.
  // Code search has no OR: ANDing every term finds almost nothing, so run one query per term, best effort.
  async searchContent(terms: string[]): Promise<string[]> {
    const repo = `repo:${this.repo.owner}/${this.repo.name}`;
    const searchable = terms
      .filter((term) => !/^\d+$/.test(term) && !/^(?=.*\d)[0-9a-f]{3,8}$/i.test(term))
      .slice(0, MAX_SEARCH_TERMS);
    const paths: string[] = [];
    for (const term of searchable) {
      try {
        const { data } = await this.octokit.rest.search.code({ q: `${term} ${repo}`, per_page: SEARCH_RESULTS });
        paths.push(...data.items.map((item) => item.path));
      } catch (error) {
        // Rate limits and unparsable terms must not fail retrieval, but silent degradation is worth a log line.
        console.warn(`[github] code search failed for "${term}"`, error instanceof Error ? error.message : error);
      }
    }
    return [...new Set(paths)];
  }

  urlFor(path: string, lines?: LineRange): string {
    const anchor = lines ? `#L${lines.start}-L${lines.end}` : "";
    return `https://github.com/${this.repo.owner}/${this.repo.name}/blob/${this.branch}/${path}${anchor}`;
  }
}
