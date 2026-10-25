import { describe, expect, it } from "vitest";
import type { Evidence } from "@/core/evidence/schemas";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { readAnalysis } from "@/features/analysis/read";
import type { Analysis } from "@/features/projects/queries";

const evidence: Evidence[] = [
  {
    id: "e1",
    kind: "code",
    reference: "src/checkout/PayButton.tsx",
    url: "https://github.test/acme/shop/blob/abc123/src/checkout/PayButton.tsx#L1-L2",
    excerpt: "<button><Icon /></button>",
  },
];

const draft = (overrides: Record<string, unknown> = {}) => ({
  title: "Round cart totals",
  description: [{ text: "The pay button has no accessible name.", status: "verified", evidenceIds: ["e1"] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence,
  ...overrides,
});

describe("parseApprovedDraft", () => {
  it("rebuilds evidence from the server copy, so a forged excerpt is not published", () => {
    const forged = [{ ...evidence[0], excerpt: "A claim the code does not make", url: "https://evil.test" }];
    const parsed = parseApprovedDraft(draft({ evidence: forged }), evidence, "The draft is invalid");

    expect(parsed).toEqual({ draft: { ...draft(), evidence } });
  });

  it("rejects a citation the stored result does not hold", () => {
    const parsed = parseApprovedDraft(
      draft({ description: [{ text: "Unsupported.", status: "verified", evidenceIds: ["e99"] }] }),
      evidence,
      "The draft is invalid",
    );

    expect(parsed).toEqual({
      error:
        "Description paragraph 1 cites evidence e99, which is not in the evidence list. Fix it in Edit, then approve again.",
    });
  });

  it("reports the schema message for a title Jira would refuse", () => {
    const parsed = parseApprovedDraft(draft({ title: "x".repeat(256) }), evidence, "The draft is invalid");

    expect(parsed).toEqual({ error: "Keep the title under 255 characters" });
  });
});

describe("readAnalysis", () => {
  it("previews only the stored sources the edited claims still cite, as publishing does", () => {
    const edited = draft({
      description: [{ text: "Rewritten without a source.", status: "inferred", evidenceIds: [] }],
    });
    const row = {
      kind: "create",
      input: { request: "x" },
      result: draft(),
      editedResult: edited,
    } as unknown as Analysis;

    expect(readAnalysis(row).draft?.evidence).toEqual([]);
    expect(parseApprovedDraft(edited, evidence, "invalid")).toMatchObject({ draft: { evidence: [] } });
  });
});
