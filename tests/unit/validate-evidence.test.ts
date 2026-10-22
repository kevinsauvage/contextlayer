import { describe, expect, it } from "vitest";
import type { Claim, Evidence } from "@/core/evidence/schemas";
import { validateEvidenceReferences } from "@/core/evidence/validate";

const evidence: Evidence[] = [{ id: "e1", kind: "code", reference: "src/PayButton.tsx", excerpt: "<button/>" }];
const claim = (overrides: Partial<Claim>): Claim => ({ text: "x", status: "verified", evidenceIds: ["e1"], ...overrides });
const validate = (c: Claim, ev = evidence) => validateEvidenceReferences(ev, { description: [c] });

describe("validateEvidenceReferences", () => {
  it("accepts references that resolve", () => expect(validate(claim({}))).toEqual([]));

  it("flags unknown evidence ids", () => expect(validate(claim({ evidenceIds: ["missing"] }))).toHaveLength(1));

  it("flags verified claims without evidence", () =>
    expect(validate(claim({ evidenceIds: [] }))[0].message).toMatch(/no evidence/));

  it("allows inferred claims without evidence", () =>
    expect(validate(claim({ status: "inferred", evidenceIds: [] }))).toEqual([]));

  it("flags duplicate evidence ids", () =>
    expect(validate(claim({}), [...evidence, ...evidence])[0].message).toMatch(/duplicate/));
});
