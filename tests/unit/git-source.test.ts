import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GitSource } from "@/integrations/git/git-source";

let root: string;
const write = (file: string, content: string) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
};
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "git-source-"));
  git("init", "-q");
  git("config", "user.email", "t@example.test");
  git("config", "user.name", "T");
  write(".gitignore", "ignored/\n");
  write("src/Banner.tsx", "export const Banner = () => <h1>Hello</h1>;\nbanner banner banner");
  write("src/other.ts", "export const other = 1; // banner once");
  write("src/image.png", "banner");
  write("node_modules/pkg/index.js", "banner");
  write("ignored/secret.ts", "banner");
  write("big.ts", "banner ".repeat(30_000));
  git("add", ".");
  git("commit", "-q", "-m", "init");
  write("src/untracked.ts", "export const draft = 'banner';");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("GitSource", () => {
  it("lists tracked and untracked text files, skipping ignored, vendored, binary and large ones", async () => {
    const source = await GitSource.open(root);
    expect(await source.listFiles()).toEqual(["src/Banner.tsx", "src/other.ts", "src/untracked.ts"]);
  });

  it("reads a file and reports the commit it sits on", async () => {
    const source = await GitSource.open(root);
    expect(await source.readFile("src/other.ts")).toContain("banner once");
    expect(source.revision).toMatch(/^[0-9a-f]{40}$/);
  });

  it("ranks search hits by how many lines match and drops ignored and binary files", async () => {
    const source = await GitSource.open(root);
    expect(await source.searchContent(["banner"])).toEqual([
      "src/Banner.tsx",
      "big.ts",
      "src/other.ts",
      "src/untracked.ts",
    ]);
  });

  it("returns nothing for a term that matches no file", async () => {
    const source = await GitSource.open(root);
    expect(await source.searchContent(["zzzxqy"])).toEqual([]);
  });
});
