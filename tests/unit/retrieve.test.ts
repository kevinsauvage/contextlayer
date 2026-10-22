import { describe, expect, it } from "vitest";
import { extractTerms, retrieveFileEvidence } from "@/core/context/retrieve";
import { DirectorySource } from "@/integrations/filesystem/directory-source";
import { loadEvaluationCases } from "../evaluation/fixtures";

describe("extractTerms", () => {
  it("drops stopwords and short words and dedupes", () => {
    expect(extractTerms("Improve the checkout checkout UI")).toEqual(["checkout"]);
  });

  it("keeps the most frequent terms when capped", () => {
    expect(extractTerms("alpha beta beta gamma gamma gamma", 2)).toEqual(["gamma", "beta"]);
  });
});

describe("retrieveContext on fixtures", () => {
  it.each(loadEvaluationCases().map((c) => [c.id, c] as const))("%s: finds at least one expected file", async (_id, c) => {
    const found = await retrieveFileEvidence(extractTerms(c.title), new DirectorySource(c.repoDir));
    const references = found.map((e) => `repo/${e.reference}`);
    expect(c.expected.relevantFiles.some((f) => references.includes(f))).toBe(true);
  });

  it("returns an empty list when nothing matches", async () => {
    const [c] = loadEvaluationCases();
    expect(await retrieveFileEvidence(extractTerms("zzzxqy"), new DirectorySource(c.repoDir))).toEqual([]);
  });
});
