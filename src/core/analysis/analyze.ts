import type { AuditReport } from "@/core/audit/schemas";
import { gatherContext } from "@/core/context/gather";
import type { ContextSource, Issue, IssueTracker } from "@/core/context/source";
import type { Evidence } from "@/core/evidence/schemas";
import {
  citedEvidence,
  validateAuditFindings,
  validateEvidenceReferences,
  type EvidenceIssue,
} from "@/core/evidence/validate";
import { draftSections, refinementText, type Refinement, type TicketDraft } from "@/core/requirements/schemas";
import type { AuditGenerator, DraftGenerator, TokenUsage } from "./generators";

type Deps = { source: ContextSource; tracker: IssueTracker };

type AnalysisBase = { candidates: Evidence[]; issues: EvidenceIssue[]; usage?: TokenUsage };
export type CreationResult = AnalysisBase & { draft: TicketDraft };
export type AuditResult = AnalysisBase & { issue: Issue; report: AuditReport };

export async function draftTicket(
  input: Deps & { request: string; answers?: Refinement[]; generator: DraftGenerator },
): Promise<CreationResult> {
  const answers = input.answers ?? [];
  // Answers and follow-ups often name the part to change ("the home hero"), so they steer retrieval too.
  const query = [input.request, ...answers.map(refinementText)].join("\n");
  const candidates = await gatherContext({ ...input, query });
  const { body, usage } = await input.generator.generate({ request: input.request, answers, candidates });

  const draft: TicketDraft = { ...body, evidence: citedEvidence(candidates, draftSections(body)) };
  return { draft, candidates, issues: validateEvidenceReferences(draft.evidence, draftSections(draft)), usage };
}

export async function auditIssue(input: Deps & { issueKey: string; generator: AuditGenerator }): Promise<AuditResult> {
  const issue = await input.tracker.getIssue(input.issueKey);
  const candidates = await gatherContext({
    query: `${issue.summary} ${issue.description}`,
    excludeIssueKey: issue.key,
    ...input,
  });
  const { body, usage } = await input.generator.audit({ issue, candidates });

  const sections = { findings: body.findings, ...draftSections(body.proposedTicket) };
  const report: AuditReport = { ...body, evidence: citedEvidence(candidates, sections) };
  const issues = [...validateEvidenceReferences(report.evidence, sections), ...validateAuditFindings(report.findings)];
  return { issue, report, candidates, issues, usage };
}
