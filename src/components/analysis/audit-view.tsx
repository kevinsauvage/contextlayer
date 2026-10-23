import { publishedOf, type AnalysisViewProps } from "@/components/analysis/analysis-view";
import { ClaimStatusBadge } from "@/components/analysis/claim-status-badge";
import { DraftWorkspace } from "@/components/analysis/draft-workspace";
import { EvidenceList } from "@/components/analysis/evidence-list";
import { OutdatedResult } from "@/components/analysis/outdated-result";
import { Badge } from "@/components/ui/badge";
import type { AuditReport } from "@/core/audit/schemas";
import type { TicketDraft } from "@/core/requirements/schemas";
import { requestOf, type AnalysisInput } from "@/features/analysis/input";
import { applyAuditToTracker } from "@/features/ticket-audit/actions";

type Props = AnalysisViewProps & {
  input: AnalysisInput | null;
  report: AuditReport | null;
  draft: TicketDraft | null;
};

export function AuditView({ analysis, input, report, draft, trackerName, trackerKey }: Props) {
  if (!report) return <OutdatedResult subject="audit" action="Run the analysis again to update it." />;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Findings</h2>
        <p className="text-sm">{report.summary}</p>
        {report.findings.length === 0 && <p className="text-sm text-muted-foreground">No findings.</p>}
        <ul className="flex flex-col gap-2">
          {report.findings.map((finding, index) => (
            <li key={index} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{finding.category.replaceAll("_", " ")}</Badge>
                <ClaimStatusBadge status={finding.status} />
                {finding.evidenceIds.length > 0 && (
                  <span className="text-muted-foreground">Evidence: {finding.evidenceIds.join(", ")}</span>
                )}
              </div>
              <p>{finding.text}</p>
              {finding.suggestion && <p className="text-muted-foreground">Suggestion: {finding.suggestion}</p>}
            </li>
          ))}
        </ul>
        <EvidenceList evidence={report.evidence} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Proposed ticket</h2>
        {draft ? (
          <DraftWorkspace
            initial={draft}
            publish={applyAuditToTracker.bind(null, analysis.id)}
            publishLabel={`Approve & update the ${trackerName} ticket`}
            trackerName={trackerName}
            projectLabel={trackerKey}
            existingKey={requestOf(input)}
            published={publishedOf(analysis)}
          />
        ) : (
          <OutdatedResult subject="proposed ticket" action="Run the analysis again to update it." />
        )}
      </section>
    </div>
  );
}
