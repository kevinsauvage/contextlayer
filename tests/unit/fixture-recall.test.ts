import { describe, expect, it } from "vitest";
import { gatherContext } from "@/core/context/gather";
import { loadEvaluationCases, requestOf, sourceOf, trackerOf } from "../evaluation/fixtures";

// Retrieval runs here without a model, so every fixture's expected files are checked on each test run, not only in
// evals. A case records what it is known to miss (expansion usually finds it); any other miss is a regression.
describe("fixture retrieval recall", () => {
  it.each(loadEvaluationCases().map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const query = c.kind === "audit" && c.issue ? `${c.issue.summary} ${c.issue.description}` : requestOf(c);
    const { evidence } = await gatherContext({
      query,
      source: await sourceOf(c),
      tracker: trackerOf(c),
      excludeIssueKey: c.issue?.key,
    });
    const retrieved = new Set(evidence.map((item) => `repo/${item.reference}`));
    const missed = c.expected.relevantFiles.filter((file) => !retrieved.has(file));

    expect(missed.sort()).toEqual([...c.expected.knownMisses].sort());
  });
});
