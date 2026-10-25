"use server";

import { redirect } from "next/navigation";
import { auditIssue } from "@/core/analysis/analyze";
import { issueUpdatedAtOf } from "@/core/audit/schemas";
import { TrackerRejectedError } from "@/core/errors";
import { parseApprovedDraft } from "@/features/analysis/approved-draft";
import { defaultGenerator, loadAnalysis, loadProject } from "@/features/analysis/context";
import { readAnalysisInput } from "@/features/analysis/input";
import { buildProjectContext, buildProjectTracker } from "@/features/analysis/project-context";
import { publishApproved, type PublishResult } from "@/features/analysis/publish";
import { storedEvidence } from "@/features/analysis/read";
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
        const { report, issue, issues, usage, revision } = await auditIssue({
          issueKey,
          ...(await buildProjectContext(db, project)),
          generator: defaultGenerator(),
        });
        // The issue's timestamp travels with the report so applying it can detect edits made in Jira since.
        return { result: { ...report, issueUpdatedAt: issue.updated }, issues, usage, revision };
      },
    });
    redirect(`/projects/${projectId}/analyses/${analysisId}`);
  });
}

export async function applyAuditToTracker(analysisId: string, draftInput: unknown): Promise<PublishResult> {
  return withActionErrors(async () => {
    const loaded = await loadAnalysis(analysisId, {
      kind: "audit",
      status: "completed",
      publishedError: () => "Already applied to the ticket",
    });
    if ("error" in loaded) return loaded;

    const approved = parseApprovedDraft(draftInput, storedEvidence(loaded.analysis), "The proposed ticket is invalid");
    if ("error" in approved) return approved;

    const input = readAnalysisInput(loaded.analysis);
    if (input?.kind !== "audit") return { error: "Analysis input is invalid" };

    // Inside the write, so a tracker failure here gets the same handling as the update itself.
    return publishApproved(loaded.db, analysisId, approved.draft, async () => {
      const tracker = await buildProjectTracker(loaded.db, loaded.project);
      const auditedAt = issueUpdatedAtOf(loaded.analysis.result);
      if (auditedAt) {
        const current = await tracker.getIssue(input.issueKey);
        if (current.updated && current.updated !== auditedAt)
          throw new TrackerRejectedError(
            "The issue changed in Jira since this audit. Re-run the audit, then apply it again.",
          );
      }
      return tracker.updateIssue(input.issueKey, approved.draft);
    });
  });
}
