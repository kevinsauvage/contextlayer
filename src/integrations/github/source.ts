import "server-only";
import type { Octokit } from "octokit";
import type { ContextSource, LineRange } from "@/core/context/source";
import { getGithubApp, type RepoRef } from "./app";
import { isReadablePath, MAX_FILE_BYTES, SEARCH_RESULTS, searchableTerms } from "../source-filters";
import { walkTree, type TreeEntry } from "./tree";

export class GithubSource implements ContextSource {
  private constructor(
    private readonly octokit: Octokit,
    private readonly repo: RepoRef,
    // Pinned commit, not the branch: a link must keep showing the lines it was verified against.
    readonly revision: string,
    // A monorepo app: paths are presented relative to this directory, and links point back into it.
    private readonly subdirectory = "",
  ) {}

  static async connect(installationId: number, repo: RepoRef, subdirectory?: string): Promise<GithubSource> {
    const octokit = await getGithubApp().getInstallationOctokit(installationId);
    const { data } = await octokit.rest.repos.get({ owner: repo.owner, repo: repo.name });
    const branch = await octokit.rest.repos.getBranch({
      owner: repo.owner,
      repo: repo.name,
      branch: data.default_branch,
    });
    return new GithubSource(octokit, repo, branch.data.commit.sha, subdirectory);
  }

  private inScope(path: string): boolean {
    return !this.subdirectory || path === this.subdirectory || path.startsWith(`${this.subdirectory}/`);
  }

  private relativePath(path: string): string {
    if (!this.subdirectory || path === this.subdirectory) return path;
    return path.slice(this.subdirectory.length + 1);
  }

  private repositoryPath(path: string): string {
    return this.subdirectory ? `${this.subdirectory}/${path}` : path;
  }

  async listFiles(): Promise<string[]> {
    const entries = await this.treeEntries();
    return entries
      .flatMap((entry) =>
        entry.type === "blob" && entry.path && (entry.size ?? 0) <= MAX_FILE_BYTES ? [entry.path] : [],
      )
      .filter((path) => this.inScope(path) && path !== this.subdirectory)
      .map((path) => this.relativePath(path))
      .filter(isReadablePath);
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
      path: this.repositoryPath(path),
      ref: this.revision,
      headers: { accept: "application/vnd.github.raw+json" },
    });
    return data as unknown as string;
  }

  // Code search has no OR: ANDing every term finds almost nothing, so run one query per term, best effort.
  async searchContent(terms: string[]): Promise<string[]> {
    const repo = `repo:${this.repo.owner}/${this.repo.name}`;
    const scope = this.subdirectory ? ` path:${this.subdirectory}` : "";
    const searchable = searchableTerms(terms);
    const paths: string[] = [];
    for (const term of searchable) {
      try {
        const { data } = await this.octokit.rest.search.code({
          q: `${term} ${repo}${scope}`,
          per_page: SEARCH_RESULTS,
        });
        paths.push(
          ...data.items
            .map((item) => item.path)
            .filter((path) => this.inScope(path))
            .map((path) => this.relativePath(path)),
        );
      } catch (error) {
        // Rate limits and unparsable terms must not fail retrieval, but silent degradation is worth a log line.
        console.warn(`[github] code search failed for "${term}"`, error instanceof Error ? error.message : error);
      }
    }
    return [...new Set(paths)];
  }

  urlFor(path: string, lines?: LineRange): string {
    const anchor = lines ? `#L${lines.start}-L${lines.end}` : "";
    return `https://github.com/${this.repo.owner}/${this.repo.name}/blob/${this.revision}/${this.repositoryPath(path)}${anchor}`;
  }
}
