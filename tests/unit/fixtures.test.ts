import { describe, expect, it } from "vitest";
import { fileExists, loadEvaluationCases } from "../evaluation/fixtures";

const cases = loadEvaluationCases();

describe("evaluation fixtures", () => {
  it("has at least four cases with unique ids matching their directory", () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) expect(c.dir.endsWith(c.id)).toBe(true);
  });

  it.each(cases.map((c) => [c.id, c] as const))("%s: expected files exist", (_id, c) => {
    for (const file of c.expected.relevantFiles) expect(fileExists(c, file), file).toBe(true);
  });
});
