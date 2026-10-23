"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { draftTicket } from "@/core/analysis/analyze";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { buildProjectContext } from "@/features/analysis/project-context";
import { publishApproved, type PublishResult } from "@/features/analysis/publish";
import { runAnalysis } from "@/features/analysis/run";
import { getAnalysis, getProject, type Project } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb, type Database } from "@/infrastructure/db/client";
import { getEnv } from "@/infrastructure/env";
import { AiGenerator } from "@/integrations/ai/generator";
import type { ActionState } from "@/lib/action-state";
import { firstIssueMessage } from "@/lib/zod";

const requestSchema = z
  .string()
  .trim()
  .min(3, "Describe what you need in at least a few words")
  .max(4000, "Keep the request under 4,000 characters");

const draftFromRequest = (db: Database, project: Project, request: string) => async () => {
  const { draft, issues, usage } = await draftTicket({
    request,
    ...(await buildProjectContext(db, project)),
    generator: new AiGenerator(getEnv().AI_MODEL),
  });
  return { result: draft, issues, usage };
};

export async function createTicketAnalysis(
  projectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const request = requestSchema.safeParse(formData.get("request"));
  if (!request.success) return { error: firstIssueMessage(request.error) };

  const { organizationId, userId } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) return { error: "Project not found" };

  const analysisId = await runAnalysis({
    db,
    project,
    userId,
    kind: "create",
    input: { request: request.data },
    execute: draftFromRequest(db, project, request.data),
  });
  redirect(`/projects/${projectId}/analyses/${analysisId}`);
}

// Until a ticket is published, a refined request replaces the draft instead of adding another analysis to the history.
export async function rerunTicketAnalysis(
  analysisId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const request = requestSchema.safeParse(formData.get("request"));
  if (!request.success) return { error: firstIssueMessage(request.error) };

  const { organizationId, userId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (found?.analysis.kind !== "create") return { error: "Analysis not found" };
  if (found.analysis.publishedIssueKey) return { error: `Already published as ${found.analysis.publishedIssueKey}` };
  if (found.analysis.status === "running") return { error: "This analysis is still running" };

  await runAnalysis({
    db,
    project: found.project,
    userId,
    kind: "create",
    input: { request: request.data },
    execute: draftFromRequest(db, found.project, request.data),
    rerunId: analysisId,
  });
  redirect(`/projects/${found.project.id}/analyses/${analysisId}`);
}

export async function publishTicket(analysisId: string, draftInput: unknown): Promise<PublishResult> {
  const approved = parseApprovedDraft(draftInput, "The draft is invalid");
  if ("error" in approved) return { error: approved.error };

  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (found?.analysis.kind !== "create" || found.analysis.status !== "completed")
    return { error: "Analysis not found" };
  if (found.analysis.publishedIssueKey) return { error: `Already published as ${found.analysis.publishedIssueKey}` };

  return publishApproved(db, analysisId, approved.draft, async () =>
    (await buildProjectContext(db, found.project)).tracker.createIssue(approved.draft),
  );
}
