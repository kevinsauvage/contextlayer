import { describe, expect, it } from "vitest";
import { ticketSections } from "@/core/requirements/render";
import type { TicketDraft } from "@/core/requirements/schemas";
import { adfToText, sectionsToAdf } from "@/integrations/jira/adf";

const draft: TicketDraft = {
  title: "Improve checkout accessibility",
  description: [
    { text: "Pay button has no accessible name.", status: "verified", evidenceIds: ["e1"] },
    { text: "Scope is the whole checkout.", status: "needs_clarification", evidenceIds: [] },
  ],
  acceptanceCriteria: [
    { text: "Pay button is announced as 'Pay'.", status: "inferred", evidenceIds: [], requiresProductDecision: true },
  ],
  assumptions: [{ text: "WCAG 2.1 AA applies", rationale: "Docs mention it only for marketing pages" }],
  openQuestions: [{ question: "Full audit or only listed components?", impact: "Changes scope" }],
  evidence: [
    {
      id: "e1",
      kind: "code",
      reference: "src/PayButton.tsx",
      url: "https://github.com/o/r/blob/main/src/PayButton.tsx",
      lines: { start: 1, end: 9 },
      excerpt: "<button/>",
    },
  ],
};

describe("ticket rendering", () => {
  const sections = ticketSections(draft);

  it("labels anything that is not verified", () => {
    expect(sections[0]?.paragraphs).toEqual([
      { status: "verified", text: "Pay button has no accessible name.", evidenceIds: ["e1"] },
      { status: "needs_clarification", text: "Scope is the whole checkout." },
    ]);
    expect(sections[1]?.bullets).toEqual([
      { status: "inferred", text: "Pay button is announced as 'Pay'. (needs product decision)", needsDecision: true },
    ]);
  });

  it("links evidence and keeps assumptions and questions", () => {
    expect(sections.map((s) => s.heading)).toEqual([
      undefined,
      "Acceptance criteria",
      "Relevant context",
      "Unverified assumptions",
      "Open questions",
    ]);
    expect(sections[2]?.bullets).toEqual([
      { evidenceId: "e1", text: "src/PayButton.tsx:1-9", url: "https://github.com/o/r/blob/main/src/PayButton.tsx" },
    ]);
  });
});

describe("ADF", () => {
  it("produces a valid document with link marks", () => {
    const doc = sectionsToAdf(ticketSections(draft));
    expect(doc).toMatchObject({ type: "doc", version: 1 });
    expect(JSON.stringify(doc)).toContain('"type":"link"');
  });

  it("round-trips to readable text", () => {
    const text = adfToText(sectionsToAdf(ticketSections(draft)));
    expect(text).toContain("Pay button has no accessible name. [e1]");
    expect(text).toContain("- [e1] src/PayButton.tsx:1-9");
    expect(text).toContain("- Inferred: Pay button is announced");
  });

  it("renders backtick spans as inline code", () => {
    const doc = sectionsToAdf([{ paragraphs: [{ text: "Rename `PayButton` now" }] }]);
    expect(doc.content[0]?.content).toEqual([
      { type: "text", text: "Rename " },
      { type: "text", text: "PayButton", marks: [{ type: "code" }] },
      { type: "text", text: " now" },
    ]);
  });

  it("tolerates empty or missing descriptions", () => {
    expect(adfToText(null)).toBe("");
    expect(adfToText({ type: "doc", content: [] })).toBe("");
  });
});
