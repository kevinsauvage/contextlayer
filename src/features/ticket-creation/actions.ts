"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { analyzeTitle } from "@/core/analysis/analyze";
import { validateEvidenceReferences } from "@/core/evidence/validate";
import { draftSections, ticketDraftSchema } from "@/core/requirements/schemas";
import { buildProjectContext } from "@/features/analysis/project-context";
import { runAnalysis } from "@/features/analysis/run";
import { getAnalysis, getProject } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";
import { analysis } from "@/infrastructure/db/schema";
import { getEnv } from "@/infrastructure/env";
import { AiGenerator } from "@/integrations/ai/generator";

export type ActionState = { error?: string };

const titleSchema = z.string().trim().min(3, "Enter a ticket title").max(300);

export async function createTicketAnalysis(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const title = titleSchema.safeParse(formData.get("title"));
  if (!title.success) return { error: title.error.issues[0].message };

  const { organizationId, userId } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) return { error: "Project not found" };

  const analysisId = await runAnalysis({
    db,
    project,
    userId,
    kind: "create",
    input: { title: title.data },
    execute: async () => {
      const { draft, issues, usage } = await analyzeTitle({
        title: title.data,
        ...(await buildProjectContext(db, project)),
        generator: new AiGenerator(getEnv().AI_MODEL),
      });
      return { result: draft, issues, usage };
    },
  });
  redirect(`/projects/${projectId}/analyses/${analysisId}`);
}

export async function publishTicket(analysisId: string, draftInput: unknown): Promise<{ error?: string; issueKey?: string; issueUrl?: string }> {
  const draft = ticketDraftSchema.safeParse(draftInput);
  if (!draft.success) return { error: "The draft is invalid" };
  const issues = validateEvidenceReferences(draft.data.evidence, draftSections(draft.data));
  if (issues.length) return { error: `Evidence problem: ${issues[0].message}` };

  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const found = await getAnalysis(db, organizationId, analysisId);
  if (!found || found.analysis.kind !== "create" || found.analysis.status !== "completed") return { error: "Analysis not found" };
  if (found.analysis.publishedIssueKey) return { error: `Already published as ${found.analysis.publishedIssueKey}` };

  const { tracker } = await buildProjectContext(db, found.project);
  const published = await tracker.createIssue(draft.data);
  await db
    .update(analysis)
    .set({ publishedIssueKey: published.key, editedResult: draft.data })
    .where(eq(analysis.id, analysisId));
  return { issueKey: published.key, issueUrl: published.url };
}
