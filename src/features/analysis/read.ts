import { auditReportSchema, type AuditReport } from "@/core/audit/schemas";
import { ticketDraftSchema, type TicketDraft } from "@/core/requirements/schemas";
import { readAnalysisInput, type AnalysisInput } from "@/features/analysis/input";
import type { Analysis } from "@/features/projects/queries";

export type ReadAnalysis = {
  input: AnalysisInput | null;
  // The draft that can be published: the create result, or the audit's proposed ticket.
  draft: TicketDraft | null;
  // Set for audits only.
  report: AuditReport | null;
};

// Stored JSON is untrusted and may predate the current schema; each shape is parsed once here.
export function readAnalysis(analysis: Analysis): ReadAnalysis {
  const input = readAnalysisInput(analysis);
  if (analysis.kind === "create") {
    const draft = ticketDraftSchema.safeParse(analysis.editedResult ?? analysis.result).data ?? null;
    return { input, draft, report: null };
  }
  const report = auditReportSchema.safeParse(analysis.result).data ?? null;
  const proposal =
    analysis.editedResult ?? (report ? { ...report.proposedTicket, evidence: report.evidence } : undefined);
  return { input, draft: ticketDraftSchema.safeParse(proposal).data ?? null, report };
}
