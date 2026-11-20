import { describe, expect, it } from "vitest";
import { inlineSpans, plainInline, ticketSections } from "@/core/requirements/render";
import type { TicketDraft } from "@/core/requirements/schemas";

const draft = (overrides: Partial<TicketDraft> = {}): TicketDraft => ({
  title: "Round cart totals",
  description: [{ text: "Totals use `Math.floor`.", status: "verified", evidenceIds: ["e1"] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence: [],
  ...overrides,
});

describe("inlineSpans", () => {
  it("splits backticked identifiers into code spans", () => {
    expect(inlineSpans("Use `Math.floor` here")).toEqual([
      { text: "Use " },
      { text: "Math.floor", code: true },
      { text: " here" },
    ]);
  });

  it("leaves an unclosed or multi-line backtick as plain text", () => {
    expect(inlineSpans("a `b")).toEqual([{ text: "a `b" }]);
    expect(inlineSpans("a `b\nc`")).toEqual([{ text: "a `b\nc`" }]);
    expect(inlineSpans("``")).toEqual([{ text: "``" }]);
  });

  it("plainInline strips the backticks for a title", () => {
    expect(plainInline("Round `total` in `cart`")).toBe("Round total in cart");
  });
});

describe("ticketSections", () => {
  it("renders a description and adds each section only when it has content", () => {
    const sections = ticketSections(draft());
    expect(sections).toHaveLength(1);
    expect(sections[0]?.paragraphs).toEqual([
      { text: "Totals use `Math.floor`.", status: "verified", evidenceIds: ["e1"] },
    ]);
    expect(sections[0]?.heading).toBeUndefined();
  });

  it("marks a criterion that needs a product decision", () => {
    const sections = ticketSections(
      draft({
        acceptanceCriteria: [
          { text: "Totals round half up.", status: "inferred", evidenceIds: [], requiresProductDecision: true },
          { text: "The cart total is a number.", status: "inferred", evidenceIds: [], requiresProductDecision: false },
        ],
      }),
    );
    expect(sections[1]).toMatchObject({ heading: "Acceptance criteria" });
    expect(sections[1]?.bullets?.[0]).toEqual({
      text: "Totals round half up. (needs product decision)",
      status: "inferred",
      needsDecision: true,
    });
    expect(sections[1]?.bullets?.[1]?.needsDecision).toBeUndefined();
  });

  it("lists evidence with its line range and link, assumptions with their rationale, and open questions", () => {
    const sections = ticketSections(
      draft({
        evidence: [
          {
            id: "e1",
            kind: "code",
            reference: "src/cart.ts",
            lines: { start: 3, end: 8 },
            url: "https://github.test/a/b/blob/abc/src/cart.ts#L3-L8",
            excerpt: "Math.floor(total)",
          },
          { id: "e2", kind: "jira_issue", reference: "SHOP-1", excerpt: "Related" },
        ],
        assumptions: [{ text: "Currency is EUR", rationale: "The shop is French" }],
        openQuestions: [{ question: "Round refunds too?", impact: "Changes refunds" }],
      }),
    );

    expect(sections.map((section) => section.heading)).toEqual([
      undefined,
      "Relevant context",
      "Unverified assumptions",
      "Open questions",
    ]);
    expect(sections[1]?.bullets).toEqual([
      {
        evidenceId: "e1",
        text: "src/cart.ts:3-8",
        url: "https://github.test/a/b/blob/abc/src/cart.ts#L3-L8",
      },
      { evidenceId: "e2", text: "SHOP-1" },
    ]);
    expect(sections[3]).toMatchObject({ openQuestions: true });
    expect(sections[3]?.bullets).toEqual([{ text: "Round refunds too? — Changes refunds" }]);
  });
});
