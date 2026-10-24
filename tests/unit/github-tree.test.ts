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
});
