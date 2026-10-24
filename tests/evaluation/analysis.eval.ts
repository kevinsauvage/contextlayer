import { describe, expect, it } from "vitest";
import { draftCase } from "./draft-case";
import { loadEvaluationCases } from "./fixtures";

describe.skipIf(!process.env.AI_GATEWAY_API_KEY && !process.env.AI_BASE_URL)("analysis evaluation", () => {
  it.each(loadEvaluationCases().map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const result = await draftCase(c);
    expect(result.issues).toEqual([]);
  });
});
