import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditView } from "@/components/analysis/audit-view";
import { CreationView } from "@/components/analysis/creation-view";
import { EvidenceWarnings } from "@/components/analysis/evidence-warnings";
import { RequestPanel } from "@/components/analysis/request-panel";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { firstLine, requestOf } from "@/features/analysis/input";
import { readAnalysis } from "@/features/analysis/read";
import { failStaleAnalyses, getAnalysis } from "@/features/projects/queries";
import { projectIntegrations } from "@/features/projects/view";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

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
  const content = readAnalysis(analysis);
  const { trackerName } = await projectIntegrations(db, project);
  const draftTitle = analysis.kind === "create" ? content.draft?.title : undefined;
  const heading = draftTitle ?? (firstLine(requestOf(content.input)) || "Untitled");
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
        <RequestPanel analysis={analysis} input={content.input} trackerName={trackerName} editable={canRefine} />
      )}
      {analysis.status === "running" && (
        <p className="text-muted-foreground" role="status">
          This analysis is still running. Refresh in a moment.
        </p>
      )}
      {analysis.status === "completed" && (
        <>
          <EvidenceWarnings issues={analysis.evidenceIssues ?? []} />
          {analysis.kind === "create" ? (
            <CreationView
              analysis={analysis}
              draft={content.draft}
              trackerName={trackerName}
              trackerKey={project.trackerResourceId}
            />
          ) : (
            <AuditView
              analysis={analysis}
              input={content.input}
              report={content.report}
              draft={content.draft}
              trackerName={trackerName}
              trackerKey={project.trackerResourceId}
            />
          )}
        </>
      )}
    </div>
  );
}
