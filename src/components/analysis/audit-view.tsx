import { publishedOf, type AnalysisViewProps } from "@/components/analysis/analysis-view";
import { ClaimStatusBadge } from "@/components/analysis/claim-status-badge";
import { DraftWorkspace } from "@/components/analysis/draft-workspace";
import { EvidenceList, evidenceAnchor } from "@/components/analysis/evidence-list";
import { InlineText } from "@/components/analysis/inline-text";
import { OutdatedResult } from "@/components/analysis/outdated-result";
import { Badge } from "@/components/ui/badge";
import type { AuditReport } from "@/core/audit/schemas";
import type { EvidenceIssue } from "@/core/evidence/validate";
import type { TicketDraft } from "@/core/requirements/schemas";
import { requestOf, type AnalysisInput } from "@/features/analysis/input";
import { applyAuditToTracker } from "@/features/ticket-audit/actions";

type Props = AnalysisViewProps & {
  input: AnalysisInput | null;
  report: AuditReport | null;
  draft: TicketDraft | null;
  issues?: EvidenceIssue[];
};

function CurrentTicket({ report }: { report: AuditReport }) {
  if (!report.auditedIssue) return null;
  return (
    <section aria-labelledby="current-ticket-heading" className="flex flex-col gap-3">
      <h2 id="current-ticket-heading" className="font-medium">
        Current ticket
      </h2>
      <div className="rounded-xl border bg-muted/30 p-4">
        <h3 className="font-medium text-balance">
          <InlineText>{report.auditedIssue.summary}</InlineText>
        </h3>
        <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
          <InlineText>{report.auditedIssue.description || "(no description)"}</InlineText>
        </p>
      </div>
    </section>
  );
}

export function AuditView({ analysis, input, report, draft, issues, trackerName, trackerKey }: Props) {
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
                  <span className="flex flex-wrap items-center gap-1 text-muted-foreground">
                    Evidence:
                    {finding.evidenceIds.map((id) => (
                      <a
                        key={id}
                        href={`#${evidenceAnchor(id)}`}
                        aria-label={`Evidence ${id}`}
                        className="rounded bg-brand/8 px-1 font-mono text-[0.7rem] leading-4 text-brand underline-offset-2 hover:underline"
                      >
                        {id}
                      </a>
                    ))}
                  </span>
                )}
              </div>
              <p>
                <InlineText>{finding.text}</InlineText>
              </p>
              {finding.suggestion && (
                <p className="text-muted-foreground">
                  Suggestion: <InlineText>{finding.suggestion}</InlineText>
                </p>
              )}
            </li>
          ))}
        </ul>
        <EvidenceList evidence={report.evidence} />
      </section>
      <CurrentTicket report={report} />
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
            issues={issues}
            evidence={report.evidence}
          />
        ) : (
          <OutdatedResult subject="proposed ticket" action="Run the analysis again to update it." />
        )}
      </section>
    </div>
  );
}
