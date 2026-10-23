import { and, desc, eq, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/infrastructure/db/client";
import { analysis, integrationConnection, project } from "@/infrastructure/db/schema";
import { isUuid } from "@/lib/uuid";

export type Project = typeof project.$inferSelect;
export type Analysis = typeof analysis.$inferSelect;

// A killed or timed-out request never reaches runAnalysis's catch, so old "running" rows are failed on read.
const STALE_ANALYSIS_MS = 10 * 60 * 1000;

const sourceConnection = alias(integrationConnection, "source_connection");
const trackerConnection = alias(integrationConnection, "tracker_connection");

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

export async function failStaleAnalyses(db: Database, projectId: string) {
  await db
    .update(analysis)
    .set({ status: "failed", error: "The analysis did not finish in time. Try again." })
    .where(
      and(
        eq(analysis.projectId, projectId),
        eq(analysis.status, "running"),
        lt(analysis.createdAt, new Date(Date.now() - STALE_ANALYSIS_MS)),
      ),
    );
}

export const listAnalyses = (db: Database, projectId: string) =>
  db.select().from(analysis).where(eq(analysis.projectId, projectId)).orderBy(desc(analysis.createdAt)).limit(50);

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
  return row ?? null;
}
