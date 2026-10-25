import "server-only";
import type { Octokit } from "octokit";
import type { ContextSource, LineRange } from "@/core/context/source";
import { getGithubApp, type RepoRef } from "./app";
import { walkTree, type TreeEntry } from "./tree";

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
    // Pinned commit, not the branch: a link must keep showing the lines it was verified against.
    readonly revision: string,
  ) {}

  static async connect(installationId: number, repo: RepoRef): Promise<GithubSource> {
    const octokit = await getGithubApp().getInstallationOctokit(installationId);
    const { data } = await octokit.rest.repos.get({ owner: repo.owner, repo: repo.name });
    const branch = await octokit.rest.repos.getBranch({
      owner: repo.owner,
      repo: repo.name,
      branch: data.default_branch,
    });
    return new GithubSource(octokit, repo, branch.data.commit.sha);
  }

  async listFiles(): Promise<string[]> {
    const entries = await this.treeEntries();
    return entries
      .flatMap((entry) =>
        entry.type === "blob" && entry.path && (entry.size ?? 0) <= MAX_FILE_BYTES ? [entry.path] : [],
      )
      .filter((path) => TEXT_EXTENSIONS.test(path) && !IGNORED_PATH.test(path));
  }

  private async treeEntries(): Promise<TreeEntry[]> {
    const { data } = await this.octokit.rest.git.getTree({
      owner: this.repo.owner,
      repo: this.repo.name,
      tree_sha: this.revision,
      recursive: "1",
    });
    if (!data.truncated) return data.tree;
    // A truncated tree is silently incomplete, so pay for one listing per directory instead.
    console.warn(`[github] tree for ${this.repo.owner}/${this.repo.name} truncated; listing directories instead`);
    return walkTree(this.revision, (treeSha) => this.listDirectory(treeSha));
  }

  // `git.getTree` has no pagination: one call returns the whole directory, or a truncated part of a huge one.
  private async listDirectory(treeSha: string): Promise<TreeEntry[]> {
    const { data } = await this.octokit.rest.git.getTree({
      owner: this.repo.owner,
      repo: this.repo.name,
      tree_sha: treeSha,
    });
    if (data.truncated) console.warn(`[github] directory ${treeSha} in ${this.repo.owner}/${this.repo.name} truncated`);
    return data.tree;
  }

  async readFile(path: string): Promise<string> {
    const { data } = await this.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: this.repo.owner,
      repo: this.repo.name,
      path,
      ref: this.revision,
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
    return `https://github.com/${this.repo.owner}/${this.repo.name}/blob/${this.revision}/${path}${anchor}`;
  }
}
