import { describe, expect, it } from "vitest";
import { auditIssue, draftTicket } from "@/core/analysis/analyze";
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
    {
      key: "CHK-7",
      summary: "Pay button label",
      description: "",
      status: "Done",
      url: "https://jira.test/browse/CHK-7",
    },
  ],
  getIssue: async (key) => ({
    key,
    summary: "Checkout button",
    description: "make it nicer",
    status: "To Do",
    url: "u",
  }),
};

const body = (evidenceIds: string[]): DraftBody => ({
  title: "Improve checkout accessibility",
  description: [{ text: "Pay button has no accessible name.", status: "verified", evidenceIds }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
});

const drafting = (b: DraftBody): DraftGenerator => ({ generate: async () => ({ body: b }) });

it("reports the revision the source read", async () => {
  const pinned: ContextSource = { ...source, revision: "abc123" };
  const result = await draftTicket({
    request: "checkout button",
    source: pinned,
    tracker,
    generator: drafting(body([])),
  });

  expect(result.revision).toBe("abc123");
});

describe("draftTicket", () => {
  const run = (b: DraftBody) => draftTicket({ request: "checkout button", source, tracker, generator: drafting(b) });

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
    expect(result.issues).toEqual([
      {
        path: "description[0]",
        message: "Description paragraph 1 cites evidence e99, which is not in the evidence list.",
      },
    ]);
  });

  it("flags a verified claim that cites nothing", async () => {
    expect((await run(body([]))).issues[0]?.message).toMatch(/cites no evidence/);
  });

  it("merges expanded search terms and bills their tokens with the draft", async () => {
    const mailer: ContextSource = {
      listFiles: async () => ["src/mailer.ts"],
      readFile: async () => "export function sendMailer() {}",
    };
    const generator: DraftGenerator = {
      generate: async () => ({ body: body([]), usage: { inputTokens: 100, outputTokens: 50 } }),
    };
    const expander = {
      expandTerms: async () => ({ terms: ["mailer"], usage: { inputTokens: 10, outputTokens: 4 } }),
    };

    const result = await draftTicket({ request: "password reset", source: mailer, tracker, generator, expander });

    expect(result.candidates.map((candidate) => candidate.reference)).toContain("src/mailer.ts");
    expect(result.usage).toEqual({ inputTokens: 110, outputTokens: 54 });
  });
});

describe("draftTicket when a helper step fails", () => {
  const generator: DraftGenerator = { generate: async () => ({ body: body([]) }) };

  it("falls back to the request's own terms when query expansion throws", async () => {
    const expander = {
      expandTerms: async (): Promise<never> => {
        throw new Error("no object generated");
      },
    };
    const result = await draftTicket({ request: "checkout button", source, tracker, generator, expander });
    expect(result.candidates.map((candidate) => candidate.reference)).toContain("src/checkout/PayButton.tsx");
  });

  it("continues without related issues when the tracker search throws", async () => {
    const failing: IssueTracker = {
      ...tracker,
      searchRelated: async () => {
        throw new Error("jira down");
      },
    };
    const result = await draftTicket({ request: "checkout button", source, tracker: failing, generator });
    expect(result.candidates.some((candidate) => candidate.kind === "jira_issue")).toBe(false);
    expect(result.candidates.length).toBeGreaterThan(0);
  });
});

describe("auditIssue", () => {
  const auditBody = (
    findingEvidence: string[],
    findingStatus: AuditBody["findings"][number]["status"] = "verified",
  ): AuditBody => ({
    summary: "Vague ticket",
    findings: [
      {
        text: "Existing label work in CHK-7",
        status: findingStatus,
        evidenceIds: findingEvidence,
        category: "existing_implementation_or_duplicate",
      },
    ],
    proposedTicket: body(["e1"]),
  });
  const run = (b: AuditBody) =>
    auditIssue({
      issueKey: "CHK-9",
      source,
      tracker,
      generator: { audit: async () => ({ body: b }) } satisfies AuditGenerator,
    });

  it("collects evidence cited by findings and the proposed ticket", async () => {
    const result = await run(auditBody(["e2"]));
    expect(result.report.evidence.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(result.issues).toEqual([]);
  });

  it("validates finding evidence", async () => {
    expect((await run(auditBody([]))).issues[0]).toEqual({
      path: "findings[0]",
      message: "Finding 1 is marked Verified but cites no evidence.",
    });
  });

  it("flags a duplicate or conflict finding that is not verified", async () => {
    expect((await run(auditBody([], "inferred"))).issues).toEqual([
      {
        path: "findings[0]",
        message: "Finding 1 reports an existing implementation or duplicate but is not Verified with evidence.",
      },
    ]);
  });
});
