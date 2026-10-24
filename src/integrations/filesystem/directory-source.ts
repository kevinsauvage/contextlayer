import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ContextSource } from "@/core/context/source";
import { scoreMatches } from "@/core/context/terms";

const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".sql",
  ".yml",
  ".yaml",
]);

export class DirectorySource implements ContextSource {
  constructor(private readonly root: string) {}

  listFiles(): Promise<string[]> {
    return this.walk("");
  }

  readFile(relative: string): Promise<string> {
    return readFile(path.join(this.root, relative), "utf8");
  }

  // Mirrors the GitHub source's relevance order: repeated mentions first, then path order.
  async searchContent(terms: string[]): Promise<string[]> {
    const scored = await Promise.all(
      (await this.listFiles()).map(async (file) => ({
        file,
        score: scoreMatches((await this.readFile(file)).toLowerCase(), terms),
      })),
    );
    return scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
      .map((entry) => entry.file);
  }

  private async walk(dir: string): Promise<string[]> {
    const entries = await readdir(path.join(this.root, dir), { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const relative = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) return IGNORED_DIRS.has(entry.name) ? [] : this.walk(relative);
        return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [relative] : [];
      }),
    );
    return nested.flat().sort();
  }
}
