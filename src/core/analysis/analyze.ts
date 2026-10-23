import type { AuditReport } from "@/core/audit/schemas";
import { gatherContext } from "@/core/context/gather";
import type { ContextSource, Issue, IssueTracker } from "@/core/context/source";
import type { Evidence } from "@/core/evidence/schemas";
import { validateEvidenceReferences, type EvidenceIssue } from "@/core/evidence/validate";
import { draftSections, type Clarification, type TicketDraft } from "@/core/requirements/schemas";
import type { AuditGenerator, DraftGenerator, TokenUsage } from "./generators";

type Deps = { source: ContextSource; tracker: IssueTracker };

type AnalysisBase = { candidates: Evidence[]; issues: EvidenceIssue[]; usage?: TokenUsage };
export type CreationResult = AnalysisBase & { draft: TicketDraft };
export type AuditResult = AnalysisBase & { issue: Issue; report: AuditReport };

const citedBy = (candidates: Evidence[], claimLists: { evidenceIds: string[] }[][]) => {
  const ids = new Set(claimLists.flat().flatMap((claim) => claim.evidenceIds));
  return candidates.filter((candidate) => ids.has(candidate.id));
};

export async function draftTicket(
  input: Deps & { request: string; answers?: Clarification[]; generator: DraftGenerator },
): Promise<CreationResult> {
  const answers = input.answers ?? [];
  // Answers often name the part to change ("the home hero"), so they steer retrieval too.
  const query = [input.request, ...answers.map((a) => a.answer)].join("\n");
  const candidates = await gatherContext({ ...input, query });
  const { body, usage } = await input.generator.generate({ request: input.request, answers, candidates });

  const draft: TicketDraft = { ...body, evidence: citedBy(candidates, Object.values(draftSections(body))) };
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
  const report: AuditReport = { ...body, evidence: citedBy(candidates, Object.values(sections)) };
  return { issue, report, candidates, issues: validateEvidenceReferences(report.evidence, sections), usage };
}
