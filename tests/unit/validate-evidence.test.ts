import { describe, expect, it } from "vitest";
import type { Claim, Evidence } from "@/core/evidence/schemas";
import { validateEvidenceReferences } from "@/core/evidence/validate";

const evidence: Evidence[] = [{ id: "e1", kind: "code", reference: "src/PayButton.tsx", excerpt: "<button/>" }];
const claim = (overrides: Partial<Claim>): Claim => ({
  text: "x",
  status: "verified",
  evidenceIds: ["e1"],
  ...overrides,
});
const validate = (c: Claim, ev = evidence) => validateEvidenceReferences(ev, { description: [c] });

describe("validateEvidenceReferences", () => {
  it("accepts references that resolve", () => expect(validate(claim({}))).toEqual([]));

  it("flags unknown evidence ids", () => expect(validate(claim({ evidenceIds: ["missing"] }))).toHaveLength(1));

  it("flags verified claims without evidence", () =>
    expect(validate(claim({ evidenceIds: [] }))[0]?.message).toBe(
      "Description paragraph 1 is marked Verified but cites no evidence.",
    ));

  it("allows inferred claims without evidence", () =>
    expect(validate(claim({ status: "inferred", evidenceIds: [] }))).toEqual([]));

  it("flags a verified claim that quotes an identifier its evidence lacks", () => {
    const [issue] = validate(claim({ text: "`PayButton` calls `chargeCard`." }), [
      { id: "e1", kind: "code", reference: "src/PayButton.tsx", excerpt: "export const PayButton = () => null;" },
    ]);
    expect(issue?.message).toBe(
      'Description paragraph 1 is marked Verified but quotes "chargecard", which its cited evidence does not contain.',
    );
  });

  it("accepts quotes found in the excerpt or the file path, ignoring case and spacing", () =>
    expect(
      validate(claim({ text: 'The label reads "Pay  now" in `src/paybutton.tsx`.' }), [
        { id: "e1", kind: "code", reference: "src/PayButton.tsx", excerpt: "<button>pay now</button>" },
      ]),
    ).toEqual([]));

  it("does not check quotes in claims that are not verified", () =>
    expect(validate(claim({ status: "inferred", text: "Probably `missingThing`." }))).toEqual([]));

  it("flags duplicate evidence ids", () =>
    expect(validate(claim({}), [...evidence, ...evidence])[0]?.message).toMatch(/listed twice/));
});
