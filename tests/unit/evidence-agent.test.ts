import { describe, expect, it } from "vitest";
import { pathsFromCalls, searchReply } from "@/integrations/ai/evidence-agent";

const known = new Set(["src/a.ts", "src/b.ts", "src/c.ts"]);
const select = (paths: unknown) => ({ toolName: "selectFiles", input: { paths } });
const read = (path: string) => ({ toolName: "readFile", input: { path } });

describe("pathsFromCalls", () => {
  it("keeps the selection in order, deduplicated and inside the repository", () => {
    expect(pathsFromCalls([select(["src/b.ts", "src/a.ts", "src/b.ts", "src/missing.ts"])], known)).toEqual([
      "src/b.ts",
      "src/a.ts",
    ]);
  });

  it("lets the last selection win", () => {
    expect(pathsFromCalls([select(["src/a.ts"]), read("src/b.ts"), select(["src/c.ts"])], known)).toEqual(["src/c.ts"]);
  });

  it("falls back to the files it read when it never selects", () => {
    expect(pathsFromCalls([read("src/a.ts"), read("src/missing.ts"), read("src/c.ts")], known)).toEqual([
      "src/a.ts",
      "src/c.ts",
    ]);
  });

  it("falls back to the read trail when the selection is malformed", () => {
    expect(
      pathsFromCalls([read("src/b.ts"), { toolName: "selectFiles", input: { paths: "src/a.ts" } }], known),
    ).toEqual(["src/b.ts"]);
  });

  it("caps the selection at eight files", () => {
    const many = new Set(Array.from({ length: 10 }, (_, i) => `src/f${i}.ts`));
    expect(pathsFromCalls([select([...many])], many)).toHaveLength(8);
  });

  it("returns nothing without a tool call", () => {
    expect(pathsFromCalls([], known)).toEqual([]);
  });
});

describe("searchReply", () => {
  it("returns the paths when every term was searched", () => {
    expect(searchReply({ paths: ["src/a.ts"], failedTerms: [] })).toEqual(["src/a.ts"]);
  });

  it("says which terms went unsearched instead of reporting no match", () => {
    expect(searchReply({ paths: [], failedTerms: ["cart", "total"] })).toBe(
      "(Search failed for cart, total: the code host refused it, so those words may still be in the code. Use listFiles with contains, or readFile.)",
    );
  });

  it("keeps the hits of the terms that were searched", () => {
    expect(searchReply({ paths: ["src/a.ts", "src/b.ts"], failedTerms: ["cart"] })).toMatch(
      /^src\/a\.ts\nsrc\/b\.ts\n\(Search failed for cart:/,
    );
  });
});
