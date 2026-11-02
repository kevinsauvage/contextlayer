import { describe, expect, it } from "vitest";
import { walkTree, type TreeEntry } from "@/integrations/github/tree";

describe("walkTree", () => {
  it("lists every directory once and returns full paths for blobs only", async () => {
    const trees: Record<string, TreeEntry[]> = {
      root: [
        { path: "README.md", type: "blob", size: 10 },
        { path: "src", type: "tree", sha: "src-sha" },
        { path: "vendor", type: "commit", sha: "submodule-sha" },
      ],
      "src-sha": [
        { path: "main.ts", type: "blob" },
        { path: "components", type: "tree", sha: "components-sha" },
      ],
      "components-sha": [{ path: "Hero.tsx", type: "blob" }],
    };
    const visited: string[] = [];

    const entries = await walkTree("root", async (sha) => {
      visited.push(sha);
      return trees[sha] ?? [];
    });

    expect(entries).toEqual([
      { type: "blob", path: "README.md", size: 10 },
      { type: "blob", path: "src/main.ts", size: undefined },
      { type: "blob", path: "src/components/Hero.tsx", size: undefined },
    ]);
    expect(visited).toEqual(["root", "src-sha", "components-sha"]);
  });

  it("stops cleanly when a directory cannot be listed", async () => {
    const entries = await walkTree("root", async () => []);

    expect(entries).toEqual([]);
  });

  it("skips directories the caller rules out and keeps the prefix", async () => {
    const trees: Record<string, TreeEntry[]> = {
      root: [
        { path: "src", type: "tree", sha: "src-sha" },
        { path: "node_modules", type: "tree", sha: "deps-sha" },
        { path: "package.json", type: "blob" },
      ],
      "src-sha": [{ path: "a.ts", type: "blob" }],
      "deps-sha": [{ path: "x/index.js", type: "blob" }],
    };
    const visited: string[] = [];

    const entries = await walkTree(
      "root",
      async (sha) => {
        visited.push(sha);
        return trees[sha] ?? [];
      },
      { prefix: "apps/web", descend: (path) => !path.includes("node_modules") },
    );

    expect(entries).toEqual([
      { type: "blob", path: "apps/web/package.json", size: undefined },
      { type: "blob", path: "apps/web/src/a.ts", size: undefined },
    ]);
    expect(visited).not.toContain("deps-sha");
  });

  it("stops when the run's deadline has passed", async () => {
    const controller = new AbortController();
    const trees: Record<string, TreeEntry[]> = {
      root: [{ path: "src", type: "tree", sha: "src-sha" }],
      "src-sha": [{ path: "a.ts", type: "blob" }],
    };
    controller.abort();

    expect(await walkTree("root", async (sha) => trees[sha] ?? [], { signal: controller.signal })).toEqual([]);
  });
});
