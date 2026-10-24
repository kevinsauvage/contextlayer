import { describe, expect, it } from "vitest";
import { isFollowUp } from "@/core/requirements/schemas";
import { draftCase, recordVerdict } from "./draft-case";
import { loadEvaluationCases } from "./fixtures";
import { judgeVerdict } from "./judge";
import { matchesQuestion } from "./questions";

const hasModel = Boolean(process.env.AI_GATEWAY_API_KEY) || Boolean(process.env.AI_BASE_URL);

describe.skipIf(!hasModel)("clarification evaluation", () => {
  const cases = loadEvaluationCases().filter((c) => c.answers.length > 0);

  it.each(cases.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const run = await draftCase(c);
    expect(run.kind).toBe("create");
    if (run.kind !== "create") return;
    expect(run.result.issues).toEqual([]);

    const text = JSON.stringify(run.result.draft).toLowerCase();
    for (const marker of c.expected.appliedAnswers) expect(text).toContain(marker.toLowerCase());

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
    expect(verdict.forbiddenClaims, verdict.rationale).toEqual([]);
    expect(verdict.uncertainMarkedVerified, verdict.rationale).toEqual([]);
  });
});
