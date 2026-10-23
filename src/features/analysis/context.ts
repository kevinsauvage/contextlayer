import "server-only";
import type { Analysis, Project } from "@/features/projects/queries";
import { getAnalysis, getProject } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb, type Database } from "@/infrastructure/db/client";
import { getEnv } from "@/infrastructure/env";
import { AiGenerator } from "@/integrations/ai/generator";

// Everything a server action needs from the request: who is asking, in which organization, and on which database.
export type ActionContext = { db: Database; organizationId: string; userId: string };

export const defaultGenerator = () => new AiGenerator(getEnv().AI_MODEL);

export async function loadProject(
  projectId: string,
): Promise<(ActionContext & { project: Project }) | { error: string }> {
  const { organizationId, userId } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) return { error: "Project not found" };
  return { db, organizationId, userId, project };
}

type AnalysisQuery = {
  kind: Analysis["kind"];
  // Set to accept only one status, such as "completed".
  status?: Analysis["status"];
  // Reject a row that was already published, using this message so each flow words it for its tracker write.
  publishedError?: (issueKey: string) => string;
  // Reject a row that is still running; a re-run sets it to running before spending tokens.
  runningError?: string;
};

export async function loadAnalysis(
  analysisId: string,
  query: AnalysisQuery,
): Promise<(ActionContext & { analysis: Analysis; project: Project }) | { error: string }> {
  const { organizationId, userId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (found?.analysis.kind !== query.kind || (query.status && found.analysis.status !== query.status))
    return { error: "Analysis not found" };
  if (found.analysis.publishedIssueKey && query.publishedError)
    return { error: query.publishedError(found.analysis.publishedIssueKey) };
  if (found.analysis.status === "running" && query.runningError) return { error: query.runningError };
  return { db, organizationId, userId, analysis: found.analysis, project: found.project };
}
