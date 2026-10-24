import type { Metadata } from "next";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditView } from "@/components/analysis/audit-view";
import { CreationView } from "@/components/analysis/creation-view";
import { EvidenceWarnings } from "@/components/analysis/evidence-warnings";
import { TicketChat } from "@/components/analysis/ticket-chat";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { answersOf, firstLine, requestOf } from "@/features/analysis/input";
import { readAnalysis } from "@/features/analysis/read";
import { getAnalysis } from "@/features/projects/queries";
import { refineTicket } from "@/features/ticket-creation/actions";
import { projectIntegrations } from "@/features/projects/view";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const maxDuration = 300;

export const metadata: Metadata = { title: "Analysis" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/analyses/[analysisId]">) {
  const { analysisId } = await params;
  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (!found) notFound();
  const { analysis, project } = found;
  const content = readAnalysis(analysis);
  const { trackerName } = await projectIntegrations(db, project);
  const draftTitle = analysis.kind === "create" ? content.draft?.title : undefined;
  const request = requestOf(content.input);
  const heading = draftTitle ?? (firstLine(request) || "Untitled");
  const canRefine = analysis.kind === "create" && !analysis.publishedIssueKey && analysis.status !== "running";

  const header = (
    <PageHeader
      breadcrumb={
        <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft aria-hidden className="size-3.5" />
          {project.name} · {analysis.kind === "create" ? "New ticket" : "Audit"}
        </Link>
      }
      title={heading}
      actions={
        <Link href={`/projects/${project.id}#request`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Plus aria-hidden />
          New ticket
        </Link>
      }
      description={
        analysis.status === "completed" &&
        `${analysis.model ?? "Unknown model"} · ${((analysis.latencyMs ?? 0) / 1000).toFixed(1)}s · ${analysis.inputTokens ?? 0} in / ${analysis.outputTokens ?? 0} out tokens`
      }
    />
  );
  const runKey = analysis.createdAt.toISOString();

  if (analysis.kind === "audit") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {analysis.status === "failed" && <FailedAlert error={analysis.error} />}
        {analysis.status === "running" && (
          <p className="text-muted-foreground" role="status">
            This analysis is still running. Refresh in a moment.
          </p>
        )}
        {analysis.status === "completed" && (
          <>
            <EvidenceWarnings issues={analysis.evidenceIssues ?? []} />
            <AuditView
              analysis={analysis}
              input={content.input}
              report={content.report}
              draft={content.draft}
              trackerName={trackerName}
              trackerKey={project.trackerResourceId}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <TicketChat
          key={runKey}
          request={request}
          refinements={answersOf(content.input)}
          status={analysis.status}
          error={analysis.error}
          draftTitle={draftTitle ?? null}
          questions={analysis.status === "completed" ? (content.draft?.openQuestions ?? []) : []}
          publishedKey={analysis.publishedIssueKey}
          trackerName={trackerName}
          canRefine={canRefine}
          refine={refineTicket.bind(null, analysis.id)}
        />
        <div className="flex flex-col gap-6">
          {analysis.status === "completed" ? (
            <>
              <EvidenceWarnings issues={analysis.evidenceIssues ?? []} />
              <CreationView
                analysis={analysis}
                draft={content.draft}
                trackerName={trackerName}
                trackerKey={project.trackerResourceId}
              />
            </>
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {analysis.status === "running"
                ? "The ticket preview appears here once the draft is ready."
                : "No draft yet. Send a message in the conversation to try again."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FailedAlert({ error }: { error: string | null }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Analysis failed</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
