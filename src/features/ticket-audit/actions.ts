"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auditIssue } from "@/core/analysis/analyze";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { buildProjectContext } from "@/features/analysis/project-context";
import { runAnalysis } from "@/features/analysis/run";
import { getAnalysis, getProject } from "@/features/projects/queries";
import type { ActionState } from "@/features/ticket-creation/actions";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";
import { getEnv } from "@/infrastructure/env";
import { AiGenerator } from "@/integrations/ai/generator";
import { formString } from "@/lib/form";

const issueKeyFor = (projectKey: string) => new RegExp(`^${projectKey}-\\d+$`);

export async function createAuditAnalysis(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { organizationId, userId } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) return { error: "Project not found" };

  const issueKey = formString(formData, "issueKey").trim().toUpperCase();
  if (!issueKeyFor(project.jiraProjectKey).test(issueKey))
    return { error: `Enter an issue key like ${project.jiraProjectKey}-123` };

  const analysisId = await runAnalysis({
    db,
    project,
    userId,
    kind: "audit",
    input: { issueKey },
    execute: async () => {
      const { report, issues, usage } = await auditIssue({
        issueKey,
        ...(await buildProjectContext(db, project)),
        generator: new AiGenerator(getEnv().AI_MODEL),
      });
      return { result: report, issues, usage };
    },
  });
  redirect(`/projects/${projectId}/analyses/${analysisId}`);
}

export async function applyAuditToJira(
  analysisId: string,
  draftInput: unknown,
): Promise<{ error?: string; issueUrl?: string }> {
  const approved = parseApprovedDraft(draftInput, "The proposed ticket is invalid");
  if ("error" in approved) return { error: approved.error };
  const { draft } = approved;

  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (found?.analysis.kind !== "audit" || found.analysis.status !== "completed") return { error: "Analysis not found" };
  if (found.analysis.publishedIssueKey) return { error: "Already applied to Jira" };

  const issueKey = (found.analysis.input as { issueKey: string }).issueKey;
  const { tracker } = await buildProjectContext(db, found.project);
  const published = await tracker.updateIssue(issueKey, draft);
  await db
    .update(analysis)
    .set({ publishedIssueKey: published.key, editedResult: draft })
    .where(eq(analysis.id, analysisId));
  return { issueUrl: published.url };
}
