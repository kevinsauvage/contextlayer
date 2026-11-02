import type { AuditReport } from "@/core/audit/schemas";
import { gatherContext } from "@/core/context/gather";
import type { ContextSource, Issue, IssueTracker } from "@/core/context/source";
import type { Evidence } from "@/core/evidence/schemas";
import {
  citedEvidence,
  draftIssues,
  isTicketIntrinsic,
  validateAuditFindings,
  validateEvidenceReferences,
  type EvidenceIssue,
} from "@/core/evidence/validate";
import { draftSections, refinementText, type Refinement, type TicketDraft } from "@/core/requirements/schemas";
import type { AuditGenerator, DraftGenerator, EvidenceSelector, TokenUsage } from "./generators";

type Deps = { source: ContextSource; tracker: IssueTracker; selector: EvidenceSelector };

type AnalysisBase = { candidates: Evidence[]; issues: EvidenceIssue[]; usage?: TokenUsage; revision?: string };
export type CreationResult = AnalysisBase & { draft: TicketDraft };
export type AuditResult = AnalysisBase & { issue: Issue; report: AuditReport };

// Query expansion and drafting are separate model calls, but one analysis pays for both.
const addUsage = (first: TokenUsage | undefined, second: TokenUsage | undefined): TokenUsage | undefined =>
  first || second
    ? {
        inputTokens: (first?.inputTokens ?? 0) + (second?.inputTokens ?? 0),
        outputTokens: (first?.outputTokens ?? 0) + (second?.outputTokens ?? 0),
      }
    : undefined;

export async function draftTicket(
  input: Deps & { request: string; answers?: Refinement[]; generator: DraftGenerator },
): Promise<CreationResult> {
  const answers = input.answers ?? [];
  // Answers and follow-ups often name the part to change ("the home hero"), so they steer retrieval too.
  const query = [input.request, ...answers.map(refinementText)].join("\n");
  const context = await gatherContext({ ...input, query });
  const { body, usage } = await input.generator.generate({
    request: input.request,
    answers,
    candidates: context.evidence,
  });

  const draft: TicketDraft = { ...body, evidence: citedEvidence(context.evidence, draftSections(body)) };
  return {
    draft,
    candidates: context.evidence,
    issues: draftIssues(draft),
    usage: addUsage(context.usage, usage),
    revision: input.source.revision,
  };
}

export async function auditIssue(input: Deps & { issueKey: string; generator: AuditGenerator }): Promise<AuditResult> {
  const issue = await input.tracker.getIssue(input.issueKey);
  const context = await gatherContext({
    query: `${issue.summary} ${issue.description}`,
    excludeIssueKey: issue.key,
    ...input,
  });
  // The audited ticket is the first source: a finding about the ticket itself (no description, vague title) can only
  // cite the ticket, not a code excerpt.
  const candidates = [
    {
      kind: "jira_issue" as const,
      reference: issue.key,
      url: issue.url,
      excerpt: `${issue.summary} [${issue.status}]\n${issue.description || "(no description)"}`.slice(0, 1500),
    },
    ...context.evidence,
  ].map((candidate, i) => ({ ...candidate, id: `e${i + 1}` }));
  const { body, usage } = await input.generator.audit({ issue, candidates });

  const sections = { findings: body.findings, ...draftSections(body.proposedTicket) };
  const report: AuditReport = { ...body, evidence: citedEvidence(candidates, sections) };
  const issues = [
    ...validateEvidenceReferences(report.evidence, sections, { evidenceFree: isTicketIntrinsic }),
    ...validateAuditFindings(report.findings),
  ];
  return {
    issue,
    report,
    candidates,
    issues,
    usage: addUsage(context.usage, usage),
    revision: input.source.revision,
  };
}
