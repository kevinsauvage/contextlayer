import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { alias } from "drizzle-orm/pg-core";
import { STALE_ANALYSIS_ERROR, isStale } from "@/core/analysis/stale";
import type { Database } from "@/infrastructure/db/client";
import { analysis, integrationConnection, project } from "@/infrastructure/db/schema";
import { isUuid } from "@/lib/uuid";

export type Project = typeof project.$inferSelect;
export type Analysis = typeof analysis.$inferSelect;

const sourceConnection = alias(integrationConnection, "source_connection");
const trackerConnection = alias(integrationConnection, "tracker_connection");

// The row is left untouched; a stale run reads as failed until it is re-run or cleaned up.
const displayed = (row: Analysis): Analysis =>
  isStale(row) ? { ...row, status: "failed", error: STALE_ANALYSIS_ERROR } : row;

export const listProjects = (db: Database, organizationId: string) =>
  db
    .select({
      project,
      sourceProvider: sourceConnection.provider,
      trackerProvider: trackerConnection.provider,
    })
    .from(project)
    .innerJoin(sourceConnection, eq(project.sourceConnectionId, sourceConnection.id))
    .innerJoin(trackerConnection, eq(project.trackerConnectionId, trackerConnection.id))
    .where(eq(project.organizationId, organizationId))
    .orderBy(desc(project.createdAt));

export async function getProject(db: Database, organizationId: string, projectId: string): Promise<Project | null> {
  if (!isUuid(projectId)) return null;
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.organizationId, organizationId)));
  return row ?? null;
}

const HISTORY_PAGE_SIZE = 50;

// What the badge needs, without loading the draft's evidence excerpts: a list of 50 rows would otherwise transfer
// every source excerpt stored with each result.
export type AnalysisReadiness = { openQuestions: number; needsClarification: number; blocking: boolean };
type AnalysisSummary = Pick<Analysis, "id" | "kind" | "status" | "publishedIssueKey" | "createdAt" | "input"> & {
  readiness: AnalysisReadiness;
};
export type AnalysisPage = { analyses: AnalysisSummary[]; olderThan: string | null };

const listDraftSchema = z.object({
  description: z.array(z.object({ status: z.string() })),
  acceptanceCriteria: z.array(z.object({ status: z.string() })),
  openQuestions: z.array(z.unknown()),
});

const listIssuesSchema = z.array(z.object({ kind: z.enum(["evidence", "open_question"]).optional() }));

const readinessOf = (draft: unknown, issues: unknown): AnalysisReadiness => {
  const parsedDraft = listDraftSchema.safeParse(draft);
  const parsedIssues = listIssuesSchema.safeParse(issues ?? []);
  const claims = parsedDraft.success ? [...parsedDraft.data.description, ...parsedDraft.data.acceptanceCriteria] : [];
  return {
    openQuestions: parsedDraft.success ? parsedDraft.data.openQuestions.length : 0,
    needsClarification: claims.filter((claim) => claim.status === "needs_clarification").length,
    blocking: parsedIssues.success ? parsedIssues.data.some((issue) => issue.kind !== "open_question") : false,
  };
};

// The draft a status badge reads: an edited ticket, or the stored result, or an audit's proposed ticket.
const draftForList = sql`case
  when ${analysis.kind} = 'audit' then coalesce(${analysis.editedResult}, ${analysis.result} -> 'proposedTicket')
  else coalesce(${analysis.editedResult}, ${analysis.result})
end`;

// Keyset paging: `before` is the last analysis of the previous page, so a new run does not shift the pages. The cursor
// row is compared in SQL because a JS Date would drop the timestamp's microseconds. `olderThan` is the next cursor.
export async function listAnalyses(db: Database, projectId: string, before?: string): Promise<AnalysisPage> {
  const older =
    before && isUuid(before)
      ? sql`(${analysis.createdAt}, ${analysis.id}) < (select c.created_at, c.id from ${analysis} c where c.id = ${before} and c.project_id = ${projectId})`
      : undefined;
  const rows = await db
    .select({
      id: analysis.id,
      kind: analysis.kind,
      status: analysis.status,
      publishedIssueKey: analysis.publishedIssueKey,
      createdAt: analysis.createdAt,
      startedAt: analysis.startedAt,
      input: analysis.input,
      draft: draftForList,
      evidenceIssues: analysis.evidenceIssues,
    })
    .from(analysis)
    .where(and(eq(analysis.projectId, projectId), older))
    .orderBy(desc(analysis.createdAt), desc(analysis.id))
    .limit(HISTORY_PAGE_SIZE + 1);
  const page = rows.slice(0, HISTORY_PAGE_SIZE);
  return {
    analyses: page.map(({ draft, evidenceIssues, ...row }) => ({
      id: row.id,
      kind: row.kind,
      status: isStale(row) ? "failed" : row.status,
      publishedIssueKey: row.publishedIssueKey,
      createdAt: row.createdAt,
      input: row.input,
      readiness: readinessOf(draft, evidenceIssues),
    })),
    olderThan: rows.length > HISTORY_PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function getAnalysis(
  db: Database,
  organizationId: string,
  analysisId: string,
): Promise<{ analysis: Analysis; project: Project } | null> {
  if (!isUuid(analysisId)) return null;
  const [row] = await db
    .select({ analysis, project })
    .from(analysis)
    .innerJoin(project, eq(analysis.projectId, project.id))
    .where(and(eq(analysis.id, analysisId), eq(project.organizationId, organizationId)));
  return row ? { ...row, analysis: displayed(row.analysis) } : null;
}
