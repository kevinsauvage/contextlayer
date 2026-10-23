import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ClarifyQuestions } from "@/components/clarify-questions";
import { DraftWorkspace } from "@/components/draft-workspace";
import { EvidenceList } from "@/components/evidence-list";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { auditReportSchema } from "@/core/audit/schemas";
import { ticketDraftSchema } from "@/core/requirements/schemas";
import { PageHeader } from "@/components/page-header";
import { analysisAnswers, analysisRequest, firstLine } from "@/features/analysis/input";
import { failStaleAnalyses, getAnalysis, type Analysis } from "@/features/projects/queries";
import { projectIntegrations } from "@/features/projects/view";
import { applyAuditToTracker } from "@/features/ticket-audit/actions";
import { answerQuestions, publishTicket, rerunTicketAnalysis } from "@/features/ticket-creation/actions";
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

type ViewProps = { analysis: Analysis; trackerName: string; trackerKey: string };

const publishedOf = (analysis: Analysis) => ({ key: analysis.publishedIssueKey, url: analysis.publishedIssueUrl });

function RequestPanel({ analysis, trackerName, editable }: Omit<ViewProps, "trackerKey"> & { editable: boolean }) {
  const request = analysisRequest(analysis.input);
  const answered = analysisAnswers(analysis.input).filter((pair) => pair.answer);
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 text-sm"
      aria-labelledby="request-heading"
    >
      <h2 id="request-heading" className="text-xs font-medium text-muted-foreground">
        Your request
      </h2>
      <p className="whitespace-pre-wrap">{request}</p>
      {answered.length > 0 && (
        <dl className="flex flex-col gap-2 border-t pt-3">
          {answered.map((pair) => (
            <div key={pair.question}>
              <dt className="text-muted-foreground">{pair.question}</dt>
              <dd className="whitespace-pre-wrap">{pair.answer}</dd>
            </div>
          ))}
        </dl>
      )}
      {editable && (
        <details className="group" open={analysis.status === "failed"}>
          <summary className="cursor-pointer text-sm font-medium text-primary">Edit request</summary>
          <div className="mt-3">
            <ActionForm
              key={analysis.createdAt.toISOString()}
              action={rerunTicketAnalysis.bind(null, analysis.id)}
              name="request"
              title="Edit the request"
              description={`Add or change detail and run it again. Your answers are kept. This replaces the draft; nothing is sent to ${trackerName} until you approve.`}
              placeholder="Describe what should change, where, and why"
              defaultValue={request}
              multiline
              submitLabel="Run again"
              pendingLabel="Investigating…"
            />
          </div>
        </details>
      )}
    </section>
  );
}

function CreationView({ analysis, trackerName, trackerKey }: ViewProps) {
  const draft = ticketDraftSchema.parse(analysis.editedResult ?? analysis.result);
  const runKey = analysis.createdAt.toISOString();
  return (
    <>
      {!analysis.publishedIssueKey && draft.openQuestions.length > 0 && (
        <ClarifyQuestions
          key={`questions-${runKey}`}
          questions={draft.openQuestions}
          trackerName={trackerName}
          answer={answerQuestions.bind(null, analysis.id)}
        />
      )}
      <DraftWorkspace
        key={runKey}
        initial={draft}
        publish={publishTicket.bind(null, analysis.id)}
        publishLabel={`Approve & create in ${trackerName}`}
        trackerName={trackerName}
        projectLabel={trackerKey}
        published={publishedOf(analysis)}
      />
    </>
  );
}

function AuditView({ analysis, trackerName, trackerKey }: ViewProps) {
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
        <DraftWorkspace
          initial={proposed}
          publish={applyAuditToTracker.bind(null, analysis.id)}
          publishLabel={`Approve & update the ${trackerName} ticket`}
          trackerName={trackerName}
          projectLabel={trackerKey}
          existingKey={analysisRequest(analysis.input)}
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
      {analysis.kind === "create" && (
        <RequestPanel analysis={analysis} trackerName={trackerName} editable={canRefine} />
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
            <CreationView analysis={analysis} trackerName={trackerName} trackerKey={project.trackerResourceId} />
          ) : (
            <AuditView analysis={analysis} trackerName={trackerName} trackerKey={project.trackerResourceId} />
          )}
        </>
      )}
    </div>
  );
}
