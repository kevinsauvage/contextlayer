import { and, desc, eq, sql } from "drizzle-orm";
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

export type AnalysisPage = { analyses: Analysis[]; olderThan: string | null };

// Keyset paging: `before` is the last analysis of the previous page, so a new run does not shift the pages. The cursor
// row is compared in SQL because a JS Date would drop the timestamp's microseconds. `olderThan` is the next cursor.
export async function listAnalyses(db: Database, projectId: string, before?: string): Promise<AnalysisPage> {
  const older =
    before && isUuid(before)
      ? sql`(${analysis.createdAt}, ${analysis.id}) < (select c.created_at, c.id from ${analysis} c where c.id = ${before} and c.project_id = ${projectId})`
      : undefined;
  const rows = await db
    .select()
    .from(analysis)
    .where(and(eq(analysis.projectId, projectId), older))
    .orderBy(desc(analysis.createdAt), desc(analysis.id))
    .limit(HISTORY_PAGE_SIZE + 1);
  const page = rows.slice(0, HISTORY_PAGE_SIZE);
  return {
    analyses: page.map(displayed),
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
