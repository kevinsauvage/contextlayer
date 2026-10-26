import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ContextSource } from "@/core/context/source";
import { isReadablePath, MAX_FILE_BYTES, SEARCH_RESULTS, searchableTerms } from "../source-filters";

const exec = promisify(execFile);
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const NO_MATCH = 1;

// A local checkout read through git: tracked and untracked files, `.gitignore` honored, and one search per term
// capped like the GitHub source so retrieval measured here behaves like retrieval in the app. For development and
// evaluations; the app reads repositories through a provider.
export class GitSource implements ContextSource {
  private constructor(
    private readonly root: string,
    readonly revision?: string,
  ) {}

  static async open(root: string): Promise<GitSource> {
    const head = await git(root, ["rev-parse", "HEAD"]).catch(() => undefined);
    return new GitSource(root, head?.trim());
  }

  async listFiles(): Promise<string[]> {
    const listed = await git(this.root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
    const paths = listed.split("\0").filter((file) => file && isReadablePath(file));
    const sizes = await Promise.all(
      paths.map((file) =>
        stat(path.join(this.root, file)).then(
          (info) => info.size,
          () => Infinity,
        ),
      ),
    );
    return paths.filter((_, index) => (sizes[index] ?? Infinity) <= MAX_FILE_BYTES).sort();
  }

  readFile(file: string): Promise<string> {
    return readFile(path.join(this.root, file), "utf8");
  }

  async searchContent(terms: string[]): Promise<string[]> {
    const found: string[] = [];
    for (const term of searchableTerms(terms)) {
      const counted = await git(this.root, [
        "grep",
        "--untracked",
        "-I",
        "-i",
        "-F",
        "-c",
        "-e",
        term,
        "--",
        ".",
      ]).catch((error: unknown) => {
        if (isExitCode(error, NO_MATCH)) return "";
        throw error;
      });
      const ranked = counted
        .split("\n")
        .filter(Boolean)
        .map((line) => ({
          file: line.slice(0, line.lastIndexOf(":")),
          hits: Number(line.slice(line.lastIndexOf(":") + 1)),
        }))
        .filter(({ file }) => isReadablePath(file))
        .sort((a, b) => b.hits - a.hits || a.file.localeCompare(b.file))
        .slice(0, SEARCH_RESULTS);
      found.push(...ranked.map(({ file }) => file));
    }
    return [...new Set(found)];
  }
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd, maxBuffer: MAX_OUTPUT_BYTES });
  return stdout;
}

const isExitCode = (error: unknown, code: number) =>
  typeof error === "object" && error !== null && "code" in error && error.code === code;
