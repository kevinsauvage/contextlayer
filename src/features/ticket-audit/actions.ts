"use server";

import { redirect } from "next/navigation";
import { auditIssue } from "@/core/analysis/analyze";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { defaultGenerator, loadAnalysis, loadProject } from "@/features/analysis/context";
import { readAnalysisInput } from "@/features/analysis/input";
import { buildProjectContext } from "@/features/analysis/project-context";
import { publishApproved, type PublishResult } from "@/features/analysis/publish";
import { startAnalysis } from "@/features/analysis/run";
import { withActionErrors } from "@/features/errors";
import { resolveTracker } from "@/features/integrations/resolve";
import type { ActionState } from "@/lib/action-state";
import { formString } from "@/lib/form";

export async function createAuditAnalysis(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return withActionErrors(async () => {
    const loaded = await loadProject(projectId);
    if ("error" in loaded) return loaded;
    const { db, organizationId, userId, project } = loaded;

    const { provider } = await resolveTracker(db, organizationId, project.trackerConnectionId);
    const issueKey = provider.parseIssueKey(project.trackerResourceId, formString(formData, "issueKey"));
    if (!issueKey) return { error: `Enter an issue key like ${provider.issueKeyExample(project.trackerResourceId)}` };

    const analysisId = await startAnalysis({
      db,
      project,
      userId,
      kind: "audit",
      input: { issueKey },
      execute: async () => {
        const { report, issues, usage } = await auditIssue({
          issueKey,
          ...(await buildProjectContext(db, project)),
          generator: defaultGenerator(),
        });
        return { result: report, issues, usage };
      },
    });
    redirect(`/projects/${projectId}/analyses/${analysisId}`);
  });
}

export async function applyAuditToTracker(analysisId: string, draftInput: unknown): Promise<PublishResult> {
  const approved = parseApprovedDraft(draftInput, "The proposed ticket is invalid");
  if ("error" in approved) return approved;

  const loaded = await loadAnalysis(analysisId, {
    kind: "audit",
    status: "completed",
    publishedError: () => "Already applied to the ticket",
  });
  if ("error" in loaded) return loaded;

  const input = readAnalysisInput(loaded.analysis);
  if (input?.kind !== "audit") return { error: "Analysis input is invalid" };
  return publishApproved(loaded.db, analysisId, approved.draft, async () =>
    (await buildProjectContext(loaded.db, loaded.project)).tracker.updateIssue(input.issueKey, approved.draft),
  );
}
