import { describe, expect, it } from "vitest";
import { withoutIncompleteItems, type TicketDraft } from "@/core/requirements/schemas";

const claim = (text: string) => ({ text, status: "inferred" as const, evidenceIds: [] });

describe("withoutIncompleteItems", () => {
  it("drops the blank items a new row starts with and keeps every finished one", () => {
    const draft: TicketDraft = {
      title: "Round cart totals",
      description: [claim("Totals are rounded down."), claim("  ")],
      acceptanceCriteria: [{ ...claim(""), requiresProductDecision: false }],
      assumptions: [
        { text: "Prices include tax", rationale: "The cart shows one total" },
        { text: "Half-filled", rationale: " " },
      ],
      openQuestions: [
        { question: "Half up or half even?", impact: "Changes totals" },
        { question: "", impact: "" },
      ],
      evidence: [],
    };

    expect(withoutIncompleteItems(draft)).toEqual({
      ...draft,
      description: [claim("Totals are rounded down.")],
      acceptanceCriteria: [],
      assumptions: [{ text: "Prices include tax", rationale: "The cart shows one total" }],
      openQuestions: [{ question: "Half up or half even?", impact: "Changes totals" }],
    });
  });
});
