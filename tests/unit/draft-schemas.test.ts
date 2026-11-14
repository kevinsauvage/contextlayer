import { describe, expect, it } from "vitest";
import {
  boundRefinements,
  MAX_REFINEMENT_CHARS,
  MAX_REFINEMENTS,
  withoutIncompleteItems,
  type TicketDraft,
} from "@/core/requirements/schemas";

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

describe("boundRefinements", () => {
  it("keeps the newest turns and drops the oldest past the count cap", () => {
    const many = Array.from({ length: MAX_REFINEMENTS + 5 }, (_, index) => ({ message: `m${index}` }));

    const kept = boundRefinements(many);

    expect(kept).toHaveLength(MAX_REFINEMENTS);
    expect(kept[0]).toEqual({ message: "m5" });
    expect(kept.at(-1)).toEqual({ message: `m${MAX_REFINEMENTS + 4}` });
  });

  it("drops an older turn that would push the history past the character cap", () => {
    const older = { message: "a".repeat(12_000) };
    const newest = { message: "b".repeat(12_000) };

    expect(boundRefinements([older, newest])).toEqual([newest]);
    expect(older.message.length + newest.message.length).toBeGreaterThan(MAX_REFINEMENT_CHARS);
  });
});
