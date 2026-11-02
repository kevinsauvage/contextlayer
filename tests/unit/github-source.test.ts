import { beforeEach, describe, expect, it, vi } from "vitest";
import { gatherContext } from "@/core/context/gather";
import type { TreeEntry } from "@/integrations/github/tree";
import { GithubSource } from "@/integrations/github/source";
import { first } from "@/lib/first";
import { loadEvaluationCases, readRepository, requestOf, trackerOf } from "../evaluation/fixtures";

type SearchResponse = { data: { items: { path: string }[] } };

type GithubStub = {
  trees: Record<string, { tree: TreeEntry[]; truncated: boolean }>;
  treeCalls: Record<string, unknown>[];
  searchCalls: string[];
  search: (q: string) => Promise<SearchResponse>;
  contents: Record<string, string>;
  contentCalls: string[];
  installationError?: Error;
  repoError?: Error;
  branchError?: Error;
};

const github = vi.hoisted((): GithubStub => ({
  trees: {},
  treeCalls: [],
  searchCalls: [],
  search: () => Promise.resolve({ data: { items: [] } }),
  contents: {},
  contentCalls: [],
}));

vi.mock("@/integrations/github/app", () => ({
  getGithubApp: () => ({
    getInstallationOctokit: async () => {
      if (github.installationError) throw github.installationError;
      return {
        rest: {
          repos: {
            get: async () => {
              if (github.repoError) throw github.repoError;
              return { data: { default_branch: "main" } };
            },
            getBranch: async () => {
              if (github.branchError) throw github.branchError;
              return { data: { commit: { sha: "abc123" } } };
            },
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
        request: async (_route: string, params: { path: string }) => {
          github.contentCalls.push(params.path);
          return { data: github.contents[params.path] ?? "" };
        },
      };
    },
  }),
}));

const connect = () => GithubSource.connect(1, { owner: "acme", name: "shop" });
const connectScoped = () => GithubSource.connect(1, { owner: "acme", name: "shop" }, "apps/web");
// Octokit's RequestError exposes an HTTP status; a plain Error carrying one stands in for it here.
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

beforeEach(() => {
  github.trees = {};
  github.treeCalls = [];
  github.searchCalls = [];
  github.contents = {};
  github.contentCalls = [];
  github.installationError = undefined;
  github.repoError = undefined;
  github.branchError = undefined;
  github.search = () => Promise.resolve({ data: { items: [] } });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("GithubSource.connect", () => {
  it("asks for a reconnect when the installation is gone", async () => {
    github.installationError = httpError(404);

    await expect(connect()).rejects.toThrow("The connection to the GitHub App installation for acme/shop expired.");
  });

  it("names a repository the App can no longer see", async () => {
    github.repoError = httpError(404);

    await expect(connect()).rejects.toThrow(
      "The repository acme/shop is no longer accessible to the ContextLayer GitHub App.",
    );
  });

  it("names an empty repository", async () => {
    github.branchError = httpError(404);

    await expect(connect()).rejects.toThrow(
      "The repository acme/shop has no commits yet, or its default branch is gone.",
    );
  });
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

    const result = await (await connect()).searchContent(["404", "ff00aa", "cart", "total", "price", "tax"]);

    expect(github.searchCalls).toEqual(["cart repo:acme/shop", "total repo:acme/shop", "price repo:acme/shop"]);
    // The terms that were never searched are reported apart, so they do not read as "no match".
    expect(result).toEqual({ paths: ["src/a.ts", "src/b.ts"], failedTerms: ["404", "ff00aa", "tax"] });
  });

  it("keeps the other terms' hits when one search fails, and reports the failed term", async () => {
    github.search = (q) =>
      q.startsWith("cart")
        ? Promise.reject(new Error("rate limited"))
        : Promise.resolve({ data: { items: [{ path: "src/total.ts" }] } });

    expect(await (await connect()).searchContent(["cart", "total"])).toEqual({
      paths: ["src/total.ts"],
      failedTerms: ["cart"],
    });
  });

  it("drops lockfiles, bundles and build output the agent could not read", async () => {
    github.search = () =>
      Promise.resolve({
        data: { items: [{ path: "pnpm-lock.yaml" }, { path: "dist/app.min.js" }, { path: "src/a.ts" }] },
      });

    expect((await (await connect()).searchContent(["cart"])).paths).toEqual(["src/a.ts"]);
  });
});

describe("GithubSource with a monorepo folder", () => {
  it("walks only that folder when the recursive tree is truncated", async () => {
    const blob = (path: string): TreeEntry => ({ path, type: "blob", size: 10 });
    github.trees = {
      "abc123?recursive": { truncated: true, tree: [] },
      abc123: { truncated: false, tree: [{ path: "apps", type: "tree", sha: "apps" }] },
      apps: {
        truncated: false,
        tree: [
          { path: "web", type: "tree", sha: "web" },
          { path: "admin", type: "tree", sha: "admin" },
        ],
      },
      web: {
        truncated: false,
        tree: [
          { path: "index.ts", type: "blob", size: 10 },
          { path: "src", type: "tree", sha: "web-src" },
          { path: "node_modules", type: "tree", sha: "web-deps" },
        ],
      },
      "web-src": { truncated: false, tree: [blob("a.ts")] },
      admin: { truncated: false, tree: [blob("b.ts")] },
      "web-deps": { truncated: false, tree: [blob("x/index.js")] },
    };

    const files = await (await connectScoped()).listFiles();

    expect(files).toEqual(["index.ts", "src/a.ts"]);
    const listed = github.treeCalls.filter((call) => !call.recursive).map((call) => call.tree_sha);
    expect(listed).not.toContain("admin");
    expect(listed).not.toContain("web-deps");
  });
  it("lists only that folder's files, relative to it", async () => {
    github.trees = {
      "abc123?recursive": {
        truncated: false,
        tree: [
          { path: "apps/web/src/a.ts", type: "blob", size: 10 },
          { path: "apps/web/package.json", type: "blob", size: 10 },
          { path: "apps/api/src/b.ts", type: "blob", size: 10 },
          { path: "README.md", type: "blob", size: 10 },
        ],
      },
    };

    expect((await (await connectScoped()).listFiles()).sort()).toEqual(["package.json", "src/a.ts"]);
  });

  it("scopes code search to the folder and strips it from hits", async () => {
    github.search = () =>
      Promise.resolve({ data: { items: [{ path: "apps/web/src/a.ts" }, { path: "apps/api/src/b.ts" }] } });

    expect((await (await connectScoped()).searchContent(["cart"])).paths).toEqual(["src/a.ts"]);
    expect(github.searchCalls).toEqual(["cart repo:acme/shop path:apps/web"]);
  });

  it("reads and links files back into the folder", async () => {
    github.contents["apps/web/src/a.ts"] = "export const a = 1;";
    const source = await connectScoped();

    expect(await source.readFile("src/a.ts")).toBe("export const a = 1;");
    expect(github.contentCalls).toEqual(["apps/web/src/a.ts"]);
    expect(source.urlFor("src/a.ts")).toBe("https://github.com/acme/shop/blob/abc123/apps/web/src/a.ts");
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

// The evaluations read a local checkout, but the app reads GitHub; this proves the fixture's files are still read
// through the API path, and that an agent's search is capped by the provider.
describe("GithubSource on a fixture repository", () => {
  const c = first(
    loadEvaluationCases().filter((candidate) => candidate.id === "banner-title"),
    "banner-title fixture",
  );
  const files = readRepository(c);

  beforeEach(() => {
    github.trees = {
      "abc123?recursive": {
        truncated: false,
        tree: files.map((file) => ({ path: file.path, type: "blob" as const, size: file.content.length })),
      },
    };
    github.contents = Object.fromEntries(files.map((file) => [file.path, file.content]));
    // GitHub code search matches paths and content; the fake returns the files whose text carries the term.
    github.search = (q) => {
      const term = (q.split(" ")[0] ?? "").toLowerCase();
      return Promise.resolve({
        data: {
          items: files.filter((file) => file.content.toLowerCase().includes(term)).map((file) => ({ path: file.path })),
        },
      });
    };
  });

  it("serves the files the agent asks for, with a capped code search", async () => {
    const source = await connect();
    const { evidence } = await gatherContext({
      query: requestOf(c),
      source,
      tracker: trackerOf(c),
      selector: {
        select: async () => ({
          paths: c.expected.relevantFiles.map((file) => file.replace(/^repo\//, "")),
        }),
      },
    });

    const retrieved = evidence.map((item) => `repo/${item.reference}`);
    for (const file of c.expected.relevantFiles) expect(retrieved, file).toContain(file);

    await source.searchContent(["banner", "title", "hero", "extra"]);
    expect(github.searchCalls.length).toBeLessThanOrEqual(3);
  });
});
