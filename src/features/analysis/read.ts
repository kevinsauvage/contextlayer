import { auditReportSchema, type AuditReport } from "@/core/audit/schemas";
import type { Evidence } from "@/core/evidence/schemas";
import { withCitedEvidence } from "@/core/evidence/validate";
import { ticketDraftSchema, type TicketDraft } from "@/core/requirements/schemas";
import { estimateCostUsd } from "@/features/analysis/cost";
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

type StoredAnalysis = Pick<Analysis, "kind" | "result" | "editedResult">;

// Stored JSON is untrusted and may predate the current schema; each shape is parsed once here, for the page and the
// history badge alike.
function readStored(analysis: StoredAnalysis): Pick<ReadAnalysis, "draft" | "report"> {
  if (analysis.kind === "create") {
    const stored = ticketDraftSchema.safeParse(analysis.editedResult ?? analysis.result).data;
    // The preview shows exactly the sources publishing will send: the stored ones the (edited) claims still cite.
    return { draft: stored ? withCitedEvidence(stored, storedEvidence(analysis)) : null, report: null };
  }
  const report = auditReportSchema.safeParse(analysis.result).data ?? null;
  const evidence = report?.evidence ?? [];
  const proposal = analysis.editedResult ?? (report ? { ...report.proposedTicket, evidence } : undefined);
  const draft = ticketDraftSchema.safeParse(proposal).data;
  return { draft: draft ? withCitedEvidence(draft, evidence) : null, report };
}

export const readAnalysis = (analysis: Analysis): ReadAnalysis => ({
  input: readAnalysisInput(analysis),
  ...readStored(analysis),
});

export const storedDraft = (analysis: StoredAnalysis): TicketDraft | null => readStored(analysis).draft;

const SHORT_SHA = 7;

const shortRevision = (revision: string) => revision.slice(0, SHORT_SHA);

// Set when this draft read a different commit than the draft it replaced: its evidence may differ from before.
export function revisionChange(
  analysis: Pick<Analysis, "sourceRevision" | "previousSourceRevision">,
): { from: string; to: string } | null {
  const { sourceRevision: to, previousSourceRevision: from } = analysis;
  return to && from && to !== from ? { from: shortRevision(from), to: shortRevision(to) } : null;
}

// The header line for a completed run; the page shows it under the title.
export function runSummary(
  analysis: Pick<Analysis, "status" | "model" | "latencyMs" | "inputTokens" | "outputTokens" | "sourceRevision">,
): string | null {
  if (analysis.status !== "completed") return null;
  // Cost is derived when the page renders, not stored: the price table may change without touching a row.
  const costUsd =
    analysis.inputTokens === null || analysis.outputTokens === null
      ? null
      : estimateCostUsd(analysis.model, { inputTokens: analysis.inputTokens, outputTokens: analysis.outputTokens });
  return [
    analysis.model ?? "Unknown model",
    `${((analysis.latencyMs ?? 0) / 1000).toFixed(1)}s`,
    `${analysis.inputTokens ?? 0} in / ${analysis.outputTokens ?? 0} out tokens`,
    ...(costUsd === null ? [] : [`$${costUsd.toFixed(4)}`]),
    ...(analysis.sourceRevision ? [`commit ${shortRevision(analysis.sourceRevision)}`] : []),
  ].join(" · ");
}

// A ticket can be redrafted until it is published; audits are re-run, not refined.
export const canRefineAnalysis = (analysis: Pick<Analysis, "kind" | "status" | "publishedIssueKey">): boolean =>
  analysis.kind === "create" && !analysis.publishedIssueKey && analysis.status !== "running";
