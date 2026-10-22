import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ContextSource } from "@/core/context/source";

const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mdx", ".css", ".sql", ".yml", ".yaml"]);

export class DirectorySource implements ContextSource {
  constructor(private readonly root: string) {}

  listFiles(): Promise<string[]> {
    return this.walk("");
  }

  readFile(relative: string): Promise<string> {
    return readFile(path.join(this.root, relative), "utf8");
  }

  async searchContent(terms: string[]): Promise<string[]> {
    const matches = await Promise.all(
      (await this.listFiles()).map(async (file) => {
        const content = (await this.readFile(file)).toLowerCase();
        return terms.some((term) => content.includes(term)) ? file : null;
      }),
    );
    return matches.filter((file): file is string => file !== null);
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
