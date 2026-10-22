import { describe, expect, it } from "vitest";
import { validateEvidenceReferences } from "@/core/evidence/validate";
import { ticketDraftSchema } from "@/core/requirements/schemas";

const base = ticketDraftSchema.parse({
  title: "Improve checkout accessibility",
  description: [{ text: "The pay button has no accessible name.", status: "verified", evidenceIds: ["e1"] }],
  acceptanceCriteria: [],
  evidence: [{ id: "e1", kind: "code", reference: "src/checkout/PayButton.tsx", excerpt: "<button><Icon /></button>" }],
  assumptions: [],
  openQuestions: [],
});

describe("validateEvidenceReferences", () => {
  it("accepts a draft whose references resolve", () => {
    expect(validateEvidenceReferences(base)).toEqual([]);
  });

  it("flags unknown evidence ids", () => {
    const draft = { ...base, description: [{ ...base.description[0], evidenceIds: ["missing"] }] };
    expect(validateEvidenceReferences(draft)).toHaveLength(1);
  });

  it("flags verified claims without evidence", () => {
    const draft = { ...base, description: [{ text: "x", status: "verified" as const, evidenceIds: [] }] };
    expect(validateEvidenceReferences(draft)[0].message).toMatch(/no evidence/);
  });

  it("allows inferred claims without evidence", () => {
    const draft = { ...base, description: [{ text: "x", status: "inferred" as const, evidenceIds: [] }] };
    expect(validateEvidenceReferences(draft)).toEqual([]);
  });
});
