import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { DraftEditor } from "@/components/draft-editor";
import { EvidenceList } from "@/components/evidence-list";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { auditReportSchema } from "@/core/audit/schemas";
import { ticketDraftSchema } from "@/core/requirements/schemas";
import { PageHeader } from "@/components/page-header";
import { analysisRequest, firstLine } from "@/features/analysis/input";
import { failStaleAnalyses, getAnalysis, type Analysis } from "@/features/projects/queries";
import { projectIntegrations } from "@/features/projects/view";
import { applyAuditToTracker } from "@/features/ticket-audit/actions";
import { publishTicket, rerunTicketAnalysis } from "@/features/ticket-creation/actions";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import type { EvidenceIssue } from "@/core/evidence/validate";

function WarningList({ issues }: { issues: EvidenceIssue[] }) {
  if (!issues.length) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Evidence problems — review before publishing</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {issues.map((i, n) => (
            <li key={n}>
              {i.path}: {i.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

type ViewProps = { analysis: Analysis; trackerName: string };

const publishedOf = (analysis: Analysis) => ({ key: analysis.publishedIssueKey, url: analysis.publishedIssueUrl });

type Draft = ReturnType<typeof ticketDraftSchema.parse>;

function RequestText({ request }: { request: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
      <h2 className="text-xs font-medium text-muted-foreground">Request</h2>
      <p className="whitespace-pre-wrap">{request}</p>
    </section>
  );
}

const needsClarification = (draft: Draft) =>
  draft.openQuestions.length > 0 || draft.description.some((claim) => claim.status === "needs_clarification");

function refineHint(analysis: Analysis, trackerName: string): string {
  const replaces = `This replaces the draft; nothing is sent to ${trackerName} until you approve.`;
  if (analysis.status === "failed")
    return `Add detail to the request, for example the page or component and what exactly should change, and run it again. ${replaces}`;
  const draft = ticketDraftSchema.safeParse(analysis.result);
  if (draft.success && needsClarification(draft.data))
    return `The draft has open questions. Answer them in the request (which page or component, what exactly, any constraints) and run it again. ${replaces}`;
  return `Not quite right? Edit the request and run it again. ${replaces}`;
}

function RefineRequest({ analysis, trackerName, request }: ViewProps & { request: string }) {
  return (
    <ActionForm
      key={analysis.createdAt.toISOString()}
      action={rerunTicketAnalysis.bind(null, analysis.id)}
      name="request"
      title="Refine the request"
      description={refineHint(analysis, trackerName)}
      placeholder="Describe what should change, where, and why"
      defaultValue={request}
      multiline
      submitLabel="Run again"
      pendingLabel="Investigating…"
    />
  );
}

function CreationView({ analysis, trackerName }: ViewProps) {
  const draft = ticketDraftSchema.parse(analysis.editedResult ?? analysis.result);
  return (
    <DraftEditor
      key={analysis.createdAt.toISOString()}
      initial={draft}
      publish={publishTicket.bind(null, analysis.id)}
      publishLabel={`Approve & create in ${trackerName}`}
      trackerName={trackerName}
      published={publishedOf(analysis)}
    />
  );
}

function AuditView({ analysis, trackerName }: ViewProps) {
  const report = auditReportSchema.parse(analysis.result);
  const proposed = ticketDraftSchema.parse(
    analysis.editedResult ?? { ...report.proposedTicket, evidence: report.evidence },
  );
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
        <DraftEditor
          initial={proposed}
          publish={applyAuditToTracker.bind(null, analysis.id)}
          publishLabel={`Approve & update the ${trackerName} ticket`}
          trackerName={trackerName}
          published={publishedOf(analysis)}
        />
      </section>
    </div>
  );
}

export const maxDuration = 300;

export const metadata: Metadata = { title: "Analysis" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/analyses/[analysisId]">) {
  const { analysisId } = await params;
  const { organizationId } = await requireOrgContext();
  const db = getDb();
  let found = await getAnalysis(db, organizationId, analysisId);
  if (!found) notFound();
  if (found.analysis.status === "running") {
    await failStaleAnalyses(db, found.project.id);
    found = (await getAnalysis(db, organizationId, analysisId)) ?? found;
  }
  const { analysis, project } = found;
  const { trackerName } = await projectIntegrations(db, project);
  const request = analysisRequest(analysis.input);
  const draftTitle = ticketDraftSchema.safeParse(analysis.editedResult ?? analysis.result).data?.title;
  const heading = (analysis.kind === "create" ? draftTitle : undefined) ?? (firstLine(request) || "Untitled");
  const canRefine = analysis.kind === "create" && !analysis.publishedIssueKey && analysis.status !== "running";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <Link href={`/projects/${project.id}`}>
            {project.name} · {analysis.kind === "create" ? "New ticket" : "Audit"}
          </Link>
        }
        title={heading}
        description={
          analysis.status === "completed" &&
          `${analysis.model ?? "Unknown model"} · ${((analysis.latencyMs ?? 0) / 1000).toFixed(1)}s · ${analysis.inputTokens ?? 0} in / ${analysis.outputTokens ?? 0} out tokens`
        }
      />
      {analysis.status === "failed" && (
        <Alert variant="destructive">
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription>{analysis.error}</AlertDescription>
        </Alert>
      )}
      {canRefine ? (
        <RefineRequest analysis={analysis} trackerName={trackerName} request={request} />
      ) : (
        analysis.kind === "create" && <RequestText request={request} />
      )}
      {analysis.status === "running" && (
        <p className="text-muted-foreground" role="status">
          This analysis is still running. Refresh in a moment.
        </p>
      )}
      {analysis.status === "completed" && (
        <>
          <WarningList issues={(analysis.evidenceIssues ?? []) as EvidenceIssue[]} />
          {analysis.kind === "create" ? (
            <CreationView analysis={analysis} trackerName={trackerName} />
          ) : (
            <AuditView analysis={analysis} trackerName={trackerName} />
          )}
        </>
      )}
    </div>
  );
}
