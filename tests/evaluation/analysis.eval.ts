import { describe, expect, it } from "vitest";
import { draftCase, recordVerdict } from "./draft-case";
import { loadEvaluationCases } from "./fixtures";
import { judgeVerdict } from "./judge";

const hasModel = Boolean(process.env.AI_GATEWAY_API_KEY) || Boolean(process.env.AI_BASE_URL);

describe.skipIf(!hasModel)("analysis evaluation", () => {
  const cases = loadEvaluationCases().filter((c) => c.answers.length === 0);

  it.each(cases.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const run = await draftCase(c);
    expect(run.result.issues).toEqual([]);

    const verdict = await judgeVerdict(c, run.text);
    recordVerdict(c, verdict);
    expect(verdict.forbiddenClaims, verdict.rationale).toEqual([]);
    expect(verdict.uncertainMarkedVerified, verdict.rationale).toEqual([]);
  });
});
