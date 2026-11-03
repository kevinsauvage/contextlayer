import { describe, expect, it } from "vitest";
import { draftReadiness } from "@/core/requirements/readiness";
import type { TicketDraft } from "@/core/requirements/schemas";

const draft = (overrides: Partial<TicketDraft> = {}): TicketDraft => ({
  title: "Round cart totals",
  description: [],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence: [],
  ...overrides,
});

describe("draftReadiness", () => {
  it("counts nothing for a settled draft", () => {
    expect(draftReadiness(draft())).toEqual({ openQuestions: 0, needsClarification: 0, labelled: 0 });
  });

  it("counts open questions, undecided claims and labelled claims in both sections", () => {
    const readiness = draftReadiness(
      draft({
        description: [
          { text: "Undecided", status: "needs_clarification", evidenceIds: [] },
          { text: "Inferred", status: "inferred", evidenceIds: [] },
        ],
        acceptanceCriteria: [
          { text: "Unknown", status: "unknown", evidenceIds: [], requiresProductDecision: false },
          { text: "Undecided too", status: "needs_clarification", evidenceIds: [], requiresProductDecision: true },
        ],
        openQuestions: [{ question: "Which code?", impact: "Changes the contract" }],
      }),
    );

    expect(readiness).toEqual({ openQuestions: 1, needsClarification: 2, labelled: 2 });
  });
});
