import { describe, expect, it } from "vitest";
import { evidenceFromPaths } from "@/core/context/retrieve";
import type { ContextSource } from "@/core/context/source";

const source = (files: Record<string, string>): ContextSource => ({
  listFiles: async () => Object.keys(files),
  readFile: async (path) => {
    const content = files[path];
    if (content === undefined) throw new Error(`no such file: ${path}`);
    return content;
  },
});

describe("evidenceFromPaths", () => {
  it("returns a short file whole", async () => {
    const body = "export const answer = 42;\n";
    const [file] = await evidenceFromPaths(["src/a.ts"], ["answer"], source({ "src/a.ts": body }));
    expect(file?.excerpt).toBe(body.trim());
  });

  it("returns the head and the tail of a file longer than its share", async () => {
    const big = `HEAD\n${"a".repeat(12_000)}\nMIDDLE\n${"m".repeat(12_000)}\nTAIL`;
    const [file] = await evidenceFromPaths(["src/big.ts"], [], source({ "src/big.ts": big }));

    expect(file?.excerpt).toContain("HEAD");
    expect(file?.excerpt).toContain("TAIL");
    expect(file?.excerpt).not.toContain("MIDDLE");
    expect(file?.excerpt).toContain("middle of the file omitted");
  });

  it("cites only the head's lines when the middle of a file is omitted", async () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `const line${i} = ${i};`);
    const [file] = await evidenceFromPaths(["src/big.ts"], ["line100"], source({ "src/big.ts": lines.join("\n") }));

    expect(file?.excerpt).toContain("middle of the file omitted");
    const range = file?.lines;
    expect(range?.start).toBe(96);
    expect(range && range.end < 2000).toBe(true);
    expect(file?.excerpt.startsWith(`${lines[95]}`)).toBe(true);
    expect(file?.excerpt).toContain(`${lines[(range?.end ?? 0) - 2]}`);
  });

  it("gives a long file the budget short files leave unspent", async () => {
    const big = `HEAD\n${"a".repeat(6000)}\nBULGE\n${"b".repeat(12_000)}\nTAIL`;
    const files = {
      "src/big.ts": big,
      "src/small1.ts": "export const one = 1;",
      "src/small2.ts": "export const two = 2;",
    };
    const [bigFile] = await evidenceFromPaths(["src/big.ts", "src/small1.ts", "src/small2.ts"], [], source(files));

    // On its 8000-character share the head would stop before BULGE; the two small files leave enough for 16 000.
    expect(bigFile?.excerpt).toContain("BULGE");
    expect(bigFile?.excerpt).toContain("TAIL");
  });

  it("skips files the repository does not have", async () => {
    const found = await evidenceFromPaths(["src/missing.ts"], [], source({}));
    expect(found).toEqual([]);
  });

  it("keeps the selection order", async () => {
    const found = await evidenceFromPaths(
      ["src/second.ts", "src/first.ts"],
      [],
      source({ "src/first.ts": "one", "src/second.ts": "two" }),
    );
    expect(found.map((file) => file.reference)).toEqual(["src/second.ts", "src/first.ts"]);
  });
});
