import { describe, expect, it } from "vitest";
import { analyzeTitle, auditIssue } from "@/core/analysis/analyze";
import type { AuditGenerator, DraftGenerator } from "@/core/analysis/generators";
import type { AuditBody } from "@/core/audit/schemas";
import type { ContextSource, IssueTracker } from "@/core/context/source";
import type { DraftBody } from "@/core/requirements/schemas";
import { noIssues } from "../helpers/fakes";

const source: ContextSource = {
  listFiles: async () => ["src/checkout/PayButton.tsx", "src/other.ts"],
  readFile: async (path) => (path.includes("PayButton") ? "<button><Icon /></button>" : "unrelated"),
};

const tracker: IssueTracker = {
  ...noIssues,
  searchRelated: async () => [
    { key: "CHK-7", summary: "Pay button label", description: "", status: "Done", url: "https://jira.test/browse/CHK-7" },
  ],
  getIssue: async (key) => ({ key, summary: "Checkout button", description: "make it nicer", status: "To Do", url: "u" }),
};

const body = (evidenceIds: string[]): DraftBody => ({
  title: "Improve checkout accessibility",
  description: [{ text: "Pay button has no accessible name.", status: "verified", evidenceIds }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
});

const drafting = (b: DraftBody): DraftGenerator => ({ generate: async () => ({ body: b }) });

describe("analyzeTitle", () => {
  const run = (b: DraftBody) => analyzeTitle({ title: "checkout button", source, tracker, generator: drafting(b) });

  it("attaches only cited candidates as evidence", async () => {
    const result = await run(body(["e1"]));
    expect(result.draft.evidence.map((e) => e.reference)).toEqual(["src/checkout/PayButton.tsx"]);
    expect(result.issues).toEqual([]);
  });

  it("includes related Jira issues as candidates", async () => {
    const result = await run(body(["e1"]));
    expect(result.candidates.map((c) => c.kind)).toEqual(["code", "jira_issue"]);
  });

  it("reports evidence the generator invented", async () => {
    const result = await run(body(["e99"]));
    expect(result.issues).toEqual([{ path: "description[0]", message: 'unknown evidence id "e99"' }]);
  });

  it("flags a verified claim that cites nothing", async () => {
    expect((await run(body([]))).issues[0]?.message).toMatch(/no evidence/);
  });
});

describe("auditIssue", () => {
  const auditBody = (findingEvidence: string[]): AuditBody => ({
    summary: "Vague ticket",
    findings: [{ text: "Existing label work in CHK-7", status: "verified", evidenceIds: findingEvidence, category: "existing_implementation_or_duplicate" }],
    proposedTicket: body(["e1"]),
  });
  const run = (b: AuditBody) =>
    auditIssue({ issueKey: "CHK-9", source, tracker, generator: { audit: async () => ({ body: b }) } satisfies AuditGenerator });

  it("collects evidence cited by findings and the proposed ticket", async () => {
    const result = await run(auditBody(["e2"]));
    expect(result.report.evidence.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(result.issues).toEqual([]);
  });

  it("validates finding evidence", async () => {
    expect((await run(auditBody([]))).issues[0]).toEqual({ path: "findings[0]", message: "verified claim has no evidence" });
  });
});
