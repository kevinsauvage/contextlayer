import type { Metadata } from "next";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AuditView } from "@/components/analysis/audit-view";
import { CreationView } from "@/components/analysis/creation-view";
import { EvidenceWarnings } from "@/components/analysis/evidence-warnings";
import { InlineText } from "@/components/analysis/inline-text";
import { OpenQuestions } from "@/components/analysis/open-questions";
import { RefinementProvider } from "@/components/analysis/refinement-context";
import { TicketChat } from "@/components/analysis/ticket-chat";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { plainInline } from "@/core/requirements/render";
import { isFollowUp, type Clarification } from "@/core/requirements/schemas";
import { answersOf, firstLine, requestOf } from "@/features/analysis/input";
import { readAnalysis } from "@/features/analysis/read";
import { getAnalysis } from "@/features/projects/queries";
import { refineTicket } from "@/features/ticket-creation/actions";
import { projectIntegrations } from "@/features/projects/view";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const maxDuration = 300;

// Shared by the page and its metadata so the analysis is read once per request.
const loadAnalysis = cache(async (analysisId: string) => {
  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (!found) return null;
  const content = readAnalysis(found.analysis);
  const draftTitle = found.analysis.kind === "create" ? content.draft?.title : undefined;
  const request = requestOf(content.input);
  return { ...found, db, content, draftTitle, request, heading: draftTitle ?? (firstLine(request) || "Untitled") };
});

const TITLE_LENGTH = 70;

export async function generateMetadata({
  params,
}: PageProps<"/projects/[projectId]/analyses/[analysisId]">): Promise<Metadata> {
  const loaded = await loadAnalysis((await params).analysisId);
  if (!loaded) return { title: "Analysis" };
  const title = plainInline(loaded.heading);
  return { title: title.length > TITLE_LENGTH ? `${title.slice(0, TITLE_LENGTH - 1)}…` : title };
}

export default async function Page({ params }: PageProps<"/projects/[projectId]/analyses/[analysisId]">) {
  const loaded = await loadAnalysis((await params).analysisId);
  if (!loaded) notFound();
  const { analysis, project, db, content, draftTitle, request, heading } = loaded;
  const { trackerName } = await projectIntegrations(db, project);
  const canRefine = analysis.kind === "create" && !analysis.publishedIssueKey && analysis.status !== "running";

  const header = (
    <PageHeader
      breadcrumb={
        <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft aria-hidden className="size-3.5" />
          {project.name} · {analysis.kind === "create" ? "New ticket" : "Audit"}
        </Link>
      }
      title={<InlineText>{heading}</InlineText>}
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

  const refinements = answersOf(content.input);
  const decided = refinements.filter(
    (refinement): refinement is Clarification => !isFollowUp(refinement) && refinement.answer !== "",
  );
  const questions = analysis.status === "completed" ? (content.draft?.openQuestions ?? []) : [];

  return (
    <div className="flex flex-col gap-6">
      {header}
      <RefinementProvider
        key={runKey}
        questions={questions}
        canRefine={canRefine}
        refine={refineTicket.bind(null, analysis.id)}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <TicketChat
            request={request}
            refinements={refinements}
            status={analysis.status}
            error={analysis.error}
            draftTitle={draftTitle ?? null}
            publishedKey={analysis.publishedIssueKey}
            publishedUrl={analysis.publishedIssueUrl}
            trackerName={trackerName}
          />
          <div className="order-first flex flex-col gap-6 lg:order-none">
            {analysis.status === "completed" ? (
              <>
                <EvidenceWarnings issues={analysis.evidenceIssues ?? []} />
                {canRefine && <OpenQuestions decided={decided} />}
                <CreationView
                  analysis={analysis}
                  draft={content.draft}
                  trackerName={trackerName}
                  trackerKey={project.trackerResourceId}
                  questionsAnchored={canRefine && questions.length > 0}
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
      </RefinementProvider>
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
