import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { analysis, githubInstallation, jiraConnection, project } from "@/infrastructure/db/schema";

export type Project = typeof project.$inferSelect;
export type Analysis = typeof analysis.$inferSelect;
export type JiraConnection = typeof jiraConnection.$inferSelect;

export const listProjects = (db: Database, organizationId: string) =>
  db.select().from(project).where(eq(project.organizationId, organizationId)).orderBy(desc(project.createdAt));

export async function getProject(db: Database, organizationId: string, projectId: string): Promise<Project | null> {
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.organizationId, organizationId)));
  return row ?? null;
}

export const listAnalyses = (db: Database, projectId: string) =>
  db.select().from(analysis).where(eq(analysis.projectId, projectId)).orderBy(desc(analysis.createdAt)).limit(50);

export async function getAnalysis(
  db: Database,
  organizationId: string,
  analysisId: string,
): Promise<{ analysis: Analysis; project: Project } | null> {
  const [row] = await db
    .select({ analysis, project })
    .from(analysis)
    .innerJoin(project, eq(analysis.projectId, project.id))
    .where(and(eq(analysis.id, analysisId), eq(project.organizationId, organizationId)));
  return row ?? null;
}

export const listGithubInstallations = (db: Database, organizationId: string) =>
  db.select().from(githubInstallation).where(eq(githubInstallation.organizationId, organizationId));

export const listJiraConnections = (db: Database, organizationId: string) =>
  db.select().from(jiraConnection).where(eq(jiraConnection.organizationId, organizationId));

export async function getJiraConnection(db: Database, organizationId: string, connectionId: string) {
  const [row] = await db
    .select()
    .from(jiraConnection)
    .where(and(eq(jiraConnection.id, connectionId), eq(jiraConnection.organizationId, organizationId)));
  return row ?? null;
}

export async function getGithubInstallation(db: Database, organizationId: string, installationId: number) {
  const [row] = await db
    .select()
    .from(githubInstallation)
    .where(and(eq(githubInstallation.id, installationId), eq(githubInstallation.organizationId, organizationId)));
  return row ?? null;
}
