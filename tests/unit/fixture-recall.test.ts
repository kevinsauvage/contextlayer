import { describe, expect, it } from "vitest";
import { gatherContext } from "@/core/context/gather";
import { DirectorySource } from "@/integrations/filesystem/directory-source";
import { loadEvaluationCases, requestOf, trackerOf } from "../evaluation/fixtures";

// Files retrieval is known to miss, each tracked in TODO-FEATURE.md; anything else missing is a regression.
const KNOWN_MISSES: Record<string, string[]> = {
  // This test runs without a model, so it cannot use the expansion that finds the mailer.
  "password-reset": ["repo/src/mail/send.ts"],
};

// Retrieval runs without a model, so every fixture's expected files are checked on each test run, not only in evals.
describe("fixture retrieval recall", () => {
  it.each(loadEvaluationCases().map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const query = c.kind === "audit" && c.issue ? `${c.issue.summary} ${c.issue.description}` : requestOf(c);
    const { evidence } = await gatherContext({
      query,
      source: new DirectorySource(c.repoDir),
      tracker: trackerOf(c),
      excludeIssueKey: c.issue?.key,
    });
    const retrieved = new Set(evidence.map((item) => `repo/${item.reference}`));

    expect(c.expected.relevantFiles.filter((file) => !retrieved.has(file))).toEqual(KNOWN_MISSES[c.id] ?? []);
  });
});
