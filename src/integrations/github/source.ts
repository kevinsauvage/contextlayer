import "server-only";
import type { Octokit } from "octokit";
import type { ContextSource, LineRange, SearchResult } from "@/core/context/source";
import { ConnectionMissingError, ReconnectRequiredError, httpStatusOf } from "@/core/errors";
import { getGithubApp, type RepoRef } from "./app";
import {
  isIgnoredPath,
  isReadablePath,
  MAX_FILE_BYTES,
  SEARCH_RESULTS,
  searchableTerms,
  skippedTerms,
} from "../source-filters";
import { walkTree, type TreeEntry } from "./tree";

export class GithubSource implements ContextSource {
  private constructor(
    private readonly octokit: Octokit,
    private readonly repo: RepoRef,
    // Pinned commit, not the branch: a link must keep showing the lines it was verified against.
    readonly revision: string,
    // A monorepo app: paths are presented relative to this directory, and links point back into it.
    private readonly subdirectory = "",
    // The run this source belongs to; a walk or a search that outlives it must stop.
    private readonly deadline?: AbortSignal,
  ) {}

  // Every call carries the run's deadline; the App's fetch adds its own timeout on top.
  private get signal() {
    return this.deadline ? { request: { signal: this.deadline } } : {};
  }

  static async connect(
    installationId: number,
    repo: RepoRef,
    subdirectory?: string,
    deadline?: AbortSignal,
  ): Promise<GithubSource> {
    const label = `${repo.owner}/${repo.name}`;
    const signal = deadline ? { request: { signal: deadline } } : {};
    let octokit: Octokit;
    try {
      octokit = await getGithubApp().getInstallationOctokit(installationId);
    } catch (error) {
      const status = httpStatusOf(error);
      if (status === 401 || status === 403 || status === 404)
        throw new ReconnectRequiredError(`the GitHub App installation for ${label}`);
      throw error;
    }

    let branch: string;
    try {
      const { data } = await octokit.rest.repos.get({ owner: repo.owner, repo: repo.name, ...signal });
      branch = data.default_branch;
    } catch (error) {
      const status = httpStatusOf(error);
      if (status === 403 || status === 404)
        throw new ConnectionMissingError(
          `The repository ${label} is no longer accessible to the ContextLayer GitHub App.`,
        );
      throw error;
    }

    try {
      const { data } = await octokit.rest.repos.getBranch({
        owner: repo.owner,
        repo: repo.name,
        branch,
        ...signal,
      });
      return new GithubSource(octokit, repo, data.commit.sha, subdirectory, deadline);
    } catch (error) {
      const status = httpStatusOf(error);
      if (status === 404)
        throw new ConnectionMissingError(`The repository ${label} has no commits yet, or its default branch is gone.`);
      throw error;
    }
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
      ...this.signal,
    });
    if (!data.truncated) return data.tree;
    // A truncated tree is silently incomplete, so pay for one listing per directory instead. Start inside the
    // project's folder: from the repository root a monorepo would list every other app and its dependencies.
    console.warn(`[github] tree for ${this.repo.owner}/${this.repo.name} truncated; listing directories instead`);
    return walkTree(await this.startTreeSha(), (treeSha) => this.listDirectory(treeSha), {
      prefix: this.subdirectory,
      descend: (path) => !isIgnoredPath(path),
      signal: this.deadline,
    });
  }

  // The tree sha of the project's folder, so a walk does not have to start at the repository root.
  private async startTreeSha(): Promise<string> {
    let sha = this.revision;
    for (const part of this.subdirectory.split("/").filter(Boolean)) {
      const entry = (await this.listDirectory(sha)).find(
        (candidate) => candidate.path === part && candidate.type === "tree",
      );
      if (!entry?.sha)
        throw new ConnectionMissingError(
          `The folder ${this.subdirectory} is no longer in ${this.repo.owner}/${this.repo.name}.`,
        );
      sha = entry.sha;
    }
    return sha;
  }

  // `git.getTree` has no pagination: one call returns the whole directory, or a truncated part of a huge one.
  private async listDirectory(treeSha: string): Promise<TreeEntry[]> {
    const { data } = await this.octokit.rest.git.getTree({
      owner: this.repo.owner,
      repo: this.repo.name,
      tree_sha: treeSha,
      ...this.signal,
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
      ...this.signal,
    });
    return data as unknown as string;
  }

  // Code search has no OR: ANDing every term finds almost nothing, so run one query per term, best effort.
  async searchContent(terms: string[]): Promise<SearchResult> {
    const repo = `repo:${this.repo.owner}/${this.repo.name}`;
    const scope = this.subdirectory ? ` path:${this.subdirectory}` : "";
    const searchable = searchableTerms(terms);
    const paths: string[] = [];
    const failedTerms: string[] = [];
    for (const term of searchable) {
      try {
        const { data } = await this.octokit.rest.search.code({
          q: `${term} ${repo}${scope}`,
          per_page: SEARCH_RESULTS,
          ...this.signal,
        });
        paths.push(
          ...data.items
            .map((item) => item.path)
            .filter((path) => this.inScope(path))
            .map((path) => this.relativePath(path))
            // Lockfiles, bundles and build output would fill the result slots and then fail to read.
            .filter(isReadablePath),
        );
      } catch (error) {
        // Rate limits (10 code searches a minute) and unparsable terms must not fail retrieval, but the caller has to
        // know the term went unsearched rather than unmatched.
        console.warn(`[github] code search failed for "${term}"`, error instanceof Error ? error.message : error);
        failedTerms.push(term);
      }
    }
    return { paths: [...new Set(paths)], failedTerms: [...skippedTerms(terms), ...failedTerms] };
  }

  urlFor(path: string, lines?: LineRange): string {
    const anchor = lines ? `#L${lines.start}-L${lines.end}` : "";
    return `https://github.com/${this.repo.owner}/${this.repo.name}/blob/${this.revision}/${this.repositoryPath(path)}${anchor}`;
  }
}
