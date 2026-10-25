import { auditReportSchema, type AuditReport } from "@/core/audit/schemas";
import type { Evidence } from "@/core/evidence/schemas";
import { citedEvidence } from "@/core/evidence/validate";
import { draftSections, ticketDraftSchema, type TicketDraft } from "@/core/requirements/schemas";
import { readAnalysisInput, type AnalysisInput } from "@/features/analysis/input";
import type { Analysis } from "@/features/projects/queries";

export type ReadAnalysis = {
  input: AnalysisInput | null;
  // The draft that can be published: the create result, or the audit's proposed ticket.
  draft: TicketDraft | null;
  // Set for audits only.
  report: AuditReport | null;
};

// Evidence is what the model cited, read from the stored result only: `editedResult` comes from the browser
// and must never be trusted as a source.
export function storedEvidence(analysis: Pick<Analysis, "kind" | "result">): Evidence[] {
  const schema = analysis.kind === "audit" ? auditReportSchema : ticketDraftSchema;
  return schema.safeParse(analysis.result).data?.evidence ?? [];
}

// The preview shows exactly the sources publishing will send: the stored ones the (edited) claims still cite.
const withStoredEvidence = (draft: TicketDraft, evidence: Evidence[]): TicketDraft => ({
  ...draft,
  evidence: citedEvidence(evidence, draftSections(draft)),
});

// Stored JSON is untrusted and may predate the current schema; each shape is parsed once here.
export function readAnalysis(analysis: Analysis): ReadAnalysis {
  const input = readAnalysisInput(analysis);
  const evidence = storedEvidence(analysis);
  if (analysis.kind === "create") {
    const stored = ticketDraftSchema.safeParse(analysis.editedResult ?? analysis.result).data;
    return { input, draft: stored ? withStoredEvidence(stored, evidence) : null, report: null };
  }
  const report = auditReportSchema.safeParse(analysis.result).data ?? null;
  const proposal =
    analysis.editedResult ?? (report ? { ...report.proposedTicket, evidence: report.evidence } : undefined);
  const draft = ticketDraftSchema.safeParse(proposal).data;
  return { input, draft: draft ? withStoredEvidence(draft, evidence) : null, report };
}
