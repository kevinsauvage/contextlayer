import { notFound } from "next/navigation";
import { DraftEditor } from "@/components/draft-editor";
import { EvidenceList } from "@/components/evidence-list";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { auditReportSchema } from "@/core/audit/schemas";
import { ticketDraftSchema } from "@/core/requirements/schemas";
import { getAnalysis, getJiraConnection, type Analysis } from "@/features/projects/queries";
import { applyAuditToJira } from "@/features/ticket-audit/actions";
import { publishTicket } from "@/features/ticket-creation/actions";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import type { EvidenceIssue } from "@/core/evidence/validate";

function WarningList({ issues }: { issues: EvidenceIssue[] }) {
  if (!issues.length) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Evidence problems — review before publishing</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">{issues.map((i, n) => <li key={n}>{i.path}: {i.message}</li>)}</ul>
      </AlertDescription>
    </Alert>
  );
}

function CreationView({ analysis, siteUrl }: { analysis: Analysis; siteUrl: string }) {
  const draft = ticketDraftSchema.parse(analysis.editedResult ?? analysis.result);
  return (
    <DraftEditor
      initial={draft}
      publish={publishTicket.bind(null, analysis.id)}
      publishLabel="Approve & create in Jira"
      publishedUrl={analysis.publishedIssueKey && `${siteUrl}/browse/${analysis.publishedIssueKey}`}
    />
  );
}

function AuditView({ analysis, siteUrl }: { analysis: Analysis; siteUrl: string }) {
  const report = auditReportSchema.parse(analysis.result);
  const proposed = ticketDraftSchema.parse(analysis.editedResult ?? { ...report.proposedTicket, evidence: report.evidence });
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Findings</h2>
        <p className="text-sm">{report.summary}</p>
        {report.findings.length === 0 && <p className="text-sm text-muted-foreground">No findings.</p>}
        <ul className="flex flex-col gap-2">
          {report.findings.map((finding, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{finding.category.replaceAll("_", " ")}</Badge>
                <StatusBadge status={finding.status} />
                {finding.evidenceIds.length > 0 && <span className="text-muted-foreground">Evidence: {finding.evidenceIds.join(", ")}</span>}
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
        <DraftEditor
          initial={proposed}
          publish={applyAuditToJira.bind(null, analysis.id)}
          publishLabel="Approve & update the Jira issue"
          publishedUrl={analysis.publishedIssueKey && `${siteUrl}/browse/${analysis.publishedIssueKey}`}
        />
      </section>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (!found) notFound();
  const { analysis, project } = found;
  const siteUrl = (await getJiraConnection(db, organizationId, project.jiraConnectionId))?.siteUrl ?? "";
  const input = analysis.input as { title?: string; issueKey?: string };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">{project.name} · {analysis.kind === "create" ? "New ticket" : "Audit"}</p>
        <h1 className="text-2xl font-semibold">{input.title ?? input.issueKey}</h1>
        {analysis.status === "completed" && (
          <p className="text-xs text-muted-foreground">
            {analysis.model} · {((analysis.latencyMs ?? 0) / 1000).toFixed(1)}s · {analysis.inputTokens ?? 0} in / {analysis.outputTokens ?? 0} out tokens
          </p>
        )}
      </div>
      {analysis.status === "failed" && (
        <Alert variant="destructive">
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription>{analysis.error}</AlertDescription>
        </Alert>
      )}
      {analysis.status === "running" && <p className="text-muted-foreground">This analysis is still running. Refresh in a moment.</p>}
      {analysis.status === "completed" && (
        <>
          <WarningList issues={(analysis.evidenceIssues ?? []) as EvidenceIssue[]} />
          {analysis.kind === "create" ? <CreationView analysis={analysis} siteUrl={siteUrl} /> : <AuditView analysis={analysis} siteUrl={siteUrl} />}
        </>
      )}
    </div>
  );
}
