import type { Metadata } from "next";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AuditView } from "@/components/analysis/audit-view";
import { CreationView } from "@/components/analysis/creation-view";
import { FailedDraft } from "@/components/analysis/failed-draft";
import { InlineText } from "@/components/analysis/inline-text";
import { OpenQuestions } from "@/components/analysis/open-questions";
import { RevisionNotice } from "@/components/analysis/revision-notice";
import { RefinementProvider } from "@/components/analysis/refinement-context";
import { TicketChat } from "@/components/analysis/ticket-chat";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { plainInline } from "@/core/requirements/render";
import { isFollowUp, type Clarification } from "@/core/requirements/schemas";
import { estimateCostUsd } from "@/features/analysis/cost";
import { answersOf, firstLine, requestOf } from "@/features/analysis/input";
import { readAnalysis, revisionChange, shortRevision } from "@/features/analysis/read";
import { getAnalysis } from "@/features/projects/queries";
import { refineTicket, retryAnalysis } from "@/features/ticket-creation/actions";
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
  // Cost is derived when the page renders, not stored: the price table may change without touching a row.
  const costUsd =
    analysis.inputTokens === null || analysis.outputTokens === null
      ? null
      : estimateCostUsd(analysis.model, { inputTokens: analysis.inputTokens, outputTokens: analysis.outputTokens });

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
        [
          analysis.model ?? "Unknown model",
          `${((analysis.latencyMs ?? 0) / 1000).toFixed(1)}s`,
          `${analysis.inputTokens ?? 0} in / ${analysis.outputTokens ?? 0} out tokens`,
          ...(costUsd === null ? [] : [`$${costUsd.toFixed(4)}`]),
          ...(analysis.sourceRevision ? [`commit ${shortRevision(analysis.sourceRevision)}`] : []),
        ].join(" · ")
      }
    />
  );
  const runKey = analysis.startedAt.toISOString();

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
          <AuditView
            analysis={analysis}
            input={content.input}
            report={content.report}
            draft={content.draft}
            issues={analysis.evidenceIssues ?? []}
            trackerName={trackerName}
            trackerKey={project.trackerResourceId}
          />
        )}
      </div>
    );
  }

  const refinements = answersOf(content.input);
  const decided = refinements.filter(
    (refinement): refinement is Clarification => !isFollowUp(refinement) && refinement.answer !== "",
  );
  const questions = analysis.status === "completed" ? (content.draft?.openQuestions ?? []) : [];
  const needsClarification = content.draft
    ? [...content.draft.description, ...content.draft.acceptanceCriteria].filter(
        (claim) => claim.status === "needs_clarification",
      ).length
    : 0;

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
                {!analysis.publishedIssueKey && (
                  <ProvisionalNotice questions={questions.length} claims={needsClarification} />
                )}
                {!analysis.publishedIssueKey && <RevisionNotice change={revisionChange(analysis)} />}
                <CreationView
                  analysis={analysis}
                  draft={content.draft}
                  trackerName={trackerName}
                  trackerKey={project.trackerResourceId}
                  questionsAnchored={canRefine && questions.length > 0}
                  issues={analysis.evidenceIssues ?? []}
                />
                {canRefine && <OpenQuestions decided={decided} />}
              </>
            ) : analysis.status === "failed" && content.draft ? (
              <FailedDraft
                draft={content.draft}
                trackerName={trackerName}
                projectLabel={project.trackerResourceId}
                error={analysis.error}
                retry={retryAnalysis.bind(null, analysis.id)}
              />
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

const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

// Says up front that the draft is not settled yet, instead of leaving the state to the counts by the approve button.
function ProvisionalNotice({ questions, claims }: { questions: number; claims: number }) {
  if (!questions && !claims) return null;
  const parts = [
    questions ? plural(questions, "open question", "open questions") : "",
    claims ? plural(claims, "claim needs clarification", "claims need clarification") : "",
  ].filter(Boolean);
  return (
    <div role="status" className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <p className="font-medium">Provisional draft — {parts.join(" and ")}</p>
      <p className="text-muted-foreground">
        Answer below and the draft regenerates; nothing is sent until you approve.
      </p>
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
