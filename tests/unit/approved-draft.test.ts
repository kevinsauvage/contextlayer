import { describe, expect, it } from "vitest";
import type { Evidence } from "@/core/evidence/schemas";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import {
  readAnalysis,
  revisionChange,
  runSummary,
  canRefineAnalysis,
  storedDraft,
  storedEvidence,
} from "@/features/analysis/read";
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
  it("refuses an edited draft with an oversized entry or section", () => {
    const claim = { text: "Fine", status: "inferred", evidenceIds: [] };

    expect(
      parseApprovedDraft(draft({ description: [{ ...claim, text: "x".repeat(4001) }] }), evidence, "Invalid"),
    ).toEqual({ error: "Keep each entry under 4,000 characters" });
    expect(
      parseApprovedDraft(draft({ description: Array.from({ length: 101 }, () => claim) }), evidence, "Invalid"),
    ).toEqual({ error: "Keep each section to 100 items" });
  });

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

describe("readAnalysis on audits and malformed rows", () => {
  const e2: Evidence = {
    id: "e2",
    kind: "code",
    reference: "src/checkout/total.ts",
    url: "https://github.test/acme/shop/blob/abc123/src/checkout/total.ts#L1-L2",
    excerpt: "export const total = (lines) => sum(lines);",
  };
  const { evidence: _, ...proposedTicket } = draft();
  const report = (overrides: Record<string, unknown> = {}) => ({
    summary: "Gaps found.",
    findings: [],
    proposedTicket,
    evidence: [...evidence, e2],
    ...overrides,
  });
  const audit = (row: Record<string, unknown>) =>
    ({ kind: "audit", input: { issueKey: "CHK-9" }, editedResult: null, ...row }) as unknown as Analysis;

  it("shows the audit proposal with only the report sources it cites", () => {
    const read = readAnalysis(audit({ result: report() }));

    expect(read.report?.evidence).toHaveLength(2);
    expect(read.draft?.evidence).toEqual(evidence);
    expect(read.input).toEqual({ kind: "audit", issueKey: "CHK-9" });
    expect(storedEvidence(audit({ result: report() }))).toEqual([...evidence, e2]);
  });

  it("ignores evidence forged in an edited audit proposal", () => {
    const forged = [{ ...evidence[0], excerpt: "A claim the code does not make", url: "https://evil.test" }];
    const read = readAnalysis(audit({ result: report(), editedResult: draft({ evidence: forged }) }));

    expect(read.draft?.evidence).toEqual(evidence);
  });

  it("shows no report and no draft for an audit result that no longer parses", () => {
    const { findings: _findings, ...withoutFindings } = report();
    const row = audit({ result: withoutFindings });

    expect(readAnalysis(row)).toMatchObject({ report: null, draft: null });
    expect(storedEvidence(row)).toEqual([]);
  });

  it("shows no draft for a create result that no longer parses", () => {
    const row = { kind: "create", input: { request: "x" }, result: { title: 1 }, editedResult: null };

    expect(readAnalysis(row as unknown as Analysis)).toMatchObject({ draft: null, report: null });
  });

  it("reads no input when the stored input does not match the kind", () => {
    expect(readAnalysis(audit({ input: { request: "x" }, result: report() })).input).toBeNull();
    expect(
      readAnalysis({
        kind: "create",
        input: { issueKey: "CHK-9" },
        result: draft(),
        editedResult: null,
      } as unknown as Analysis).input,
    ).toBeNull();
  });
});

describe("storedDraft", () => {
  it("reads an unedited audit's proposed ticket with the report's evidence, so the badge sees its open questions", () => {
    const { evidence: _, ...proposedTicket } = draft({
      openQuestions: [{ question: "Which currency?", impact: "Changes rounding." }],
    });
    const row = {
      kind: "audit",
      result: { summary: "Gaps found.", findings: [], proposedTicket, evidence },
      editedResult: null,
    } as unknown as Analysis;

    expect(storedDraft(row)?.openQuestions).toHaveLength(1);
  });
});

describe("revisionChange", () => {
  it("reports a moved commit in short form, and nothing when either side is unknown or equal", () => {
    expect(revisionChange({ sourceRevision: "bbbbbbb2222", previousSourceRevision: "aaaaaaa1111" })).toEqual({
      from: "aaaaaaa",
      to: "bbbbbbb",
    });
    expect(revisionChange({ sourceRevision: "aaaaaaa1111", previousSourceRevision: "aaaaaaa1111" })).toBeNull();
    expect(revisionChange({ sourceRevision: "aaaaaaa1111", previousSourceRevision: null })).toBeNull();
    expect(revisionChange({ sourceRevision: null, previousSourceRevision: "aaaaaaa1111" })).toBeNull();
  });
});

describe("runSummary", () => {
  type Run = Parameters<typeof runSummary>[0];
  const run = (overrides: Partial<Run> = {}): Run => ({
    status: "completed",
    model: "deepseek-flash",
    latencyMs: 12_345,
    inputTokens: 1_000,
    outputTokens: 500,
    sourceRevision: "abcdef1234567890",
    ...overrides,
  });

  it("lists the model, latency, tokens, derived cost and short commit of a completed run", () => {
    expect(runSummary(run())).toBe("deepseek-flash · 12.3s · 1000 in / 500 out tokens · $0.0004 · commit abcdef1");
  });

  it("adds the derived cost when the model is priced", () => {
    // deepseek-flash is $0.15 / $0.60 per million tokens.
    expect(runSummary(run())).toContain("$0.0004");
  });

  it("omits the cost for an unlisted model", () => {
    expect(runSummary(run({ model: "unknown/model" }))).not.toContain("$");
  });

  it("shows zero tokens when a run did not report any, and no commit when none is stored", () => {
    expect(runSummary(run({ inputTokens: null, outputTokens: null, sourceRevision: null }))).toBe(
      "deepseek-flash · 12.3s · 0 in / 0 out tokens",
    );
  });

  it("prints nothing for a run that is not completed", () => {
    expect(runSummary(run({ status: "running" }))).toBeNull();
    expect(runSummary(run({ status: "failed" }))).toBeNull();
  });
});

describe("canRefineAnalysis", () => {
  it("allows a draft that is completed or failed and not published", () => {
    expect(canRefineAnalysis({ kind: "create", status: "completed", publishedIssueKey: null })).toBe(true);
    expect(canRefineAnalysis({ kind: "create", status: "failed", publishedIssueKey: null })).toBe(true);
  });

  it("refuses a published draft, a running one and an audit", () => {
    expect(canRefineAnalysis({ kind: "create", status: "completed", publishedIssueKey: "SHOP-1" })).toBe(false);
    expect(canRefineAnalysis({ kind: "create", status: "running", publishedIssueKey: null })).toBe(false);
    expect(canRefineAnalysis({ kind: "audit", status: "completed", publishedIssueKey: null })).toBe(false);
  });
});
