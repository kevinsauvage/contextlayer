import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreeEntry } from "@/integrations/github/tree";
import { GithubSource } from "@/integrations/github/source";

type SearchResponse = { data: { items: { path: string }[] } };

type GithubStub = {
  trees: Record<string, { tree: TreeEntry[]; truncated: boolean }>;
  treeCalls: Record<string, unknown>[];
  searchCalls: string[];
  search: (q: string) => Promise<SearchResponse>;
};

const github = vi.hoisted((): GithubStub => ({
  trees: {},
  treeCalls: [],
  searchCalls: [],
  search: () => Promise.resolve({ data: { items: [] } }),
}));

vi.mock("@/integrations/github/app", () => ({
  getGithubApp: () => ({
    getInstallationOctokit: async () => ({
      rest: {
        repos: {
          get: async () => ({ data: { default_branch: "main" } }),
          getBranch: async () => ({ data: { commit: { sha: "abc123" } } }),
        },
        git: {
          // A recursive call is keyed `<sha>?recursive`, so a test can truncate it and still list the root.
          getTree: async (params: { tree_sha: string; recursive?: string }) => {
            github.treeCalls.push(params);
            const data = github.trees[params.recursive ? `${params.tree_sha}?recursive` : params.tree_sha];
            if (!data) throw new Error(`unknown tree ${params.tree_sha}`);
            return { data };
          },
        },
        search: {
          code: (params: { q: string }) => {
            github.searchCalls.push(params.q);
            return github.search(params.q);
          },
        },
      },
    }),
  }),
}));

const connect = () => GithubSource.connect(1, { owner: "acme", name: "shop" });

beforeEach(() => {
  github.trees = {};
  github.treeCalls = [];
  github.searchCalls = [];
  github.search = () => Promise.resolve({ data: { items: [] } });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("GithubSource.listFiles", () => {
  it("keeps small text blobs outside ignored paths", async () => {
    github.trees = {
      "abc123?recursive": {
        truncated: false,
        tree: [
          { path: "src/app.ts", type: "blob", size: 120 },
          { path: "src/big.ts", type: "blob", size: 200_000 },
          { path: "src/logo.png", type: "blob", size: 10 },
          { path: "node_modules/x/index.js", type: "blob", size: 10 },
          { path: "pnpm-lock.yaml", type: "blob", size: 10 },
          { path: "public/app.min.js", type: "blob", size: 10 },
          { path: "vendor/chart.js", type: "tree", sha: "dir" },
          { path: "libs/ui.ts", type: "commit", sha: "submodule" },
        ],
      },
    };

    expect(await (await connect()).listFiles()).toEqual(["src/app.ts"]);
  });

  it("lists each directory once without pagination when the recursive tree is truncated", async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ path: `f${i}.ts`, type: "blob", size: 1 }));
    github.trees = {
      "abc123?recursive": { truncated: true, tree: [] },
      abc123: { truncated: false, tree: [{ path: "src", type: "tree", sha: "src" }] },
      src: { truncated: false, tree: [...many, { path: "lib", type: "tree", sha: "lib" }] },
      lib: { truncated: false, tree: [{ path: "util.ts", type: "blob", size: 1 }] },
    };

    const files = await (await connect()).listFiles();

    expect(files).toHaveLength(151);
    expect(files).toContain("src/f149.ts");
    expect(files).toContain("src/lib/util.ts");
    expect(github.treeCalls.map((call) => call.tree_sha)).toEqual(["abc123", "abc123", "src", "lib"]);
    expect(github.treeCalls.some((call) => "page" in call || "per_page" in call)).toBe(false);
  });
});

describe("GithubSource.searchContent", () => {
  it("skips numbers and hex values, runs at most three searches and dedupes paths", async () => {
    github.search = (q) =>
      Promise.resolve({
        data: { items: [{ path: "src/a.ts" }, { path: q.startsWith("cart") ? "src/b.ts" : "src/a.ts" }] },
      });

    const paths = await (await connect()).searchContent(["404", "ff00aa", "cart", "total", "price", "tax"]);

    expect(github.searchCalls).toEqual(["cart repo:acme/shop", "total repo:acme/shop", "price repo:acme/shop"]);
    expect(paths).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("keeps the other terms' hits when one search fails", async () => {
    github.search = (q) =>
      q.startsWith("cart")
        ? Promise.reject(new Error("rate limited"))
        : Promise.resolve({ data: { items: [{ path: "src/total.ts" }] } });

    expect(await (await connect()).searchContent(["cart", "total"])).toEqual(["src/total.ts"]);
  });
});

describe("GithubSource.urlFor", () => {
  it("links to the file at the pinned commit, with a line anchor when given", async () => {
    const source = await connect();

    expect(source.revision).toBe("abc123");
    expect(source.urlFor("src/a.ts")).toBe("https://github.com/acme/shop/blob/abc123/src/a.ts");
    expect(source.urlFor("src/a.ts", { start: 3, end: 9 })).toBe(
      "https://github.com/acme/shop/blob/abc123/src/a.ts#L3-L9",
    );
  });
});
