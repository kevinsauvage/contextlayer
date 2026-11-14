import { describe, expect, it } from "vitest";
import { evidenceFromPaths } from "@/core/context/retrieve";
import { extractTerms } from "@/core/context/terms";
import type { ContextSource } from "@/core/context/source";

const source = (files: Record<string, string>): ContextSource => ({
  listFiles: async () => Object.keys(files),
  readFile: async (path) => {
    const content = files[path];
    if (content === undefined) throw new Error(`no such file: ${path}`);
    return content;
  },
});

// 800 lines of filler, long enough that the file never fits its share and the window has to be placed.
const filler = (tag: string) =>
  Array.from({ length: 800 }, (_, i) => `"${tag}.key${i}": "${tag} value ${i}",`).join("\n");

const HIT_LINE = 801;

describe("evidenceFromPaths", () => {
  it("finds an accented line from an unaccented term", async () => {
    const content = `${filler("before")}\n"checkout.title": "Paiement sécurisé",\n${filler("after")}`;
    const [file] = await evidenceFromPaths(["fr.json"], extractTerms("sécurisé"), source({ "fr.json": content }));

    expect(file?.excerpt).toContain("Paiement sécurisé");
    expect(HIT_LINE - (file?.lines?.start ?? 0)).toBeLessThanOrEqual(5);
  });

  it("places the window on an ASCII hit as before", async () => {
    const content = `${filler("before")}\n"checkout.title": "Payment secured",\n${filler("after")}`;
    const [file] = await evidenceFromPaths(
      ["en.json"],
      extractTerms("payment secured"),
      source({ "en.json": content }),
    );

    expect(file?.excerpt).toContain("Payment secured");
    expect(HIT_LINE - (file?.lines?.start ?? 0)).toBeLessThanOrEqual(5);
  });

  it("returns a short file whole", async () => {
    const body = "export const answer = 42;\n";
    const [file] = await evidenceFromPaths(["src/a.ts"], ["answer"], source({ "src/a.ts": body }));
    expect(file?.excerpt).toBe(body.trim());
  });

  it("redacts a secret before it becomes a stored excerpt", async () => {
    const body = "const dbPassword = 'hunter2';\n// deploy key AKIAIOSFODNN7EXAMPLE\n";
    const [file] = await evidenceFromPaths(["src/config.ts"], [], source({ "src/config.ts": body }));

    expect(file?.excerpt).not.toContain("hunter2");
    expect(file?.excerpt).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(file?.excerpt).toContain("[redacted]");
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

  it("never sends more than the total budget, however many long files are selected", async () => {
    const files = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`src/f${i}.ts`, "x".repeat(30_000)]));
    const found = await evidenceFromPaths(Object.keys(files), [], source(files));

    const omitted = "\n… (middle of the file omitted) …\n".length;
    const sent = found.reduce((total, file) => total + file.excerpt.length - omitted, 0);
    expect(found).toHaveLength(12);
    expect(sent).toBeLessThanOrEqual(60_000);
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
