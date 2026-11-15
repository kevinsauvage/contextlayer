import { describe, expect, it } from "vitest";
import { isFollowUp } from "@/core/requirements/schemas";
import { missingMarkers, presentMarkers, requirementsText } from "./checks";
import { bannedSubstrings, claimsOf, draftCase, recordVerdict, uncitedRelevantFiles } from "./draft-case";
import { loadEvaluationCases } from "./fixtures";
import { judgeVerdict, verdictProblems } from "./judge";
import { matchesQuestion } from "./questions";

const hasModel = Boolean(process.env.AI_GATEWAY_API_KEY) || Boolean(process.env.AI_BASE_URL);

describe.skipIf(!hasModel)("clarification evaluation", () => {
  const cases = loadEvaluationCases().filter((c) => c.answers.length > 0);

  it.each(cases.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const run = await draftCase(c);
    expect(run.kind).toBe("create");
    if (run.kind !== "create") return;
    expect(run.result.issues).toEqual([]);
    expect(uncitedRelevantFiles(c, run), "every relevant file is cited").toEqual([]);

    // Only what the ticket asks for counts: the whole draft also holds evidence excerpts, assumptions and open
    // questions, where a superseded answer may be quoted without having been applied.
    const requirements = requirementsText(claimsOf(run));
    expect(missingMarkers(requirements, c.expected.appliedAnswers), "appliedAnswers").toEqual([]);
    expect(presentMarkers(requirements, c.expected.rejectedAnswers), "rejectedAnswers").toEqual([]);

    expect(bannedSubstrings(c, run), "mustNotContain").toEqual([]);

    for (const refinement of c.answers) {
      if (isFollowUp(refinement)) continue;
      const stillOpen = run.result.draft.openQuestions.some((open) =>
        matchesQuestion(refinement.question, open.question),
      );
      // A blank answer leaves the question open; an answered one must not come back.
      expect(stillOpen, refinement.question).toBe(!refinement.answer);
    }

    const verdict = await judgeVerdict(c, run.text);
    recordVerdict(c, verdict);
    expect(verdictProblems(verdict), verdict.rationale).toEqual([]);
  });
});
