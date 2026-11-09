import { describe, expect, it } from "vitest";
import { bannedSubstrings, claimsOf, draftCase, recordVerdict, uncitedRelevantFiles } from "./draft-case";
import { loadEvaluationCases } from "./fixtures";
import { judgeVerdict, verdictProblems } from "./judge";

const hasModel = Boolean(process.env.AI_GATEWAY_API_KEY) || Boolean(process.env.AI_BASE_URL);

describe.skipIf(!hasModel)("analysis evaluation", () => {
  // Audits have no answers, so they belong here too; retrieval cases stop at recall.
  const cases = loadEvaluationCases().filter((c) => c.kind !== "retrieval" && c.answers.length === 0);

  it.each(cases.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const run = await draftCase(c);
    expect(run.result.issues).toEqual([]);
    expect(uncitedRelevantFiles(c, run), "every relevant file is cited").toEqual([]);
    expect(bannedSubstrings(c, run), "mustNotContain").toEqual([]);

    // An ambiguous request must end in questions, not a guessed scope.
    if (c.tags.includes("ambiguous")) {
      expect(run.kind).toBe("create");
      if (run.kind !== "create") return;
      const { draft } = run.result;
      expect(draft.openQuestions.length, "open questions").toBeGreaterThanOrEqual(1);
      expect(
        claimsOf(run).some((claim) => claim.status === "needs_clarification" || claim.status === "unknown"),
        "a claim that needs a person",
      ).toBe(true);
      expect(
        draft.acceptanceCriteria.every((criterion) => criterion.status !== "verified"),
        "no acceptance criterion is verified",
      ).toBe(true);
    }

    // A ticket that cites code which no longer exists must be reported as a conflict, not copied into the proposal.
    if (c.tags.includes("renamed-refund")) {
      expect(run.kind).toBe("audit");
      if (run.kind !== "audit") return;
      const { findings, proposedTicket, evidence } = run.result.report;
      const citesRefunds = (finding: (typeof findings)[number]) =>
        finding.category === "conflict_with_code" &&
        finding.status === "verified" &&
        finding.evidenceIds.some(
          (id) => evidence.find((item) => item.id === id)?.reference === "src/payments/refunds.ts",
        );
      expect(findings.some(citesRefunds), "a verified conflict citing src/payments/refunds.ts").toBe(true);

      // Open questions and assumptions may name the old code to ask whether it was renamed; the instructions may not.
      const { title, description, acceptanceCriteria } = proposedTicket;
      const proposed = JSON.stringify({ title, description, acceptanceCriteria }).toLowerCase();
      expect(proposed, "proposed title, description and criteria").not.toContain("src/billing/refund.ts");
      expect(proposed, "proposed title, description and criteria").not.toContain("calculaterefund");
    }

    const verdict = await judgeVerdict(c, run.text);
    recordVerdict(c, verdict);
    expect(verdictProblems(verdict), verdict.rationale).toEqual([]);
  });
});
