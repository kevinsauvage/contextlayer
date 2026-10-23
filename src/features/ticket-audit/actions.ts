"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auditIssue } from "@/core/analysis/analyze";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { buildProjectContext } from "@/features/analysis/project-context";
import { publishApproved, type PublishResult } from "@/features/analysis/publish";
import { runAnalysis } from "@/features/analysis/run";
import { ConnectionMissingError, resolveTracker } from "@/features/integrations/resolve";
import { getAnalysis, getProject } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/infrastructure/env";
import { AiGenerator } from "@/integrations/ai/generator";
import type { ActionState } from "@/lib/action-state";
import { formString } from "@/lib/form";

const auditInputSchema = z.object({ issueKey: z.string() });

export async function createAuditAnalysis(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { organizationId, userId } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) return { error: "Project not found" };

  let issueKey: string | null;
  try {
    const { provider } = await resolveTracker(db, organizationId, project.trackerConnectionId);
    issueKey = provider.parseIssueKey(project.trackerResourceId, formString(formData, "issueKey"));
    if (!issueKey) return { error: `Enter an issue key like ${provider.issueKeyExample(project.trackerResourceId)}` };
  } catch (error) {
    if (error instanceof ConnectionMissingError) return { error: error.message };
    throw error;
  }

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

export async function applyAuditToTracker(analysisId: string, draftInput: unknown): Promise<PublishResult> {
  const approved = parseApprovedDraft(draftInput, "The proposed ticket is invalid");
  if ("error" in approved) return { error: approved.error };

  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (found?.analysis.kind !== "audit" || found.analysis.status !== "completed") return { error: "Analysis not found" };
  if (found.analysis.publishedIssueKey) return { error: "Already applied to the ticket" };

  const input = auditInputSchema.safeParse(found.analysis.input);
  if (!input.success) return { error: "Analysis input is invalid" };
  return publishApproved(db, analysisId, approved.draft, async () =>
    (await buildProjectContext(db, found.project)).tracker.updateIssue(input.data.issueKey, approved.draft),
  );
}
