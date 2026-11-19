import { describe, expect, it } from "vitest";
import { withEditedText } from "@/core/evidence/edit";
import type { Claim } from "@/core/evidence/schemas";

const verified: Claim = { text: "Totals are rounded down.", status: "verified", evidenceIds: ["e1"] };

describe("withEditedText", () => {
  it("makes a rewritten Verified claim Inferred and keeps its citations", () => {
    expect(withEditedText(verified, "Totals are rounded up.")).toEqual({
      text: "Totals are rounded up.",
      status: "inferred",
      evidenceIds: ["e1"],
    });
  });

  it("keeps the status when the text is unchanged", () => {
    expect(withEditedText(verified, verified.text)).toBe(verified);
  });

  it("keeps any other status", () => {
    const open: Claim = { ...verified, status: "needs_clarification" };
    expect(withEditedText(open, "Round half up.").status).toBe("needs_clarification");
  });

  it("keeps the fields of a richer claim", () => {
    const criterion = { ...verified, requiresProductDecision: false };
    expect(withEditedText(criterion, "Other.")).toMatchObject({ requiresProductDecision: false, status: "inferred" });
  });
});
